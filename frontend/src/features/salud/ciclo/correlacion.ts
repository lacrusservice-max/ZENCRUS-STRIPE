/**
 * CORRELACIÓN CRUZADA · EL DIFERENCIADOR
 * ═══════════════════════════════════════════════════════════════════════════
 * Cruzar la fase del ciclo con el entrenamiento, la comida y el descanso.
 *
 * ── Por qué esto no lo puede hacer ninguna app de ciclo ────────────────────
 * Flo no sabe qué comes. Clue no sabe cuánto levantas. Natural Cycles no sabe
 * cómo dormiste salvo que se lo digas. Para responder «¿me cuesta más entrenar
 * en fase lútea?» hacen falta las dos series a la vez, todos los días, durante
 * meses —y ZENCRUS ya tiene la mitad que a ellas les falta.
 *
 * Este archivo es la razón por la que el módulo existe dentro de esta app y no
 * como una app aparte.
 *
 * ── Y por qué es tan estricto ──────────────────────────────────────────────
 * Porque es facilísimo hacerlo mal. Con cuatro observaciones y un poco de
 * suerte se puede «demostrar» que alguien entrena peor en fase lútea, y una
 * frase así, en una app de salud, cambia cómo alguien se ve a sí mismo. Un
 * dato sin tamaño de muestra ni intervalo no es un dato: es una anécdota con
 * aspecto de dato.
 *
 * Tres guardas, y ninguna es negociable:
 *   1. Mínimo de observaciones POR FASE, no en total.
 *   2. Observaciones de al menos dos ciclos distintos. Un mes malo no es un
 *      patrón: si todo viene del mismo ciclo, lo que se mide es ese mes.
 *   3. El intervalo tiene que excluir el cero. Si lo cruza, la respuesta
 *      honesta es «no se ve efecto», y se dice.
 *
 * ── Correlación no es causa, y aquí menos ──────────────────────────────────
 * Que alguien levante menos en fase lútea puede ser la progesterona, o que la
 * lútea le caiga siempre en semana de descarga, o que duerma peor por otra
 * cosa. El texto que sale de aquí describe lo observado y jamás explica por
 * qué. El porqué no está en estos datos.
 */

import { sumarDias } from '@/utils/fechas'
import type { Phase } from './fases'
import type { Periodo } from './periodos'
import { faseDeDia, type MarcoFases } from './prediccion'
import { PHASE_ORDER } from './fases'

/** Observaciones mínimas en una fase para decir algo de ella. */
export const MIN_OBSERVACIONES = 6

/** Ciclos distintos mínimos. Un solo ciclo mide ese mes, no el patrón. */
export const MIN_CICLOS = 2

/** Cuantil t al 90 % de una cola, igual que en el motor de predicción. */
const T90: Record<number, number> = {
  1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.440, 7: 1.415,
  8: 1.397, 9: 1.383, 10: 1.372, 11: 1.363, 12: 1.356, 13: 1.350, 14: 1.345,
  15: 1.341, 16: 1.337, 17: 1.333, 18: 1.330, 19: 1.328, 20: 1.325,
}
const t90 = (gl: number) => gl <= 0 ? T90[1] : T90[gl] ?? (gl <= 30 ? 1.310 : 1.282)

/** Una métrica de la app, ya reducida a un número por día. */
export interface Serie {
  metric: string
  label: string
  unidad?: string
  /** fecha (YYYY-MM-DD) → valor. Los días sin dato NO están. */
  valores: Record<string, number>
  /**
   * Si subir es bueno. Se usa solo para redactar, nunca para calcular:
   * dormir más es bueno, comer más no es ni bueno ni malo.
   */
  direccion?: 'mas_es_mejor' | 'neutro'
}

export interface Correlacion {
  metric: string
  label: string
  unidad?: string
  phase: Phase
  /** Diferencia respecto a su propia línea base, en porcentaje. */
  efectoPct: number
  ciLow: number
  ciHigh: number
  n: number
  ciclos: number
  media: number
  linaBase: number
  /** `true` si el intervalo excluye el cero. */
  claro: boolean
}

interface Entrada {
  series: Serie[]
  periodos: Periodo[]
  marco: MarcoFases
}

/** Media y desviación muestral. */
function resumen(xs: number[]) {
  const n = xs.length
  const media = xs.reduce((a, b) => a + b, 0) / n
  const sd = n > 1
    ? Math.sqrt(xs.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1))
    : 0
  return { n, media, sd }
}

/**
 * Todas las correlaciones que superan las tres guardas.
 *
 * Devuelve también las que salen sin efecto claro, marcadas con `claro: false`:
 * «esto lo he mirado y no se ve nada» es información, y esconderlo dejaría la
 * pantalla enseñando solo lo que casualmente salió significativo —que es el
 * sesgo de publicación, en miniatura y en el teléfono de alguien.
 */
