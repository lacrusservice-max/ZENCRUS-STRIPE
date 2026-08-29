/**
 * TELEMETRÍA · RECIBIR EVENTOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Un solo endpoint, por lotes, y el saneado se vuelve a aplicar aquí.
 *
 * ── Por qué se sanea otra vez si ya lo hizo la app ─────────────────────────
 * Porque la garantía no puede depender de que el cliente se porte bien. La app
 * es código que corre en el teléfono de otra persona: se puede modificar, se
 * puede quedar en una versión vieja, y basta con que alguien escriba mal un
 * `props` en un `apiPost` suelto para saltarse el filtro. Sanear en los dos
 * lados cuesta una llamada a función y convierte una convención en una
 * propiedad del sistema.
 *
 * Es la misma disciplina que ya tienen los 14 trackers del ciclo, que se
 * validan con el mismo zod en cliente y servidor (D-24).
 *
 * ── Nunca rompe la app ─────────────────────────────────────────────────────
 * Un evento con mala pinta se descarta y se sigue con el resto; el lote
 * responde 200 con la cuenta de aceptados. La telemetría es lo último que
 * puede permitirse tirar una pantalla: si esto devolviera 400, la cola del
 * teléfono reintentaría para siempre un lote que nunca va a entrar.
 */

import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { ApiResponse } from '../models/types'
import { sanear, SECCIONES_SENSIBLES } from '../nucleo/telemetria/eventos'
import type { Evento, Seccion } from '../nucleo/telemetria/eventos'

/** Tope por lote. Suficiente para una sesión larga sin red, y acotado. */
const MAX_LOTE = 200

const eventoSchema = z.object({
  nombre: z.string().min(1).max(60),
  seccion: z.string().min(1).max(30),
  pantalla: z.string().max(200).optional(),
  control: z.string().max(60).optional(),
  props: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  ocurrioEn: z.string().datetime(),
  sesionId: z.string().max(64),
})

export const loteEventosSchema = z.object({
  body: z.object({
    eventos: z.array(eventoSchema).min(1).max(MAX_LOTE),
    plataforma: z.string().max(20).optional(),
    versionApp: z.string().max(20).optional(),
  }),
})

/**
 * Una fecha del teléfono en la que se pueda confiar para ordenar.
 *
 * El reloj de un móvil se puede ir, y a veces se va años. Una fecha en el
 * futuro o demasiado vieja se recorta a la de llegada: es peor perder el
 * evento que tenerlo con un minuto de desfase, y una fecha de 2035 rompería
 * cualquier gráfica en la que caiga.
 */
function fechaCreible(iso: string, ahora: Date): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ahora.toISOString()
  const dias30 = 30 * 24 * 3600 * 1000
  if (t > ahora.getTime() + 60_000) return ahora.toISOString()
  if (t < ahora.getTime() - dias30) return ahora.toISOString()
  return new Date(t).toISOString()
}

export async function recibirEventos(req: Request, res: Response): Promise<void> {
  const userId = req.user?.userId ?? null
  const { eventos, plataforma, versionApp } = req.body as {
    eventos: Evento[]; plataforma?: string; versionApp?: string
  }

  const ahora = new Date()

  const filas = eventos.map(e => {
    const limpio = sanear({ ...e, seccion: e.seccion as Seccion })
    return {
      user_id: userId,
      nombre: limpio.nombre,
      seccion: limpio.seccion,
      pantalla: limpio.pantalla ?? null,
      control: limpio.control ?? null,
      props: limpio.props,
      ocurrio_en: fechaCreible(limpio.ocurrioEn, ahora),
      sesion_id: limpio.sesionId,
      plataforma: plataforma ?? null,
      version_app: versionApp ?? null,
    }
  })

  const { error } = await supabase.from('app_events').insert(filas)

  if (error) {
    /* 500 y no 400: el lote se reintenta, porque el fallo es nuestro. Lo que
       nunca se reintenta es un lote mal formado, y de eso ya se encarga la
       validación antes de llegar aquí. */
    logger.error('recibirEventos:', error.message)
    res.status(500).json({ success: false, message: 'No se pudieron guardar los eventos' } satisfies ApiResponse)
    return
  }

  res.status(200).json({ success: true, data: { aceptados: filas.length } } satisfies ApiResponse)
}

/** Expuesto solo para las pruebas: qué secciones llevan lista blanca. */
export const seccionesSensibles = SECCIONES_SENSIBLES
