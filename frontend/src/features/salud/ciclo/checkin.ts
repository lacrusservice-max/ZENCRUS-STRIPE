/**
 * EL CHECK-IN DIARIO
 * ═══════════════════════════════════════════════════════════════════════════
 * Cuándo preguntarle cómo está, y qué preguntarle.
 *
 * ── Por qué esto es la pieza que sostiene el módulo entero ─────────────────
 * Todo lo demás —fases, predicción, banda, correlaciones, lo que ZENA sabe—
 * se calcula sobre días registrados. Sin registro diario no hay motor: hay una
 * pantalla bonita enseñando la media de la población. El problema difícil de
 * este módulo nunca fue la matemática, fue la adherencia.
 *
 * ── Tres preguntas, no dieciocho ───────────────────────────────────────────
 * El registro completo tiene tres pasos y dieciocho trackers. Eso está bien
 * para quien quiere contarlo todo, y es exactamente lo que hace que la mayoría
 * no registre NADA. El check-in pide el mínimo que hace funcionar al motor:
 *
 *   1. ¿Sangras hoy?  — sin esto no hay periodos, ni fases, ni predicción.
 *   2. Tu energía     — es lo que se cruza con entrenamiento y nutrición.
 *   3. Tu ánimo       — el patrón que más se repite y más se agradece ver.
 *
 * Cuatro toques. Lo demás sigue estando a un botón de distancia.
 *
 * ── Y no aparece si no hace falta ──────────────────────────────────────────
 * Si ya registró lo esencial hoy, no se enseña. Es para completar un hueco, no
 * un ritual que hay que despachar. Una pantalla que aparece igual cuando ya
 * hiciste lo que pedía enseña que no te está mirando.
 *
 * ── «Ahora no» significa hoy no ────────────────────────────────────────────
 * Sin salida, esto es una pantalla que secuestra la app. Con salida que vuelve
 * a la siguiente pantalla, es peor. Se aparta por el día entero y ya está.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { RegistroDia } from '@/store/cicloStore'

const CLAVE_APARTADO = 'ciclo.checkin.apartado'

/** Lo mínimo que hace falta para que el día cuente como registrado. */
export type PiezaEsencial = 'sangrado' | 'energia' | 'animo'

export const ESENCIALES: PiezaEsencial[] = ['sangrado', 'energia', 'animo']

export interface EstadoCheckin {
  /** Qué falta hoy. Vacío = el día está completo. */
  faltan: PiezaEsencial[]
  /** `true` si toca enseñar la pantalla. */
  procede: boolean
}

/**
 * Qué falta del día y si toca preguntar.
 *
 * `apartadoHoy` lo decide quien llama leyendo el almacenamiento; se pasa como
 * argumento y no se lee aquí para que esta función siga siendo pura y se pueda
 * probar sin simular AsyncStorage.
 */
export function estadoDeHoy(
  dia: RegistroDia | undefined,
  apartadoHoy: boolean,
): EstadoCheckin {
  const faltan = ESENCIALES.filter(p => !tiene(dia, p))
  return { faltan, procede: faltan.length > 0 && !apartadoHoy }
}

/**
 * ¿Está esta pieza registrada?
 *
 * Ojo con `sangrado`: un nivel 0 significa «hoy no sangré», que es un DATO y
 * cuenta como registrado. Tratar el 0 como hueco haría que quien no sangra
 * —o sea, la mayoría de los días— viera la pregunta todos los días aunque la
 * contestara todos los días.
 */
function tiene(dia: RegistroDia | undefined, pieza: PiezaEsencial): boolean {
  if (!dia) return false
  if (pieza === 'sangrado') return dia.sangrado != null
  if (pieza === 'energia') return dia.energia != null
  return dia.animo != null
}

/** ¿Se apartó ya hoy? */
export async function apartadoHoy(hoy: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLAVE_APARTADO)) === hoy
  } catch {
    /* Si el almacenamiento falla, se prefiere NO preguntar: insistir por un
       fallo técnico es la peor versión de esta pantalla. */
    return true
  }
}

/** Apartarlo por el resto del día. */
export async function apartarHoy(hoy: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CLAVE_APARTADO, hoy)
  } catch { /* si no se guarda, lo peor que pasa es que vuelva a aparecer */ }
}

/* ── El saludo ─────────────────────────────────────────────────────────── */

/**
 * Cómo se abre la pantalla.
 *
 * Cambia con la hora porque «¿cómo te sientes hoy?» a las once de la noche
 * suena a pregunta de alguien que no sabe qué hora es. Y cambia con la racha
 * porque volver el día 30 no es lo mismo que volver el día 2, aunque la app
 * pida lo mismo.
 */
export function saludo(horaLocal: number, racha: number): string {
  const momento = horaLocal < 12 ? 'Buenos días' : horaLocal < 20 ? 'Buenas tardes' : 'Buenas noches'
  if (racha >= 30) return `${momento}. Un mes seguido registrando.`
  if (racha >= 7) return `${momento}. ${racha} días seguidos.`
  return momento
}

/**
 * Qué se gana registrando hoy, dicho sin promesas.
 *
 * Se enseña cuando aún no hay predicción: es el momento en que la pantalla
 * pide más y devuelve menos, y merece explicar por qué vale la pena. Con
 * predicción ya hecha, sobra — se ve sola.
 */
export function porQueImporta(ciclosRegistrados: number): string | null {
  if (ciclosRegistrados >= 2) return null
  if (ciclosRegistrados === 1) {
    return 'Con un ciclo más ya podré decirte cuándo te toca, y cuánto suelo equivocarme.'
  }
  return 'Marcar los días que sangras es lo único imprescindible: de ahí salen tus fases, '
    + 'tu predicción y todo lo demás.'
}