export function correlacionar({ series, periodos, marco }: Entrada): Correlacion[] {
  const cerrados = periodos.filter(p => p.duracionCiclo != null)
  if (cerrados.length < MIN_CICLOS) return []

  // fecha → { fase, índice del ciclo }
  const mapa = new Map<string, { fase: Phase; ciclo: number }>()
  cerrados.forEach((p, i) => {
    for (let d = 0; d < (p.duracionCiclo ?? 0); d++) {
      mapa.set(sumarDias(p.inicio, d), {
        fase: faseDeDia(Math.min(d + 1, marco.duracion), marco),
        ciclo: i,
      })
    }
  })

  const out: Correlacion[] = []

  for (const serie of series) {
    /* La línea base es SUYA y solo cuenta los días que caen dentro de un ciclo
       conocido. Meter días sueltos de antes del primer periodo compararía la
       fase contra una base medida en otra época. */
    const dentro = Object.entries(serie.valores).filter(([f]) => mapa.has(f))
    if (dentro.length < MIN_OBSERVACIONES * 2) continue

    const base = resumen(dentro.map(([, v]) => v))
    if (!base.media) continue   // una base de cero haría estallar el porcentaje

    for (const phase of PHASE_ORDER) {
      const enFase = dentro.filter(([f]) => mapa.get(f)!.fase === phase)
      if (enFase.length < MIN_OBSERVACIONES) continue

      const ciclos = new Set(enFase.map(([f]) => mapa.get(f)!.ciclo)).size
      if (ciclos < MIN_CICLOS) continue

      const r = resumen(enFase.map(([, v]) => v))
      const efecto = ((r.media - base.media) / base.media) * 100

      /* Error estándar de la media de la fase. Se trata la línea base como
         conocida: es conservador de menos, pero la alternativa —un Welch
         completo contra una base que INCLUYE estos mismos días— tendría el
         problema peor de comparar un grupo consigo mismo. Documentado aquí
         para que nadie lo "arregle" sin saberlo. */
      const se = r.sd / Math.sqrt(r.n)
      const margen = (t90(r.n - 1) * se / base.media) * 100

      out.push({
        metric: serie.metric,
        label: serie.label,
        unidad: serie.unidad,
        phase,
        efectoPct: Math.round(efecto * 10) / 10,
        ciLow: Math.round((efecto - margen) * 10) / 10,
        ciHigh: Math.round((efecto + margen) * 10) / 10,
        n: r.n,
        ciclos,
        media: Math.round(r.media * 10) / 10,
        linaBase: Math.round(base.media * 10) / 10,
        claro: (efecto - margen) * (efecto + margen) > 0,
      })
    }
  }

  // Lo más marcado primero, y siempre lo claro antes que lo dudoso.
  return out.sort((a, b) =>
    Number(b.claro) - Number(a.claro) || Math.abs(b.efectoPct) - Math.abs(a.efectoPct))
}

const NOMBRE_FASE: Record<Phase, string> = {
  menstrual: 'durante la regla',
  folicular: 'en fase folicular',
  ovulatoria: 'en tus días de ovulación',
  lutea: 'en fase lútea',
}

/**
 * La frase.
 *
 * Describe lo observado y no explica el porqué: en estos datos no está. Es la
 * diferencia entre «tu fuerza baja un 8 % en fase lútea» —cierto y
 * comprobable— y «la progesterona reduce tu fuerza» —que puede ser falso y
 * suena a medicina.
 */
export function redactar(c: Correlacion): string {
  const signo = c.efectoPct > 0 ? 'sube' : 'baja'
  const abs = Math.abs(c.efectoPct)
  if (!c.claro) {
    return `${c.label} ${NOMBRE_FASE[c.phase]}: no se ve una diferencia clara respecto a tu media (${c.n} días de ${c.ciclos} ciclos).`
  }
  return `${c.label} ${signo} un ${abs.toFixed(0)} % ${NOMBRE_FASE[c.phase]}, comparado con tu media. Medido en ${c.n} días de ${c.ciclos} ciclos.`
}

/**
 * Qué falta para que una métrica pueda decir algo.
 *
 * Se enseña en vez de la correlación cuando aún no llega, porque un hueco sin
 * explicar parece que la app no funciona.
 */
export function queFalta(serie: Serie, periodos: Periodo[]): string {
  const ciclos = periodos.filter(p => p.duracionCiclo != null).length
  if (ciclos < MIN_CICLOS) {
    return `Hacen falta ${MIN_CICLOS} ciclos cerrados para cruzar esto. Llevas ${ciclos}.`
  }
  const dias = Object.keys(serie.valores).length
  return `Hacen falta al menos ${MIN_OBSERVACIONES} días con dato en cada fase. De ${serie.label.toLowerCase()} llevas ${dias} días registrados en total.`
}
