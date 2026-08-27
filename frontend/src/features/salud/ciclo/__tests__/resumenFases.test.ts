/**
 * LAS REGLAS DEL BLOQUE 5
 * ═══════════════════════════════════════════════════════════════════════════
 * Mínimos por métrica, ánimo por moda y tendencia con umbral. Las tres son
 * reglas exactas del prompt maestro, así que se prueban como tales.
 */

import {
  resumenPorFase, tendenciaMensual, MINIMO_DIAS_FASE, UMBRAL_TENDENCIA,
} from '../resumenFases'
import { marcoFases } from '@/nucleo/ciclo/fases'

const marco = marcoFases(28, 5)   // menstrual 1-5, folicular 6-14, ovul 15, lútea 16-28
const periodos = [{ inicio: '2026-01-01' }]
const resumen = (logs: Record<string, Record<string, unknown>>) =>
  resumenPorFase(logs, '2026-01-01', '2026-12-31', periodos, marco)

const energiaEn = (dias: number[], level: number) =>
  Object.fromEntries(dias.map(d =>
    [`2026-01-${String(d).padStart(2, '0')}`, { energia: { level } }]))

describe('el mínimo de días por fase', () => {
  it(`con ${MINIMO_DIAS_FASE - 1} días no dice nada de la fase`, () => {
    const r = resumen(energiaEn([16, 17], 1))
    expect(r.lutea.energia).toBeNull()
    // Pero el día sí se contó: el hueco es por muestra, no porque falten datos.
    expect(r.lutea.dias).toBe(2)
  })

  it(`con ${MINIMO_DIAS_FASE} días ya se dice`, () => {
    const r = resumen(energiaEn([16, 17, 18], 2))
    expect(r.lutea.energia).toEqual({ media: 2, n: 3 })
  })

  it('cada métrica lleva su propio mínimo', () => {
    /* Tres días de energía y solo dos de ánimo en la misma fase: la energía
       sale y el ánimo no. Un mínimo único por fase habría enseñado los dos. */
    const r = resumen({
      '2026-01-16': { energia: { level: 3 }, animo: { valence: 0.8, arousal: 0.4 } },
      '2026-01-17': { energia: { level: 3 }, animo: { valence: 0.8, arousal: 0.4 } },
      '2026-01-18': { energia: { level: 3 } },
    })
    expect(r.lutea.energia).not.toBeNull()
    expect(r.lutea.animo).toBeNull()
  })
})

describe('el ánimo se cuenta, nunca se promedia', () => {
  it('tres «feliz» y dos «triste» dan «feliz», no el punto medio', () => {
    /* La media de las valencias (0.8·3 + −0.8·2) / 5 = 0.16 y la de las
       activaciones (0.4·3 + −0.4·2) / 5 = 0.08 caen sobre «sensible»
       (−0.2, 0.2), que es un ánimo que no tuvo ni un solo día. */
    const feliz = { valence: 0.8, arousal: 0.4 }
    const triste = { valence: -0.8, arousal: -0.4 }
    const r = resumen({
      '2026-01-16': { animo: feliz },
      '2026-01-17': { animo: feliz },
      '2026-01-18': { animo: feliz },
      '2026-01-19': { animo: triste },
      '2026-01-20': { animo: triste },
    })
    expect(r.lutea.animo?.id).toBe('feliz')
    expect(r.lutea.animo?.id).not.toBe('sensible')
    expect(r.lutea.animo).toMatchObject({ n: 3, de: 5, etiqueta: 'Feliz' })
  })

  it('un punto intermedio del pad cae en el ánimo más cercano', () => {
    const r = resumen({
      '2026-01-16': { animo: { valence: 0.75, arousal: 0.35 } },
      '2026-01-17': { animo: { valence: 0.82, arousal: 0.45 } },
      '2026-01-18': { animo: { valence: 0.79, arousal: 0.38 } },
    })
    expect(r.lutea.animo?.id).toBe('feliz')
  })
})

