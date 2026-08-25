/**
 * SUBIR LA PREDICCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 * El motor calcula en el móvil; el resultado se guarda en el servidor para que
 * ZENA y el informe clínico puedan leerlo sin recalcular nada.
 *
 * ── Por qué el cálculo NO se mueve al servidor ─────────────────────────────
 * Porque la predicción tiene que existir sin red: se abre la app en el metro y
 * el número tiene que estar. Y porque tener el mismo motor en dos lenguajes es
 * la receta para que se desincronicen — el día que uno redondee distinto, la
 * pantalla dirá una fecha y el informe otra.
 *
 * ── Y por qué no se sube en cada render ────────────────────────────────────
 * `cycle_predictions` es un histórico: cada fila es una foto del modelo en un
 * momento. Insertar una por render lo convertiría en basura y en gasto de red.
 * Solo se sube cuando la predicción CAMBIA de verdad —la banda, la confianza o
 * la muestra—, y como mucho una vez al día.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { hoyLocal } from '@/utils/fechas'
import * as api from '@/services/cicloService'
import type { Prediccion } from './prediccion'

const CLAVE = 'ciclo_prediccion_publicada'

/** Qué hace distinta a una predicción de otra. El día entra para el tope diario. */
const firma = (p: Prediccion) => [
  hoyLocal(),
  p.modelo,
  p.proximoPeriodo.low, p.proximoPeriodo.likely, p.proximoPeriodo.high,
  p.confianza, p.ciclosUsados,
].join('|')

export async function publicarPrediccion(p: Prediccion | null): Promise<void> {
  if (!p) return

  const actual = firma(p)
  try {
    if (await AsyncStorage.getItem(CLAVE) === actual) return
  } catch { /* si no se puede leer la marca, se sube: repetir es barato */ }

  try {
    await api.guardarPrediccion({
      modelVersion: p.modelo,
      nextPeriodLow: p.proximoPeriodo.low,
      nextPeriodLikely: p.proximoPeriodo.likely,
      nextPeriodHigh: p.proximoPeriodo.high,
      ovulationLow: p.ovulacion?.low ?? null,
      ovulationLikely: p.ovulacion?.likely ?? null,
      ovulationHigh: p.ovulacion?.high ?? null,
      fertileStart: p.ventanaFertil?.inicio ?? null,
      fertileEnd: p.ventanaFertil?.fin ?? null,
      confidence: p.confianza,
      sampleCycles: p.ciclosUsados,
      suppressedReason: p.motivoSuprimido,
    })
    await AsyncStorage.setItem(CLAVE, actual)
  } catch {
    /* Sin red no pasa nada: la predicción ya está en pantalla y se subirá la
       próxima vez que se abra con señal. Nunca es motivo de un error visible. */
  }
}
