/**
 * EL INSIGHT DEL DÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * Una frase, la de hoy, sacada de SU registro.
 *
 * ── Lo que este archivo no hace ────────────────────────────────────────────
 * No hay biblioteca de contenido. Flo, Clue y Ovia enseñan un artículo del día
 * elegido por fase: la misma frase para trescientos ochenta millones de
 * personas, y cualquiera que la lea dos meses seguidos nota que no habla de
 * ella. Eso no es personalización, es un calendario de contenidos.
 *
 * Aquí toda frase sale de sus propios datos y viene con el número de
 * observaciones en que se apoya. Si no hay datos suficientes, la frase honesta
 * es decir qué falta —y esa también sale de sus datos.
 *
 * ── Una sola ───────────────────────────────────────────────────────────────
 * Se devuelve una y no una lista. Tres insights juntos no se leen: se hojean.
 * El orden de prioridad de abajo es, en la práctica, el producto.
 */

import { diasEntre } from '@/utils/fechas'
import type { RegistroDia } from '@/store/cicloStore'
import type { TrackerKind } from '@/features/salud/trackers'
import type { Periodo } from './periodos'
import { type Prediccion, nivelConfianza, confianzaProyectada } from './prediccion'
import type { Anomalia } from './anomalias'
import { detectarCambioTermico, type LecturaTemperatura } from './temperatura'
import { patronesDelCiclo } from './patrones'
import type { MarcoFases } from '@/nucleo/ciclo/fases'
import { diaLargo } from './formato'

export interface Insight {
  texto: string
  /** En cuántas observaciones se apoya. 0 = no es una observación, es un aviso. */
  apoyo: number
  tipo: 'patron' | 'confirmacion' | 'aviso' | 'progreso' | 'fase'
}

/** Ventana alrededor del día de ciclo al buscar patrones. Los ciclos se mueven. */
const HOLGURA = 1

/** Cuántas veces tiene que haber pasado para llamarlo patrón. */
const MINIMO_PATRON = 3

interface Entrada {
  logs: Record<string, RegistroDia>
  periodos: Periodo[]
  prediccion: Prediccion | null
  anomalias: Anomalia[]
  hoy: string
  marco: MarcoFases
}

/**
 * Qué registró en este mismo día de ciclo, en ciclos anteriores.
 *
 * Con holgura de un día: los ciclos no duran siempre lo mismo, y exigir el día
 * exacto dejaría fuera justo los casos que interesan.
 */
function enEsteDiaDeCiclo(
  logs: Record<string, RegistroDia>,
  periodos: Periodo[],
  dia: number,
  excluirUltimo = true,
): RegistroDia[] {
  const anteriores = excluirUltimo ? periodos.slice(0, -1) : periodos
  const out: RegistroDia[] = []
  for (const p of anteriores) {
    for (let d = dia - HOLGURA; d <= dia + HOLGURA; d++) {
      if (d < 1) continue
      const fecha = desplazar(p.inicio, d - 1)
      const reg = logs[fecha]
      if (reg) out.push(reg)
    }
  }
  return out
}

function desplazar(fecha: string, n: number): string {
  const [a, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d) + n * 86_400_000)
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
}

const NOMBRE: Partial<Record<TrackerKind, string>> = {
  dolor: 'dolor', digestion: 'molestias digestivas', piel: 'cambios en la piel',
  energia: 'la energía baja', animo: 'el ánimo bajo', sueno: 'peor sueño',
}

