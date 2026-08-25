/**
 * LO QUE VALE LA PENA MIRAR
 * ═══════════════════════════════════════════════════════════════════════════
 * Patrones que merecen una frase en pantalla y, algunos, una consulta.
 *
 * ── Esto no diagnostica nada ───────────────────────────────────────────────
 * Ni una sola de estas señales nombra una enfermedad. La diferencia entre
 * «tus tres últimos ciclos pasaron de 35 días» y «podrías tener SOP» es la
 * diferencia entre una app de salud y una app que hace daño: la primera es un
 * hecho del propio registro de la usuaria, la segunda es un diagnóstico sin
 * médico, sin analítica y sin ecografía.
 *
 * Por eso cada señal se redacta con lo que se observó y termina, cuando toca,
 * en una pregunta concreta que llevar a consulta. La pregunta es el producto;
 * la etiqueta clínica no lo es.
 *
 * ── Y ninguna se dispara con un solo caso ──────────────────────────────────
 * Un ciclo largo es un mes raro. Tres son un patrón. Avisar del primero
 * convierte la app en una fuente de ansiedad mensual, que es justo el reproche
 * que se le hace a la categoría.
 */

import { diasEntre } from '@/utils/fechas'
import type { Periodo, SangradoIntermenstrual } from './periodos'
import type { Estadisticas } from './prediccion'

export type TipoAnomalia =
  | 'ciclo_corto'
  | 'ciclo_largo'
  | 'irregularidad'
  | 'sangrado_prolongado'
  | 'posible_periodo_sin_registrar'
  | 'intermenstrual'
  | 'retraso'
  | 'ausencia_prolongada'

export interface Anomalia {
  tipo: TipoAnomalia
  /** Qué se observó, en los términos del propio registro. */
  mensaje: string
  /** `informativa` se enseña en la pantalla; `consulta` sugiere ir al médico. */
  nivel: 'informativa' | 'consulta'
  /** Qué preguntar en consulta. Vacío en las informativas. */
  pregunta?: string
}

/** Tres casos hacen un patrón. Uno solo es un mes raro. */
const MINIMO_PARA_PATRON = 3

export interface EntradaAnomalias {
  periodos: Periodo[]
  estadisticas: Estadisticas
  intermenstrual: SangradoIntermenstrual[]
  hoy: string
  /** Día probable del próximo periodo y medio ancho de su banda. */
  diaProbable: string | null
  margenDias: number
}

export function detectarAnomalias(e: EntradaAnomalias): Anomalia[] {
  const out: Anomalia[] = []
  const { periodos, estadisticas: est } = e

  const duraciones = periodos
    .map(p => p.duracionCiclo)
    .filter((d): d is number => d != null)
  const recientes = duraciones.slice(-6)

  const cortos = recientes.filter(d => d < 21).length
  if (cortos >= MINIMO_PARA_PATRON) {
    out.push({
      tipo: 'ciclo_corto',
      nivel: 'consulta',
      mensaje: `${cortos} de tus últimos ${recientes.length} ciclos duraron menos de 21 días.`,
      pregunta: '¿Puede tener que ver con la fase lútea o con algo hormonal?',
    })
  }

  const largos = recientes.filter(d => d > 35 && d <= 60).length
  if (largos >= MINIMO_PARA_PATRON) {
    out.push({
      tipo: 'ciclo_largo',
      nivel: 'consulta',
      mensaje: `${largos} de tus últimos ${recientes.length} ciclos pasaron de 35 días.`,
      pregunta: '¿Merece la pena revisar tiroides o niveles hormonales?',
    })
  }

  if (est.desviacion != null && est.desviacion > 7 && est.usados >= MINIMO_PARA_PATRON) {
    out.push({
      tipo: 'irregularidad',
      nivel: 'informativa',
      mensaje: `Tus ciclos varían unos ${Math.round(est.desviacion)} días entre sí. Con esa variación la predicción no puede ser estrecha.`,
    })
  }

  const prolongados = periodos.slice(-6).filter(p => p.diasSangrado > 8).length
  if (prolongados >= 2) {
    out.push({
      tipo: 'sangrado_prolongado',
      nivel: 'consulta',
      mensaje: `Has registrado ${prolongados} periodos de más de 8 días de sangrado.`,
      pregunta: '¿Es normal para mí o conviene descartar algo?',
    })
  }

  /* Un ciclo del doble de largo que la mediana casi siempre es un periodo que
     no se apuntó, no un ciclo real. Se dice así —«parece que falta uno»— en
     vez de dejar que ensucie las medias en silencio. */
  if (est.mediana != null) {
    const huecos = duraciones.filter(d => d > est.mediana! * 1.8).length
    if (huecos > 0) {
      out.push({
        tipo: 'posible_periodo_sin_registrar',
        nivel: 'informativa',
        mensaje: huecos === 1
          ? 'Hay un salto largo en tu historial: puede que falte un periodo por registrar.'
          : `Hay ${huecos} saltos largos en tu historial: puede que falten periodos por registrar.`,
      })
    }
  }

  const sueltos = e.intermenstrual.filter(s => diasEntre(s.fecha, e.hoy) <= 120)
  if (sueltos.length >= 2) {
    out.push({
      tipo: 'intermenstrual',
      nivel: 'consulta',
      mensaje: `Has registrado sangrado ${sueltos.length} veces fuera del periodo en los últimos meses.`,
      pregunta: '¿Qué puede causar el sangrado entre reglas?',
    })
  }

  const ultimo = periodos[periodos.length - 1]
  if (ultimo) {
    const desde = diasEntre(ultimo.inicio, e.hoy)

    /* El aviso de retraso solo entra cuando se ha pasado del BORDE de la
       banda, no del día central. Avisar al pasar del centro sería avisar la
       mitad de los meses por definición: el centro es, justamente, el punto
       que se supera la mitad de las veces. */
    if (e.diaProbable) {
      const pasados = diasEntre(e.diaProbable, e.hoy)
      if (pasados > e.margenDias && desde < 90) {
        out.push({
          tipo: 'retraso',
          nivel: 'informativa',
          mensaje: `Llevas ${pasados} días desde la fecha probable, más allá del margen de tu predicción.`,
        })
      }
    }

    if (desde >= 90) {
      out.push({
        tipo: 'ausencia_prolongada',
        nivel: 'consulta',
        mensaje: `Llevas ${desde} días sin registrar un periodo.`,
        pregunta: '¿Qué puede explicar una ausencia de regla de este tiempo?',
      })
    }
  }

  return out
}
