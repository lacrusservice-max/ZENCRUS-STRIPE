/**
 * LOS CUATRO PATRONES
 * ═══════════════════════════════════════════════════════════════════════════
 * Las cuatro observaciones que el prompt maestro autoriza a enseñar, con sus
 * umbrales exactos. Nada más se dice: si ninguna llega a su umbral, la
 * pantalla se calla, que es una respuesta perfectamente buena.
 *
 * ── Por qué los umbrales son tan altos ─────────────────────────────────────
 * Un patrón que se enseña se convierte en una creencia. «En lútea te pones
 * irritable» leído una vez ya no se olvida, y a partir de ahí cada mal día en
 * lútea lo confirma y cada buen día no cuenta. Por eso hacen falta tres ciclos
 * y no dos, y el 65 % y no la mayoría simple: el coste de un patrón falso no
 * es un número mal puesto, es que ella lo lleve encima durante meses.
 *
 * ── Se devuelve el mejor apoyado, no el primero ────────────────────────────
 * Los cuatro se calculan siempre y compiten por el mismo hueco. Ordenarlos por
 * cuántas observaciones los sostienen evita el sesgo del orden: si se
 * devolviera el primero que pasa el umbral, un síntoma visto cinco veces
 * taparía un antojo visto en nueve ciclos solo por estar antes en el fichero.
 */

import { faseDeDia, type MarcoFases } from '@/nucleo/ciclo/fases'
import { PHASE_ORDER, type Phase } from './fases'
import { FASE } from '@/theme/salud/cicloClaro'
import { animoMasCercano, ANIMOS } from './animos'
import { marcasDelDia } from './sintomas'
import { resumenPorFase, MINIMO_DIAS_FASE } from './resumenFases'
import { diasEntre } from '@/utils/fechas'

/** Cuánto tiene que repetirse un síntoma dentro de una fase. */
export const UMBRAL_SINTOMA = 0.65
/** Y sobre cuántos días registrados como mínimo. */
export const MINIMO_DIAS_SINTOMA_FASE = 5
/** Diferencia de energía entre dos fases que ya significa algo. */
export const UMBRAL_ENERGIA = 1.2
/** Cuánto tiene que repetirse un antojo en la ventana premenstrual. */
export const UMBRAL_ANTOJO = 0.6
/** Cuántos días antes del periodo se miran. */
export const DIAS_PREMENSTRUALES = 3
/** Cuántos ciclos hacen falta para llamarlo patrón. */
export const MINIMO_CICLOS = 3

export interface Patron {
  texto: string
  /** En cuántas observaciones se apoya. */
  apoyo: number
  clave: 'sintoma' | 'energia' | 'antojo' | 'animo'
}

type Diario = Record<string, Record<string, unknown>>

const ANTOJO_ET: Record<string, string> = {
  dulce: 'dulce', salado: 'salado', carbohidratos: 'carbohidratos',
  grasas: 'grasas', proteinas: 'proteínas', citricos: 'cítricos', otro: 'otro',
}

const fase = (f: Phase) => FASE[f].etiqueta.toLowerCase()