export function insightDelDia(e: Entrada): Insight | null {
  const { logs, periodos, prediccion, anomalias, hoy } = e

  // 1 · Una señal de consulta manda sobre todo lo demás.
  const consulta = anomalias.find(a => a.nivel === 'consulta')
  if (consulta) return { texto: consulta.mensaje, apoyo: 0, tipo: 'aviso' }

  // 2 · Ovulación confirmada por temperatura: es un hecho, no una estimación.
  const lecturas: LecturaTemperatura[] = Object.keys(logs)
    .filter(f => logs[f].temperatura_basal)
    .map(f => ({
      fecha: f,
      celsius: logs[f].temperatura_basal!.celsius,
      disturbed: logs[f].temperatura_basal!.disturbed,
    }))
  const ultimoInicio = periodos[periodos.length - 1]?.inicio
  if (ultimoInicio) {
    const delCiclo = lecturas.filter(l => l.fecha >= ultimoInicio)
    const cambio = detectarCambioTermico(delCiclo)
    if (cambio && diasEntre(cambio.fechaConfirmacion, hoy) <= 10) {
      return {
        texto: `Tu temperatura subió ${cambio.salto.toFixed(2)} °C y se mantuvo tres días: eso confirma que ovulaste alrededor del ${diaLargo(cambio.fechaOvulacion)}.`,
        apoyo: 9,
        tipo: 'confirmacion',
      }
    }
  }

  // 3 · Un patrón suyo repetido en este mismo día de ciclo.
  if (prediccion && periodos.length > MINIMO_PATRON) {
    const previos = enEsteDiaDeCiclo(logs, periodos, prediccion.diaDeCiclo)
    if (previos.length >= MINIMO_PATRON) {
      const cuenta = new Map<TrackerKind, number>()
      for (const r of previos) {
        if (r.dolor?.zones.length) cuenta.set('dolor', (cuenta.get('dolor') ?? 0) + 1)
        if (r.digestion?.tags.length) cuenta.set('digestion', (cuenta.get('digestion') ?? 0) + 1)
        if (r.piel?.tags.length) cuenta.set('piel', (cuenta.get('piel') ?? 0) + 1)
        if (r.energia && r.energia.level <= 2) cuenta.set('energia', (cuenta.get('energia') ?? 0) + 1)
        if (r.animo && r.animo.valence < -0.3) cuenta.set('animo', (cuenta.get('animo') ?? 0) + 1)
      }
      const [mejor] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])
      if (mejor && mejor[1] >= MINIMO_PATRON) {
        return {
          texto: `En tus últimos ciclos registraste ${NOMBRE[mejor[0]] ?? mejor[0]} por estas fechas ${mejor[1]} veces. Hoy es el día ${prediccion.diaDeCiclo}.`,
          apoyo: mejor[1],
          tipo: 'patron',
        }
      }
    }
  }

  /* 4 · Los cuatro patrones con umbral del prompt maestro. Van después del
        patrón por día de ciclo porque aquel es más concreto —«por estas
        fechas»— y antes del aviso de confianza porque una observación suya
        vale más que recordarle otra vez que registre. */
  const [patron] = patronesDelCiclo(logs, periodos, e.marco, hoy)
  if (patron) return { texto: patron.texto, apoyo: patron.apoyo, tipo: 'patron' }

  // 5 · La confianza y cómo subirla. Un número bajo sin salida es ruido.
  if (prediccion && prediccion.confianza < 60) {
    const sube = confianzaProyectada(prediccion.ciclosUsados, null, 2)
    return {
      texto: prediccion.ciclosUsados === 0
        ? 'Todavía no hay ciclos completos que medir, así que la predicción usa una media general y no la tuya. Con dos periodos registrados empieza a ser tuya.'
        : `La predicción se apoya en ${prediccion.ciclosUsados} ${prediccion.ciclosUsados === 1 ? 'ciclo' : 'ciclos'} y su confianza es ${nivelConfianza(prediccion.confianza)}. Con dos ciclos más subiría a cerca del ${sube} %.`,
      apoyo: prediccion.ciclosUsados,
      tipo: 'progreso',
    }
  }

  // 5 · Lo que se sabe de la fase, dicho sobre SU ciclo y no sobre uno de 28.
  if (prediccion) {
    const { marco, diaDeCiclo, fase } = prediccion
    const texto = fase === 'menstrual'
      ? `Día ${diaDeCiclo}. Tus periodos duran de media ${marco.diasPeriodo} días.`
      : fase === 'folicular'
        ? `Día ${diaDeCiclo} de unos ${marco.duracion}. Quedan ${Math.max(0, marco.diaOvulacion - diaDeCiclo)} días para tu ovulación estimada.`
        : fase === 'ovulatoria'
          ? `Estás en los días de tu ovulación estimada, alrededor del día ${marco.diaOvulacion} de tu ciclo.`
          : `Día ${diaDeCiclo}. Tu fase lútea empezó el día ${marco.limites.lutea}.`
    return { texto, apoyo: prediccion.ciclosUsados, tipo: 'fase' }
  }

  return null
}
