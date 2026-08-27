/**
 * LA FRASE DE ARRIBA
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo primero que se lee al abrir el ciclo. Ocho condiciones, evaluadas en
 * orden: la primera que se cumple gana.
 *
 * ── Va sobre HOY, nunca sobre el día que toque la burbuja ──────────────────
 * La rueda se puede arrastrar para mirar cualquier día del ciclo, y el texto
 * del centro sí cambia con ella. Esta frase NO. Es el estado real del cuerpo
 * hoy, y si se moviera al explorar, bastaría dejar la burbuja en el día 20 para
 * leer «estás en tu ventana fértil» un día que no lo estás.
 *
 * ── El orden no es decorativo, es prioridad clínica ────────────────────────
 * Sangrar hoy manda sobre todo lo demás: si está sangrando, da igual lo que
 * dijera la predicción. Después el retraso, porque es lo que más preocupa.
 * Después lo inminente. Y solo al final, cuando no pasa nada reseñable, se dice
 * en qué fase está.
 *
 * ── Se recalcula en tres momentos ──────────────────────────────────────────
 * Al abrir la app, al cruzar la medianoche y tras cada guardado. Los tres
 * importan: sin el segundo, quien deja la app abierta amanece leyendo la frase
 * de ayer.
 */

import type { MarcoFases } from '@/nucleo/ciclo/fases'
import { enVentanaFertil, faseDeDia } from '@/nucleo/ciclo/fases'

export type ClaveFrase =
  | 'sangrando'
  | 'retraso'
  | 'deberia_hoy'
  | 'inminente'
  | 'pico_fertil'
  | 'ventana_fertil'
  | 'folicular'
  | 'lutea'
  | 'sin_datos'

export interface FraseDelDia {
  clave: ClaveFrase
  texto: string
  /** Para pintarla con el color de la fase o del estado que corresponda. */
  tono: 'menstrual' | 'alerta' | 'fertil' | 'neutro'
}

export interface EntradaFrase {
  /** Nivel de sangrado registrado HOY, o null. ≥1 cuenta como sangrando. */
  sangradoHoy: number | null
  /** Día de sangrado dentro del periodo en curso, si está sangrando. */
  diaDePeriodo: number | null
  /** Día de ciclo de hoy. `null` si no hay periodo del que contar. */
  diaDeCiclo: number | null
  /** Días hasta el inicio previsto. Negativo = ya pasó. `null` sin predicción. */
  diasParaLaRegla: number | null
  marco: MarcoFases | null
}

/** Cuántos días antes se considera «inminente». */
const INMINENTE = 5

export function fraseDelDia(e: EntradaFrase): FraseDelDia {
  /* 1 · Sangrando hoy. Gana siempre: es un hecho observado, no una estimación,
         y contradecirlo con una predicción sería absurdo. */
  if ((e.sangradoHoy ?? 0) >= 1) {
    const d = e.diaDePeriodo ?? 1
    return {
      clave: 'sangrando',
      texto: `Día ${d} de tu periodo`,
      tono: 'menstrual',
    }
  }

  if (e.diasParaLaRegla === null || !e.marco || e.diaDeCiclo === null) {
    return {
      clave: 'sin_datos',
      texto: 'Registra tu sangrado y empiezo a predecir',
      tono: 'neutro',
    }
  }

  const faltan = e.diasParaLaRegla

  // 2 · Ya pasó la fecha estimada y no hay sangrado registrado.
  if (faltan < 0) {
    const n = -faltan
    return {
      clave: 'retraso',
      texto: `Tu periodo está retrasado ${n} ${n === 1 ? 'día' : 'días'}`,
      tono: 'alerta',
    }
  }

  // 3 · Justo hoy.
  if (faltan === 0) {
    return {
      clave: 'deberia_hoy',
      texto: 'Tu periodo debería comenzar hoy',
      tono: 'menstrual',
    }
  }

  // 4 · A la vuelta de la esquina.
  if (faltan <= INMINENTE) {
    return {
      clave: 'inminente',
      texto: faltan === 1
        ? 'Mañana comienza tu periodo'
        : `A ${faltan} días de tu próximo periodo`,
      tono: 'menstrual',
    }
  }

  // 5 · El día de la ovulación estimada.
  if (e.diaDeCiclo === e.marco.diaOvulacion) {
    return { clave: 'pico_fertil', texto: 'Hoy es tu día más fértil', tono: 'fertil' }
  }

  // 6 · Dentro de la ventana.
  if (enVentanaFertil(e.diaDeCiclo, e.marco)) {
    return { clave: 'ventana_fertil', texto: 'Estás en tu ventana fértil', tono: 'fertil' }
  }

  // 7 y 8 · Sin nada reseñable, se dice la fase y ya está.
  const fase = faseDeDia(e.diaDeCiclo, e.marco)
  if (fase === 'folicular') {
    return { clave: 'folicular', texto: 'Fase folicular', tono: 'neutro' }
  }
  return { clave: 'lutea', texto: 'Fase lútea', tono: 'neutro' }
}
