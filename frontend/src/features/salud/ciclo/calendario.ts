/**
 * EL CALENDARIO, DÍA A DÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * Convierte el estado del ciclo en una rejilla de días pintables. Lógica pura:
 * la pantalla solo dibuja lo que decide este archivo.
 *
 * ── Lo confirmado y lo predicho no se pintan igual ─────────────────────────
 * Es la regla que sostiene la vista. Un día de sangrado registrado es un
 * hecho; un día de sangrado previsto es una apuesta. Si los dos se pintan con
 * el mismo relleno, el calendario convierte suposiciones en historial —y la
 * propia app acaba aprendiendo de sus predicciones en vez de del cuerpo.
 * Confirmado va relleno; predicho va en contorno.
 *
 * ── El cono de la predicción ───────────────────────────────────────────────
 * Al mirar dos o tres ciclos por delante, la incertidumbre se acumula: cada
 * salto arrastra el error del anterior. La banda crece con √k, como se abre el
 * cono de una previsión meteorológica. Las demás apps pintan el mes doce igual
 * de firme que el mes uno, y eso es sencillamente falso.
 */

import { sumarDias, diasEntre } from '@/utils/fechas'
import type { Phase } from './fases'
import type { RegistroDia } from '@/store/cicloStore'
import { SANGRADO_MINIMO, type Periodo } from './periodos'
import { faseDeDia, type MarcoFases, type Prediccion } from './prediccion'
import { diaSemana } from './formato'

/** Hasta dónde se proyecta. Más allá, la banda es tan ancha que no informa. */
const CICLOS_PROYECTADOS = 3

export interface DiaCalendario {
  fecha: string
  /** Día del mes. */
  numero: number
  /** `false` en los días de relleno del principio y el final de la rejilla. */
  delMes: boolean
  hoy: boolean
  futuro: boolean

  diaDeCiclo: number | null
  fase: Phase | null

  /** Nivel de sangrado registrado, si lo hay. Es un hecho. */
  sangrado: number | null
  /** Día dentro de un periodo previsto. Es una apuesta. */
  periodoPredicho: boolean
  /** Día dentro de la banda de incertidumbre del inicio previsto. */
  bandaPrediccion: boolean

  ovulacionPredicha: boolean
  fertil: boolean

  /** Cuántos trackers se registraron ese día. Pinta el punto de actividad. */
  registros: number
}

export interface Mes {
  año: number
  mes: number            // 1–12
  /** 42 celdas: seis semanas completas, para que la rejilla no salte de alto. */
  dias: DiaCalendario[]
}

interface Entrada {
  año: number
  mes: number
  logs: Record<string, RegistroDia>
  periodos: Periodo[]
  prediccion: Prediccion | null
  marco: MarcoFases
  hoy: string
}

/**
 * Inicios de periodo previstos, con su banda creciente.
 *
 * El primero sale del motor; los siguientes se encadenan sumando la duración
 * media, y cada uno hereda la incertidumbre acumulada de los anteriores.
 */
function proyectar(p: Prediccion, marco: MarcoFases) {
  const out: Array<{ inicio: string; margen: number }> = []
  let fecha = p.proximoPeriodo.likely
  for (let k = 1; k <= CICLOS_PROYECTADOS; k++) {
    out.push({ inicio: fecha, margen: Math.round(p.margenDias * Math.sqrt(k)) })
    fecha = sumarDias(fecha, marco.duracion)
  }
  return out
}

export function construirMes(e: Entrada): Mes {
  const { año, mes, logs, periodos, prediccion, marco, hoy } = e

  const primero = `${año}-${String(mes).padStart(2, '0')}-01`
  const desplazamiento = diaSemana(primero)         // 0 = lunes
  const inicioRejilla = sumarDias(primero, -desplazamiento)

  const previstos = prediccion ? proyectar(prediccion, marco) : []

  const dias: DiaCalendario[] = []
  for (let i = 0; i < 42; i++) {
    const fecha = sumarDias(inicioRejilla, i)
    const [a, m, d] = fecha.split('-').map(Number)
    const delMes = a === año && m === mes
    const futuro = fecha > hoy

    const reg = logs[fecha]
    const sangrado = reg?.sangrado?.level ?? null

    // ── Dónde cae dentro de un ciclo ────────────────────────────────────
    let diaDeCiclo: number | null = null
    for (let k = periodos.length - 1; k >= 0; k--) {
      const delta = diasEntre(periodos[k].inicio, fecha)
      if (delta >= 0) {
        /* Solo se cuenta como parte de ese ciclo si no se ha ido demasiado
           lejos. Un día a noventa días del último periodo no es «día 91»: es
           un día del que el módulo no sabe nada, y decirlo es mejor que
           dibujar un número que nadie puede interpretar. */
        if (delta <= marco.duracion * 2) diaDeCiclo = delta + 1
        break
      }
    }

    // ── Y en los meses que aún no han llegado ───────────────────────────
    if (diaDeCiclo == null && futuro && previstos.length) {
      for (let k = previstos.length - 1; k >= 0; k--) {
        const delta = diasEntre(previstos[k].inicio, fecha)
        if (delta >= 0 && delta < marco.duracion) { diaDeCiclo = delta + 1; break }
      }
    }

    const fase = diaDeCiclo != null
      ? faseDeDia(Math.min(diaDeCiclo, marco.duracion), marco)
      : null

    // ── Predicción ──────────────────────────────────────────────────────
    let periodoPredicho = false
    let bandaPrediccion = false
    for (const pv of previstos) {
      const delta = diasEntre(pv.inicio, fecha)
      if (delta >= 0 && delta < marco.diasPeriodo) periodoPredicho = true
      if (Math.abs(delta) <= pv.margen && delta < marco.diasPeriodo) bandaPrediccion = true
    }
    /* Lo registrado gana siempre: si ya sangró ese día, no se pinta como
       previsión. La app no compite con el cuerpo. */
    if (sangrado != null && sangrado >= SANGRADO_MINIMO) {
      periodoPredicho = false
      bandaPrediccion = false
    }

    const ovulacionPredicha = !!prediccion?.ovulacion && fecha === prediccion.ovulacion.likely
    const fertil = !!prediccion?.ventanaFertil
      && fecha >= prediccion.ventanaFertil.inicio
      && fecha <= prediccion.ventanaFertil.fin

    dias.push({
      fecha,
      numero: d,
      delMes,
      hoy: fecha === hoy,
      futuro,
      diaDeCiclo,
      fase,
      sangrado,
      periodoPredicho,
      bandaPrediccion,
      ovulacionPredicha,
      fertil,
      registros: reg ? Object.keys(reg).length : 0,
    })

    if (i === 41) break
  }

  return { año, mes, dias }
}

/** El mes anterior y el siguiente, sin aritmética de `Date`. */
export const mesAnterior = (año: number, mes: number) =>
  mes === 1 ? { año: año - 1, mes: 12 } : { año, mes: mes - 1 }

export const mesSiguiente = (año: number, mes: number) =>
  mes === 12 ? { año: año + 1, mes: 1 } : { año, mes: mes + 1 }
