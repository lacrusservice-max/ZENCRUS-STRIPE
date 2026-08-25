/**
 * HISTORIAL Y MAPA DE CALOR
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se ve al mirar meses en vez de días.
 *
 * ── El mapa de calor es una TASA, no un recuento ───────────────────────────
 * Es la decisión que hace que esta vista sirva. Si cada celda contara cuántas
 * veces registró dolor el día 3, los días que más registró saldrían siempre
 * más oscuros — y lo que se estaría dibujando no es su cuerpo, es su
 * constancia rellenando la app.
 *
 * Aquí cada celda es «de los ciclos en los que apuntó ALGO ese día, en cuántos
 * apareció esto». Un día con dos registros de dos ciclos pesa lo mismo que uno
 * con doce de doce, y la celda dice lo que dice: con qué frecuencia le pasa,
 * no cuánto escribe.
 *
 * ── Y por eso hace falta el tamaño de muestra ──────────────────────────────
 * Una tasa de 1,0 sobre dos observaciones no es lo mismo que una de 0,8 sobre
 * treinta, y pintadas se ven igual de oscuras. Cada celda lleva su `n` y la
 * pantalla apaga las que no llegan al mínimo, en vez de enseñar una casilla
 * negra que no significa nada.
 */

import { diasEntre, sumarDias } from '@/utils/fechas'
import type { RegistroDia } from '@/store/cicloStore'
import type { TrackerKind } from '@/features/salud/trackers'
import type { Periodo } from './periodos'
import { SANGRADO_MINIMO } from './periodos'

/** Por debajo de esto una celda no se pinta: no hay muestra que pintar. */
export const MUESTRA_MINIMA = 2

export interface CicloEnSerie {
  inicio: string
  /** `null` en el ciclo en curso. */
  duracion: number | null
  diasSangrado: number
  /** Desviación respecto a la media, en días. Para pintar la barra. */
  desvio: number | null
}

export function serieCiclos(periodos: Periodo[], media: number | null): CicloEnSerie[] {
  return periodos.map(p => ({
    inicio: p.inicio,
    duracion: p.duracionCiclo,
    diasSangrado: p.diasSangrado,
    desvio: p.duracionCiclo != null && media != null
      ? Math.round((p.duracionCiclo - media) * 10) / 10
      : null,
  }))
}

/** Qué cuenta como «esto le pasó» en cada tracker. */
function relevante(kind: TrackerKind, r: RegistroDia): boolean {
  switch (kind) {
    case 'sangrado': return (r.sangrado?.level ?? 0) >= SANGRADO_MINIMO
    case 'dolor': return (r.dolor?.zones.length ?? 0) > 0
    // Ánimo bajo y energía baja, no «registró ánimo»: lo que interesa del
    // patrón es el mal día, no que ese día abriera la app.
    case 'animo': return (r.animo?.valence ?? 1) < -0.3
    case 'energia': return (r.energia?.level ?? 5) <= 2
    case 'digestion': return (r.digestion?.tags.length ?? 0) > 0
    case 'piel': return (r.piel?.tags.length ?? 0) > 0
    case 'perimenopausia': return (r.perimenopausia?.tags.length ?? 0) > 0
    case 'sueno': return (r.sueno?.quality === 'mal' || r.sueno?.quality === 'regular')
    case 'flujo': return r.flujo?.texture === 'clara_huevo' || r.flujo?.texture === 'acuoso'
    case 'libido': return (r.libido?.desire ?? 0) >= 4
    default: return kind in r
  }
}

export interface CeldaCalor {
  /** 0–1. Tasa sobre los ciclos con registro ese día. */
  tasa: number
  /** Cuántos ciclos aportaron dato. */
  n: number
}

export interface FilaCalor {
  kind: TrackerKind
  celdas: CeldaCalor[]
  /** El día de ciclo donde más aparece, si la muestra da para decirlo. */
  pico: number | null
}

export interface MapaCalor {
  /** Longitud de cada fila. */
  dias: number
  filas: FilaCalor[]
  /** Ciclos completos que entraron. */
  ciclos: number
}

/**
 * El mapa de calor, alineado por día de ciclo.
 *
 * Solo entran ciclos CERRADOS: el que está en curso solo tiene registrados los
 * primeros días, y dejarlo entrar hundiría artificialmente las tasas de la
 * segunda mitad del ciclo.
 */
export function mapaCalor(
  logs: Record<string, RegistroDia>,
  periodos: Periodo[],
  kinds: TrackerKind[],
  duracionMax: number,
): MapaCalor {
  const cerrados = periodos.filter(p => p.duracionCiclo != null)
  const dias = Math.max(21, Math.min(45, Math.round(duracionMax)))

  if (cerrados.length < MUESTRA_MINIMA) {
    return { dias, ciclos: cerrados.length, filas: [] }
  }

  const filas: FilaCalor[] = kinds.map(kind => {
    const celdas: CeldaCalor[] = []
    for (let d = 1; d <= dias; d++) {
      let conRegistro = 0
      let positivos = 0
      for (const p of cerrados) {
        if (d > (p.duracionCiclo ?? 0)) continue
        const r = logs[sumarDias(p.inicio, d - 1)]
        if (!r || !Object.keys(r).length) continue
        conRegistro++
        if (relevante(kind, r)) positivos++
      }
      celdas.push({
        tasa: conRegistro ? positivos / conRegistro : 0,
        n: conRegistro,
      })
    }

    /* El pico solo se nombra si su celda tiene muestra. Señalar «tu peor día
       es el 19» sobre una sola observación es exactamente el tipo de dato
       falso que este archivo existe para evitar. */
    let pico: number | null = null
    let mejor = 0
    celdas.forEach((c, i) => {
      if (c.n >= MUESTRA_MINIMA && c.tasa > mejor) { mejor = c.tasa; pico = i + 1 }
    })

    return { kind, celdas, pico: mejor >= 0.5 ? pico : null }
  })

  return { dias, ciclos: cerrados.length, filas }
}

/**
 * Cuántos días seguidos lleva registrando algo.
 *
 * Se cuenta hacia atrás desde hoy y se corta en el primer hueco. Sirve para
 * la racha, y también para saber si el historial se puede tomar en serio.
 */
export function rachaRegistro(logs: Record<string, RegistroDia>, hoy: string): number {
  let n = 0
  let f = hoy
  // Si hoy aún no ha registrado, la racha de ayer sigue viva.
  if (!logs[f] || !Object.keys(logs[f]).length) f = sumarDias(f, -1)
  while (logs[f] && Object.keys(logs[f]).length) { n++; f = sumarDias(f, -1) }
  return n
}

/** Cobertura del historial: qué porcentaje de días de cada ciclo tiene registro. */
export function cobertura(
  logs: Record<string, RegistroDia>,
  periodos: Periodo[],
): number | null {
  const cerrados = periodos.filter(p => p.duracionCiclo != null)
  if (!cerrados.length) return null
  let dias = 0
  let conDato = 0
  for (const p of cerrados) {
    for (let d = 0; d < (p.duracionCiclo ?? 0); d++) {
      dias++
      const r = logs[sumarDias(p.inicio, d)]
      if (r && Object.keys(r).length) conDato++
    }
  }
  return dias ? Math.round((conDato / dias) * 100) : null
}

/** Días desde el último registro. Para saber si el módulo está en uso. */
export function diasSinRegistrar(logs: Record<string, RegistroDia>, hoy: string): number | null {
  const fechas = Object.keys(logs).filter(f => Object.keys(logs[f]).length).sort()
  if (!fechas.length) return null
  return diasEntre(fechas[fechas.length - 1], hoy)
}
