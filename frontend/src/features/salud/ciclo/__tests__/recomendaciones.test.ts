/**
 * LAS REGLAS DE LA RECOMENDACIÓN DIARIA
 * ═══════════════════════════════════════════════════════════════════════════
 * Las tres que de verdad deciden qué lee: lo registrado gana a la fase, la
 * energía gana a las dos, y nada se inventa cuando no hay nada que decir.
 */

import {
  recomendacionDelDia, sintomasDelDia, alertasDelDia, semillaDeFecha,
  PRIORIDAD, SINTOMA_POR_ID, ENERGIA_BAJA, dentroDeFase,
  type EntradaRecomendacion,
} from '@/nucleo/ciclo/recomendaciones'
import { marcoFases } from '@/nucleo/ciclo/fases'


const base: Omit<EntradaRecomendacion, 'fase'> = {
  dia: {},
  energia: null,
  anticonceptivo: null,
  semilla: 7,
}

const reco = (extra: Partial<EntradaRecomendacion> = {}) =>
  recomendacionDelDia({ fase: 'folicular', ...base, ...extra })

const dolorEn = (id: string, intensity = 5) => ({ dolor: { zones: [{ id, intensity }] } })

describe('lo registrado gana a la fase', () => {
  it('sin nada registrado, habla de la fase', () => {
    const r = reco()
    expect(r.nutricion.motivo).toBe('fase')
    expect(r.nutricion.fuente).toBe('folicular')
    expect(r.entrenamiento.motivo).toBe('fase')
  })

  it('con cólicos registrados, habla de los cólicos', () => {
    const r = reco({ dia: dolorEn('abdomen_bajo') })
    expect(r.nutricion).toMatchObject({ motivo: 'sintoma', fuente: 'colicos' })
    expect(r.entrenamiento).toMatchObject({ motivo: 'sintoma', fuente: 'colicos' })
  })

  it('los antojos se distinguen de los síntomas', () => {
    const r = reco({ dia: { antojos: { tags: ['dulce'] } } })
    expect(r.nutricion).toMatchObject({ motivo: 'antojo', fuente: 'antojos' })
  })

  it('con varios síntomas gana el que más condiciona el día', () => {
    /* Cólicos y acné el mismo día: quien abre la app doblada no quiere leer
       sobre el zinc. El orden está en PRIORIDAD y es explícito. */
    const r = reco({ dia: { ...dolorEn('abdomen_bajo'), piel: { tags: ['acne'] } } })
    expect(r.nutricion.fuente).toBe('colicos')
    expect(PRIORIDAD.indexOf('colicos')).toBeLessThan(PRIORIDAD.indexOf('acne'))
  })
})

describe('la energía gana a la fase', () => {
  it(`con energía ${ENERGIA_BAJA} no se sugiere intensidad ni en ovulación`, () => {
    const r = reco({ fase: 'ovulatoria', energia: ENERGIA_BAJA, dia: { energia: { level: ENERGIA_BAJA } } })
    expect(r.entrenamiento.fuente).toBe('fatiga')
    expect(r.entrenamiento.fuente).not.toBe('ovulatoria')
  })

  it('con energía alta, la ovulación sí admite intensidad', () => {
    const r = reco({ fase: 'ovulatoria', energia: 5, dia: { energia: { level: 5 } } })
    expect(r.entrenamiento).toMatchObject({ motivo: 'fase', fuente: 'ovulatoria' })
  })

  it('un síntoma con recomendación propia sigue mandando sobre la fatiga', () => {
    /* Dolor de cabeza con energía baja sigue siendo, sobre todo, dolor de
       cabeza: lo que no hay que hacer hoy es intensidad, y eso lo dicen las
       dos fichas, pero la de cabeza además dice por qué. */
    const r = reco({
      fase: 'ovulatoria', energia: 1,
      dia: { ...dolorEn('cabeza'), energia: { level: 1 } },
    })
    expect(r.entrenamiento.fuente).toBe('cabeza')
  })
})

