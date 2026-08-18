/**
 * Las tres respuestas posibles a una propuesta de ZENA, y la lista de las que
 * siguen abiertas. §10 de la especificación.
 *
 * Ninguna de estas rutas acepta qué cambiar: solo el id de una propuesta que
 * ZENA ya dejó preparada y validada. Es la misma regla que el §10 le pone a
 * las herramientas —el user_id sale del JWT, nunca del cuerpo— llevada al otro
 * extremo del flujo: si el cliente pudiera mandar los valores al confirmar, la
 * tarjeta enseñaría una cosa y se aplicaría otra.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { ApiResponse } from '../models/types'
import { logger } from '../config/logger'
import {
  ejecutarAccion, cancelarAccion, deshacerAccion,
  pendientesVivas, deshacibles, type Resultado,
} from '../services/confirmaciones'

export const idAccionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

/**
 * Qué código HTTP le toca a cada negativa.
 *
 * Una propuesta caducada o ya resuelta no es un error del cliente ni del
 * servidor: es que llegó tarde. El 409 lo dice con precisión —«esto ya no está
 * en el estado que hace falta»— y le permite a la app distinguirlo de un 404
 * para enseñar «esta propuesta caducó» en vez de «no encontrado».
 */
const CODIGOS: Record<string, number> = {
  no_existe: 404,
  caducada: 409,
  ya_resuelta: 409,
  rechazada: 422,
}

function responder(res: Response, r: Resultado): void {
  if (r.ok) {
    res.status(200).json({ success: true, data: { cambios: r.cambios }, message: r.mensaje } satisfies ApiResponse)
    return
  }
  res.status(CODIGOS[r.codigo] ?? 409).json({ success: false, message: r.mensaje } satisfies ApiResponse)
}

/** GET /confirmaciones — lo que sigue abierto y lo que aún se puede deshacer. */
export async function listar(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const [pendientes, hechas] = await Promise.all([
    pendientesVivas(userId),
    deshacibles(userId),
  ])
  res.status(200).json({ success: true, data: { pendientes, deshacibles: hechas } } satisfies ApiResponse)
}

/** POST /confirmaciones/:id/confirmar — el único camino por el que ZENA escribe. */
export async function confirmar(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params
  try {
    responder(res, await ejecutarAccion(id, userId))
  } catch (err) {
    // Aquí se llega cuando falla la escritura de la versión anterior. No se
    // aplica nada: el §11 pide que el historial vaya delante del cambio, y un
    // cambio sin versión previa es justo el que no se puede deshacer.
    logger.error(`Confirmar ${id}: ${err instanceof Error ? err.message : err}`)
    res.status(500).json({
      success: false,
      message: 'No se pudo aplicar el cambio. No se tocó nada; inténtalo otra vez.',
    } satisfies ApiResponse)
  }
}

/** POST /confirmaciones/:id/cancelar */
export async function cancelar(req: Request, res: Response): Promise<void> {
  responder(res, await cancelarAccion(req.params.id, req.user!.userId))
}

/** POST /confirmaciones/:id/deshacer — las 24 horas del §10. */
export async function deshacer(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId
  const { id } = req.params
  try {
    responder(res, await deshacerAccion(id, userId))
  } catch (err) {
    logger.error(`Deshacer ${id}: ${err instanceof Error ? err.message : err}`)
    res.status(500).json({
      success: false,
      message: 'No se pudo deshacer el cambio. Nada se movió; inténtalo otra vez.',
    } satisfies ApiResponse)
  }
}
