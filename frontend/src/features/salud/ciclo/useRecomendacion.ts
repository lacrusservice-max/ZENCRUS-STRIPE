/**
 * LA RECOMENDACIÓN DE HOY
 * ═══════════════════════════════════════════════════════════════════════════
 * Qué comer y cómo moverse hoy, cruzando la fase con lo que registró.
 *
 * ── Se calcula aquí, no en el servidor ─────────────────────────────────────
 * Por dos motivos, y el segundo es el que manda. El primero: la tarjeta tiene
 * que salir al abrir la app, sin esperar a una llamada y sin desaparecer en el
 * metro. El segundo: los registros del ciclo viven en el teléfono —la cola de
 * subida encola pendientes que aún no recoge nadie—, así que el servidor no
 * tiene con qué calcularla. Una recomendación pedida al servidor hoy volvería
 * hablando de una fase y unos síntomas que no son los de ella.
 *
 * ── Lo registrado gana a la fase ───────────────────────────────────────────
 * Es la regla del documento y es la que da valor a la tarjeta. Una tarjeta que
 * solo mira la fase dice lo mismo trece días seguidos y se convierte en
 * decorado. Quien apuntó cólicos hoy necesita saber qué hacer con los cólicos,
 * no leer otra vez qué favorece su fase.
 *
 * ── Y la energía gana a las dos ────────────────────────────────────────────
 * Con energía de 1 o 2 no se sugiere intensidad aunque sea el día de la
 * ovulación y la guía diga que es el mejor momento del mes. La guía describe
 * una tendencia de población; la energía registrada es un dato suyo.
 */

import { useMemo } from 'react'
import { useCicloStore, DIA_VACIO } from '@/store/cicloStore'
import { useCiclo } from './useCiclo'
import { patronesDelCiclo } from './patrones'
import {
  recomendacionDelDia, semillaDeFecha, dentroDeFase, type Recomendacion,
} from '@/nucleo/ciclo/recomendaciones'
import { hoyLocal } from '@/utils/fechas'

export interface RecomendacionDeHoy {
  reco: Recomendacion
  /** Para la cabecera de la tarjeta: «día 2 de 5 de tu fase lútea». */
  dentro: { n: number; de: number } | null
}

export function useRecomendacion(): RecomendacionDeHoy | null {
  const hoy = hoyLocal()
  const logs = useCicloStore(s => s.logs)
  /* Se lee el mapa y el `?? DIA_VACIO` va fuera: un selector que construye un
     objeto devuelve uno nuevo cada vez y Zustand entra en bucle. */
  const dia = useCicloStore(s => s.logs[hoy]) ?? DIA_VACIO
  const anticonceptivo = useCicloStore(s => s.perfil.anticonceptivo ?? null)
  const { prediccion, marco, modo, periodos } = useCiclo()

  return useMemo(() => {
    /* Sin predicción no hay fase que cruzar, y en los modos que no predicen
       —embarazo, sin ciclo— hablar de fases sería hablar de algo que no está
       pasando. En los dos casos la tarjeta no se pinta. */
    if (!prediccion || !modo.predice) return null

    /* El patrón del bloque 5, si hay alguno con suficiente apoyo. Se pasa el
       mejor: la tarjeta tiene sitio para una línea, no para cuatro. */
    const [patron] = patronesDelCiclo(logs, periodos, marco, hoy)

    const energia = (dia.energia as { level?: number } | undefined)?.level ?? null

    return {
      reco: recomendacionDelDia({
        fase: prediccion.fase,
        dia,
        energia,
        anticonceptivo,
        patron: patron?.texto ?? null,
        semilla: semillaDeFecha(hoy),
      }),
      dentro: dentroDeFase(prediccion.diaDeCiclo, marco, prediccion.fase),
    }
  }, [prediccion, modo, dia, logs, periodos, marco, anticonceptivo, hoy])
}