describe('nada se inventa', () => {
  it('la libido sola cae a la fase, porque no tiene nada con respaldo', () => {
    const r = reco({ dia: { libido: { desire: 1 } } })
    expect(sintomasDelDia({ libido: { desire: 1 } })).toContain('libido')
    expect(SINTOMA_POR_ID.get('libido')?.ejemplos).toHaveLength(0)
    expect(r.nutricion.motivo).toBe('fase')
  })

  it('la retención no se detecta desde el registro, y es a propósito', () => {
    /* No hay ningún campo que la exprese. Colgarla de «hinchazón» sería
       decidir por ella que son la misma cosa. La ficha sigue existiendo para
       el chat, donde sí puede mencionarla con sus palabras. */
    expect(SINTOMA_POR_ID.has('retencion')).toBe(true)
    expect(sintomasDelDia({ digestion: { tags: ['hinchazon'] } })).not.toContain('retencion')
  })

  it('sin anticoncepción no se añade la nota', () => {
    expect(reco().nota).toBeNull()
    expect(reco({ anticonceptivo: 'píldora' }).nota).toContain('no sigue las subidas')
  })
})

describe('los ejemplos rotan, pero no dentro del mismo día', () => {
  it('la misma semilla da siempre lo mismo', () => {
    const a = reco({ dia: dolorEn('abdomen_bajo'), semilla: 42 })
    const b = reco({ dia: dolorEn('abdomen_bajo'), semilla: 42 })
    expect(a.nutricion.texto).toBe(b.nutricion.texto)
  })

  it('días distintos dan ejemplos distintos', () => {
    const textos = new Set(
      [0, 1, 2, 3].map(n => reco({ dia: dolorEn('abdomen_bajo'), semilla: n }).nutricion.texto))
    expect(textos.size).toBeGreaterThan(1)
  })

  it('la semilla sale de la fecha y no de la zona horaria', () => {
    expect(semillaDeFecha('2026-08-27')).toBe(semillaDeFecha('2026-08-27'))
    expect(semillaDeFecha('2026-08-27')).not.toBe(semillaDeFecha('2026-08-28'))
  })
})

describe('las señales de alerta', () => {
  it('un dolor de 8 o más se señala; uno de 7 no', () => {
    expect(alertasDelDia(dolorEn('lumbar', 9))).toHaveLength(1)
    expect(alertasDelDia(dolorEn('lumbar', 7))).toHaveLength(0)
  })

  it('el sangrado muy abundante se señala; el abundante no', () => {
    expect(alertasDelDia({ sangrado: { level: 5 } })).toHaveLength(1)
    expect(alertasDelDia({ sangrado: { level: 4 } })).toHaveLength(0)
  })

  it('nunca nombra una condición', () => {
    const todas = [
      ...alertasDelDia(dolorEn('cabeza', 9)),
      ...alertasDelDia(dolorEn('abdomen_bajo', 10)),
      ...alertasDelDia({ sangrado: { level: 5 } }),
    ].map(a => a.mensaje.toLowerCase()).join(' ')
    for (const palabra of ['anemia', 'endometriosis', 'sop', 'ovario poliquístico', 'fibroma']) {
      expect(todas).not.toContain(palabra)
    }
    expect(todas).toContain('profesional de salud')
  })

  it('la alerta llega a la recomendación', () => {
    expect(reco({ dia: dolorEn('abdomen_bajo', 9) }).alerta).not.toBeNull()
    expect(reco({ dia: dolorEn('abdomen_bajo', 3) }).alerta).toBeNull()
  })
})

describe('dónde cae hoy dentro de su fase', () => {
  it('cuenta sobre los límites reales, no sobre un calendario', () => {
    const m28 = marcoFases(28, 5)
    expect(dentroDeFase(3, m28, 'menstrual')).toEqual({ n: 3, de: 5 })
    expect(dentroDeFase(20, m28, 'lutea')).toEqual({ n: 5, de: 13 })
  })

  it('en un ciclo corto la folicular dura menos, y se nota', () => {
    /* Ciclo de 21 días: la ovulación cae en el 8, así que la folicular son dos
       días, no ocho. Un calendario fijo diría «día 2 de 8» y sería falso. */
    const m21 = marcoFases(21, 5)
    expect(m21.diaOvulacion).toBe(8)
    expect(dentroDeFase(7, m21, 'folicular')).toEqual({ n: 2, de: 2 })
  })
})