describe('los antojos', () => {
  it('un día con tres antojos cuenta una vez en el denominador', () => {
    const r = resumen({
      '2026-01-16': { antojos: { tags: ['dulce', 'salado', 'grasas'] } },
      '2026-01-17': { antojos: { tags: ['dulce'] } },
      '2026-01-18': { antojos: { tags: ['dulce'] } },
    })
    // Tres días con antojos, y «dulce» en los tres.
    expect(r.lutea.antojo).toMatchObject({ id: 'dulce', n: 3, de: 3, etiqueta: 'Dulce' })
  })

  it('el mismo antojo repetido en un día no se cuenta dos veces', () => {
    const r = resumen({
      '2026-01-16': { antojos: { tags: ['dulce', 'dulce'] } },
      '2026-01-17': { antojos: { tags: ['salado'] } },
      '2026-01-18': { antojos: { tags: ['salado'] } },
    })
    expect(r.lutea.antojo).toMatchObject({ id: 'salado', n: 2, de: 3 })
  })
})

describe('cada día cae en su fase', () => {
  it('reparte menstrual, folicular, ovulatoria y lútea', () => {
    const r = resumen({
      ...energiaEn([1, 2, 3], 1),        // menstrual
      ...energiaEn([6, 7, 8], 5),        // folicular
      ...energiaEn([16, 17, 18], 2),     // lútea
    })
    expect(r.menstrual.energia?.media).toBe(1)
    expect(r.folicular.energia?.media).toBe(5)
    expect(r.lutea.energia?.media).toBe(2)
    expect(r.ovulatoria.energia).toBeNull()
  })

  it('los días anteriores al primer periodo se descartan', () => {
    const r = resumen(energiaEn([], 3))
    const antes = resumenPorFase(
      { '2025-12-20': { energia: { level: 5 } } },
      '2025-01-01', '2026-12-31', periodos, marco)
    expect(r.menstrual.dias).toBe(0)
    expect(antes.menstrual.dias + antes.folicular.dias
      + antes.ovulatoria.dias + antes.lutea.dias).toBe(0)
  })
})

describe(`la tendencia, con umbral de ${UMBRAL_TENDENCIA}`, () => {
  const mes = (m: string, niveles: number[]) => Object.fromEntries(
    niveles.map((level, i) =>
      [`2026-${m}-${String(i + 1).padStart(2, '0')}`, { energia: { level } }]))

  it('sube cuando el salto pasa del umbral', () => {
    const t = tendenciaMensual(
      { ...mes('01', [2, 2, 2]), ...mes('02', [3, 3, 3]) }, 'energia', '2026-12-31')
    expect(t).toMatchObject({ sentido: 'sube', delta: 1, meses: ['2026-01', '2026-02'] })
  })

  it('baja cuando cae por debajo del umbral negativo', () => {
    const t = tendenciaMensual(
      { ...mes('01', [4, 4, 4]), ...mes('02', [2, 2, 2]) }, 'energia', '2026-12-31')
    expect(t?.sentido).toBe('baja')
  })

  it('medio punto justo NO es tendencia', () => {
    // 3 → 3.5 es exactamente el umbral, y el umbral no cuenta: hace falta pasarlo.
    const t = tendenciaMensual(
      { ...mes('01', [3, 3, 3, 3]), ...mes('02', [3, 3, 4, 4]) }, 'energia', '2026-12-31')
    expect(t?.delta).toBeCloseTo(0.5)
    expect(t?.sentido).toBe('igual')
  })

  it('un mes con menos de tres registros no se compara', () => {
    /* Febrero solo tiene dos días. Si se comparara, el salto de 2 a 5 saldría
       como una subida enorme que solo dice que ese mes apuntó menos. */
    const t = tendenciaMensual(
      { ...mes('01', [2, 2, 2]), ...mes('02', [5, 5]) }, 'energia', '2026-12-31')
    expect(t).toBeNull()
  })

  it('sin dos meses con muestra, no hay tendencia', () => {
    expect(tendenciaMensual(mes('01', [3, 3, 3]), 'energia', '2026-12-31')).toBeNull()
  })
})