function desplazar(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d) + n * 86_400_000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`
    + `-${String(t.getUTCDate()).padStart(2, '0')}`
}

/** La fase de una fecha, o `null` si cae fuera de cualquier ciclo conocido. */
function faseDe(fecha: string, inicios: string[], marco: MarcoFases): Phase | null {
  const inicio = [...inicios].reverse().find(i => i <= fecha)
  if (!inicio) return null
  const d = diasEntre(inicio, fecha) + 1
  if (d < 1 || d > marco.duracion + 7) return null
  return faseDeDia(((d - 1) % marco.duracion) + 1, marco)
}

/* ── 1 · Un síntoma que se repite dentro de una fase ─────────────────────── */

function patronSintoma(logs: Diario, inicios: string[], marco: MarcoFases): Patron | null {
  const dias: Record<Phase, number> = { menstrual: 0, folicular: 0, ovulatoria: 0, lutea: 0 }
  const cuenta: Record<Phase, Map<string, number>> = {
    menstrual: new Map(), folicular: new Map(), ovulatoria: new Map(), lutea: new Map(),
  }

  for (const [fecha, dia] of Object.entries(logs)) {
    const f = faseDe(fecha, inicios, marco)
    if (!f) continue
    dias[f]++
    for (const m of marcasDelDia(dia)) cuenta[f].set(m, (cuenta[f].get(m) ?? 0) + 1)
  }

  let mejor: Patron | null = null
  for (const f of PHASE_ORDER) {
    if (dias[f] < MINIMO_DIAS_SINTOMA_FASE) continue
    for (const [sintoma, n] of cuenta[f]) {
      const pct = n / dias[f]
      if (pct < UMBRAL_SINTOMA) continue
      if (mejor && n <= mejor.apoyo) continue
      mejor = {
        texto: `Registras ${sintoma.toLowerCase()} en el ${Math.round(pct * 100)} % de tus `
          + `días de fase ${fase(f)} (${n} de ${dias[f]}).`,
        apoyo: n,
        clave: 'sintoma',
      }
    }
  }
  return mejor
}

/* ── 2 · La energía cambia de verdad entre dos fases ─────────────────────── */

function patronEnergia(
  logs: Diario, periodos: { inicio: string }[], marco: MarcoFases, hasta: string,
): Patron | null {
  const r = resumenPorFase(logs, '0000-01-01', hasta, periodos, marco)
  const conDato = PHASE_ORDER
    .map(f => ({ f, e: r[f].energia }))
    .filter((x): x is { f: Phase; e: { media: number; n: number } } => x.e !== null)
  if (conDato.length < 2) return null

  const alta = conDato.reduce((a, b) => (b.e.media > a.e.media ? b : a))
  const baja = conDato.reduce((a, b) => (b.e.media < a.e.media ? b : a))
  const dif = alta.e.media - baja.e.media
  if (dif < UMBRAL_ENERGIA) return null

  return {
    texto: `Tu energía en fase ${fase(alta.f)} está ${dif.toFixed(1)} puntos por encima `
      + `de la de fase ${fase(baja.f)}.`,
    apoyo: alta.e.n + baja.e.n,
    clave: 'energia',
  }
}

/* ── 3 · Antojos en los días previos al periodo ──────────────────────────── */

/**
 * Se miran los tres días ANTES de cada inicio de periodo, ciclo por ciclo.
 *
 * Un ciclo cuenta para un antojo si ese antojo salió en al menos el 60 % de
 * los días de esa ventana que ella registró. El denominador son los días
 * registrados y no los tres días siempre: con un solo día apuntado, ese día
 * decide el ciclo, que es más honesto que dar el ciclo por perdido y también
 * más honesto que dividir entre tres y llamarlo 33 %.
 */
function patronAntojo(logs: Diario, inicios: string[]): Patron | null {
  const ciclosPorAntojo = new Map<string, number>()

  for (const inicio of inicios) {
    const conRegistro: Set<string>[] = []
    for (let d = 1; d <= DIAS_PREMENSTRUALES; d++) {
      const dia = logs[desplazar(inicio, -d)]
      const tags = (dia?.antojos as { tags?: string[] } | undefined)?.tags
      if (dia && tags) conRegistro.push(new Set(tags))
    }
    if (!conRegistro.length) continue

    const enEsteCiclo = new Set<string>()
    for (const t of new Set(conRegistro.flatMap(s => [...s]))) {
      const veces = conRegistro.filter(s => s.has(t)).length
      if (veces / conRegistro.length >= UMBRAL_ANTOJO) enEsteCiclo.add(t)
    }
    for (const t of enEsteCiclo) {
      ciclosPorAntojo.set(t, (ciclosPorAntojo.get(t) ?? 0) + 1)
    }
  }

  let mejor: { tag: string; n: number } | null = null
  for (const [tag, n] of ciclosPorAntojo) {
    if (n >= MINIMO_CICLOS && (!mejor || n > mejor.n)) mejor = { tag, n }
  }
  if (!mejor) return null

  return {
    texto: `En los ${DIAS_PREMENSTRUALES} días antes de tu periodo te dan antojos de `
      + `${ANTOJO_ET[mejor.tag] ?? mejor.tag}: ha pasado en ${mejor.n} de tus ciclos.`,
    apoyo: mejor.n,
    clave: 'antojo',
  }
}

/* ── 4 · El mismo ánimo, en la misma fase, ciclo tras ciclo ──────────────── */

function patronAnimo(logs: Diario, inicios: string[], marco: MarcoFases): Patron | null {
  /* Se agrupa por ciclo y fase, y de cada pareja sale UN ánimo dominante. Sin
     agrupar por ciclo, una sola semana muy irritable con siete registros
     bastaría para hablar de «ciclo tras ciclo» sin haber visto más que uno. */
  const porCiclo = new Map<string, Map<Phase, Map<string, number>>>()

  for (const [fecha, dia] of Object.entries(logs)) {
    const animo = dia.animo as { valence?: number; arousal?: number } | undefined
    if (typeof animo?.valence !== 'number' || typeof animo.arousal !== 'number') continue
    const inicio = [...inicios].reverse().find(i => i <= fecha)
    if (!inicio) continue
    const f = faseDe(fecha, inicios, marco)
    if (!f) continue

    const delCiclo = porCiclo.get(inicio) ?? new Map<Phase, Map<string, number>>()
    const deFase = delCiclo.get(f) ?? new Map<string, number>()
    const cual = animoMasCercano(animo.valence, animo.arousal).id
    deFase.set(cual, (deFase.get(cual) ?? 0) + 1)
    delCiclo.set(f, deFase)
    porCiclo.set(inicio, delCiclo)
  }

  const veces = new Map<string, number>()   // `fase|animo` → ciclos
  for (const delCiclo of porCiclo.values()) {
    for (const [f, deFase] of delCiclo) {
      const orden = [...deFase.entries()].sort((a, b) => b[1] - a[1])
      // Un empate no tiene dominante, y elegir uno sería elegirlo al azar.
      if (orden.length > 1 && orden[0][1] === orden[1][1]) continue
      const k = `${f}|${orden[0][0]}`
      veces.set(k, (veces.get(k) ?? 0) + 1)
    }
  }

  let mejor: { k: string; n: number } | null = null
  for (const [k, n] of veces) {
    if (n >= MINIMO_CICLOS && (!mejor || n > mejor.n)) mejor = { k, n }
  }
  if (!mejor) return null

  const [f, animoId] = mejor.k.split('|')
  const etiqueta = ANIMOS.find(a => a.id === animoId)?.etiqueta.toLowerCase() ?? animoId
  return {
    texto: `En fase ${fase(f as Phase)} te sientes sobre todo ${etiqueta}: `
      + `se ha repetido en ${mejor.n} ciclos.`,
    apoyo: mejor.n,
    clave: 'animo',
  }
}

/* ── Todos, ordenados por cuánto los sostiene ────────────────────────────── */

export function patronesDelCiclo(
  logs: Diario,
  periodos: { inicio: string }[],
  marco: MarcoFases,
  hasta: string,
): Patron[] {
  const inicios = periodos.map(p => p.inicio).sort()
  if (!inicios.length) return []

  return [
    patronAntojo(logs, inicios),
    patronAnimo(logs, inicios, marco),
    patronSintoma(logs, inicios, marco),
    patronEnergia(logs, periodos, marco, hasta),
  ].filter((p): p is Patron => p !== null)
    .sort((a, b) => b.apoyo - a.apoyo)
}

export { MINIMO_DIAS_FASE }
