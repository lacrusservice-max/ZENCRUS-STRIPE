/**
 * CUOTAS DE IA Y VERIFICACIÓN DE PLAN
 * ───────────────────────────────────
 * El servidor decide qué plan tiene alguien y cuánto puede gastar. No la app.
 *
 * ── Por qué existe esto ─────────────────────────────────────────────────────
 * Hasta ahora `premiumStore` guardaba `plan: 'premium'` en el AsyncStorage del
 * teléfono y la app leía ESO para desbloquear funciones. Quien pudiera editar
 * ese almacenamiento se daba Premium solo. Y el chat no tenía tope de ningún
 * tipo: bastaba una sesión válida para mandar mensajes sin fin.
 *
 * La regla que arregla las dos cosas es la misma y no admite excepciones:
 * **el plan sale de la tabla `subscriptions`, nunca de la petición.** El
 * cliente puede pedir lo que quiera; aquí se comprueba contra la base.
 *
 * ── El día es el del usuario, no el del servidor ────────────────────────────
 * Railway corre en UTC. Si el corte de la cuota fuera el suyo, a un usuario en
 * México se le reiniciaría el contador a las 18:00, en mitad de la tarde. La
 * app manda su fecha local en la cabecera `X-Zona-Fecha`; si no llega, se cae
 * a la hora de Ciudad de México, que es donde está el grueso de la base.
 *
 * ── Un tope alcanzado no es un error del usuario ────────────────────────────
 * Se responde 429 con cuántos lleva, cuál es el tope y cuándo se reinicia,
 * para que la app pueda decirlo con palabras en vez de con un error rojo.
 */

import { Request, Response, NextFunction } from 'express'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import { supabase } from '../config/supabase'

export type TipoGasto = 'chat' | 'photo' | 'plan'

/**
 * Planes internos → topes diarios.
 *
 * Los números salen de la especificación de ZENA (§5). Están aquí y no en la
 * base porque cambiarlos es una decisión de producto que merece pasar por
 * revisión de código, no un UPDATE suelto en producción.
 *
 * -1 significa sin tope.
 */
export const TOPES: Record<string, Record<TipoGasto, number>> = {
  // Sin suscripción activa. No es cero para que alguien que acaba de instalar
  // pueda probar la app y entender qué compra; es bajo para que no sea el plan.
  free:    { chat: 5,  photo: 2,  plan: 1 },
  // Plan base, 249 MXN.
  base:    { chat: 25, photo: 10, plan: 4 },
  // Plan Premium, 499 MXN, y los anuales.
  premium: { chat: 80, photo: 20, plan: 8 },
  // Cuentas internas: pruebas, soporte, demos.
  interno: { chat: -1, photo: -1, plan: -1 },
}

/**
 * `subscriptions.tier` guarda el producto vendido; TOPES habla de planes.
 * Este mapa traduce entre los dos y es el único sitio donde hay que tocar
 * cuando se cree una tarifa nueva.
 *
 * Los valores antiguos —`basic`, `premium`, `corporate`— siguen en el ENUM
 * porque Postgres no deja quitarlos, y puede haber filas viejas con ellos.
 *
 * `annual_duo` y `annual_familiar` están en la misma situación desde que se
 * retiraron del catálogo: ya no se venden, pero se siguen leyendo. Hoy no hay
 * ninguna fila con esos valores; se dejan porque quitarlos solo ahorra dos
 * líneas y a cambio deja a quien los tuviera cayendo a `free`, que es la peor
 * forma posible de enterarse.
 */
const TIER_A_PLAN: Record<string, keyof typeof TOPES> = {
  free: 'free',
  basic: 'base',
  monthly: 'base',
  premium: 'premium',
  annual_individual: 'premium',
  annual_duo: 'premium',
  annual_familiar: 'premium',
  corporate: 'interno',
}

/** Fecha del usuario. La manda la app; si no, se usa la de Ciudad de México. */
export function fechaDelUsuario(req: Request): string {
  const cabecera = req.header('X-Zona-Fecha')
  if (cabecera && /^\d{4}-\d{2}-\d{2}$/.test(cabecera)) return cabecera
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

/**
 * Plan efectivo del usuario, leído de la base.
 *
 * Se toma la suscripción activa más reciente cuya fecha de fin no haya pasado.
 * Sin ninguna, el plan es `free` — nunca se asume nada mejor por defecto.
 */
export async function planDelUsuario(userId: string): Promise<keyof typeof TOPES> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('tier, end_date')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('end_date', new Date().toISOString())
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Ante la duda NO se regala plan: se cae a `free`. Un usuario que paga y ve
    // su cuota reducida un minuto se queja; uno que no paga y consume Premium
    // porque la base tosió, no se queja nunca.
    logger.error('planDelUsuario:', error.message)
    return 'free'
  }

  if (!data) return 'free'
  return TIER_A_PLAN[data.tier] ?? 'free'
}

/**
 * Middleware. Resuelve el plan, consume una unidad de cuota y deja en
 * `req.cuota` lo gastado, por si el controlador necesita devolverla.
 */
export function exigirCuota(tipo: TipoGasto) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user!.userId
    const fecha = fechaDelUsuario(req)

    try {
      const plan = await planDelUsuario(userId)
      const limite = TOPES[plan][tipo]

      const { data, error } = await supabase.rpc('consumir_cuota', {
        p_user_id: userId,
        p_kind: tipo,
        p_limite: limite,
        p_fecha: fecha,
      })

      if (error) {
        // Que falle el contador no puede dejar sin servicio a quien paga: se
        // registra y se deja pasar. La alternativa —bloquear— convierte un
        // problema de la base en una caída de la app.
        logger.error(`exigirCuota(${tipo}) fallo al contar:`, error.message)
        next()
        return
      }

      const fila = Array.isArray(data) ? data[0] : data
      const permitido = fila?.permitido ?? true
      const usados = fila?.usados ?? 0

      if (!permitido) {
        logger.info(`Cuota agotada: usuario ${userId}, ${tipo}, plan ${plan}, ${usados}/${limite}`)
        res.status(429).json({
          success: false,
          message:
            tipo === 'chat'
              ? 'Llegaste a tus mensajes de hoy. Mañana volvemos a empezar.'
              : 'Llegaste a tus fotos de hoy. Mañana volvemos a empezar.',
          data: { tipo, plan, usados, limite, reinicia: 'mañana' },
        } satisfies ApiResponse)
        return
      }

      req.cuota = { tipo, fecha, plan, usados, limite }
      next()
    } catch (err) {
      logger.error(`exigirCuota(${tipo}):`, err)
      next()
    }
  }
}

/**
 * Devuelve la unidad consumida.
 *
 * Se llama cuando el gasto no llegó a ocurrir de verdad: el modelo falló, la
 * foto no era comida, el usuario rechazó el resultado. Cobrar cuota por un
 * fallo del sistema es la forma más rápida de que una queja tenga razón.
 */
export async function devolverCuota(req: Request): Promise<void> {
  if (!req.cuota) return
  const { error } = await supabase.rpc('devolver_cuota', {
    p_user_id: req.user!.userId,
    p_kind: req.cuota.tipo,
    p_fecha: req.cuota.fecha,
  })
  if (error) logger.error('devolverCuota:', error.message)
}
