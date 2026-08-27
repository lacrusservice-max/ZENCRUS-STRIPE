/**
 * LOS UMBRALES DE LOS CUATRO PATRONES
 * ═══════════════════════════════════════════════════════════════════════════
 * Cada número del prompt maestro con su prueba justo por encima y justo por
 * debajo. Un umbral que solo se prueba por encima no está probado: lo que hay
 * que garantizar es que POR DEBAJO la app se calla.
 */

import {
  patronesDelCiclo, UMBRAL_SINTOMA, UMBRAL_ENERGIA, UMBRAL_ANTOJO, MINIMO_CICLOS,
  MINIMO_DIAS_SINTOMA_FASE,
} from '../patrones'
import { marcoFases } from '@/nucleo/ciclo/fases'

const marco = marcoFases(28, 5)   // menstrual 1-5, folicular 6-14, ovul 15, lútea 16-28
const INICIOS = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26']
const periodos = INICIOS.map(inicio => ({ inicio }))

const patrones = (logs: Record<string, Record<string, unknown>>) =>
  patronesDelCiclo(logs, periodos, marco, '2026-12-31')

const de = (logs: Record<string, Record<string, unknown>>, clave: string) =>
  patrones(logs).find(p => p.clave === clave) ?? null

const dolor = { dolor: { zones: [{ id: 'abdomen_bajo' }] } }
const irritable = { animo: { valence: -0.5, arousal: 0.7 } }
const feliz = { animo: { valence: 0.8, arousal: 0.4 } }
const en = (fechas: string[], dato: Record<string, unknown>) =>
  Object.fromEntries(fechas.map(f => [f, dato]))

describe(`1 · síntoma: ${UMBRAL_SINTOMA * 100} % sobre ${MINIMO_DIAS_SINTOMA_FASE} días`, () => {
  // Días menstruales: 1-5 de enero y 29 de enero – 2 de febrero.
  const menstruales = ['2026-01-01', '2026-01-02', '2026-01-03',
    '2026-01-04', '2026-01-05', '2026-01-29']

  it('cinco de seis días con cólicos sí es un patrón', () => {
    const p = de({ ...en(menstruales.slice(0, 5), dolor), '2026-01-29': { energia: { level: 3 } } },
      'sintoma')
    expect(p?.apoyo).toBe(5)
    expect(p?.texto).toContain('83 %')
    expect(p?.texto).toContain('menstrual')
  })

  it('tres de seis no llega al umbral', () => {
    const p = de({
      ...en(menstruales.slice(0, 3), dolor),
      ...en(menstruales.slice(3), { energia: { level: 3 } }),
    }, 'sintoma')
    expect(p).toBeNull()
  })

  it(`con ${MINIMO_DIAS_SINTOMA_FASE - 1} días no se dice, aunque sea el 100 %`, () => {
    const p = de(en(menstruales.slice(0, 4), dolor), 'sintoma')
    expect(p).toBeNull()
  })
})

describe(`2 · energía: diferencia de ${UMBRAL_ENERGIA} entre fases`, () => {
  const folicular = ['2026-01-06', '2026-01-07', '2026-01-08']
  const lutea = ['2026-01-16', '2026-01-17', '2026-01-18']

  it('tres puntos de diferencia se dicen', () => {
    const p = de({
      ...en(folicular, { energia: { level: 5 } }),
      ...en(lutea, { energia: { level: 2 } }),
    }, 'energia')
    expect(p?.texto).toContain('3.0 puntos')
    expect(p?.texto).toContain('folicular')
  })

  it('un punto de diferencia no', () => {
    const p = de({
      ...en(folicular, { energia: { level: 3 } }),
      ...en(lutea, { energia: { level: 2 } }),
    }, 'energia')
    expect(p).toBeNull()
  })

  it('una sola fase con datos no da diferencia', () => {
    expect(de(en(folicular, { energia: { level: 5 } }), 'energia')).toBeNull()
  })
})

describe(`3 · antojo: ${UMBRAL_ANTOJO * 100} % premenstrual en ${MINIMO_CICLOS} ciclos`, () => {
  /** Los tres días antes de cada inicio. */
  const previos = (inicio: string): string[] => {
    const [a, m, d] = inicio.split('-').map(Number)
    return [1, 2, 3].map(n => {
      const t = new Date(Date.UTC(a, m - 1, d) - n * 86_400_000)
      return t.toISOString().slice(0, 10)
    })
  }
  /* El relleno de los días que no llevan el antojo buscado va CAMBIANDO: si
     fuera siempre el mismo, con un solo día de «dulce» los otros dos serían
     dos de «salado» y sería «salado» quien pasara el 60 %. La prueba habría
     fallado por culpa de la prueba. */
  const RELLENO = ['salado', 'grasas', 'citricos']
  const conAntojo = (inicios: string[], cuantosDias: number, tag = 'dulce') =>
    Object.fromEntries(inicios.flatMap(i => previos(i).map((f, k) =>
      [f, { antojos: { tags: [k < cuantosDias ? tag : RELLENO[k]] } }])))

  it('dos de tres días, en tres ciclos, es un patrón', () => {
    const p = de(conAntojo(INICIOS.slice(1), 2), 'antojo')
    expect(p?.apoyo).toBe(3)
    expect(p?.texto).toContain('dulce')
  })

  it('uno de tres días no llega al 60 %', () => {
    expect(de(conAntojo(INICIOS.slice(1), 1), 'antojo')).toBeNull()
  })

  it(`${MINIMO_CICLOS - 1} ciclos no bastan, por mucho que se repita`, () => {
    expect(de(conAntojo(INICIOS.slice(2), 3), 'antojo')).toBeNull()
  })
})

describe(`4 · ánimo: el mismo, en la misma fase, en ${MINIMO_CICLOS} ciclos`, () => {
  // Día 16 y 17 de cada ciclo, que caen en lútea.
  const lutea3 = ['2026-01-16', '2026-01-17', '2026-02-13', '2026-02-14',
    '2026-03-13', '2026-03-14']

  it('irritable dominante en tres lúteas seguidas', () => {
    const p = de(en(lutea3, irritable), 'animo')
    expect(p?.apoyo).toBe(3)
    expect(p?.texto).toContain('irritable')
    expect(p?.texto).toContain('lútea')
  })

  it('dos ciclos no bastan', () => {
    expect(de(en(lutea3.slice(0, 4), irritable), 'animo')).toBeNull()
  })

  it('un empate dentro de un ciclo no tiene dominante', () => {
    /* Cada ciclo con un irritable y un feliz: ninguno domina en ninguno, así
       que no hay tres ciclos de nada aunque haya seis registros. */
    const logs = {
      '2026-01-16': irritable, '2026-01-17': feliz,
      '2026-02-13': irritable, '2026-02-14': feliz,
      '2026-03-13': irritable, '2026-03-14': feliz,
    }
    expect(de(logs, 'animo')).toBeNull()
  })
})

describe('el orden', () => {
  it('gana el que más observaciones tiene, no el que va antes', () => {
    const logs = {
      // Un síntoma con apoyo 5…
      '2026-01-01': dolor, '2026-01-02': dolor, '2026-01-03': dolor,
      '2026-01-04': dolor, '2026-01-05': dolor, '2026-01-29': { energia: { level: 3 } },
      // …y una energía sostenida por más días.
      '2026-01-06': { energia: { level: 5 } }, '2026-01-07': { energia: { level: 5 } },
      '2026-01-08': { energia: { level: 5 } }, '2026-01-09': { energia: { level: 5 } },
      '2026-01-16': { energia: { level: 1 } }, '2026-01-17': { energia: { level: 1 } },
      '2026-01-18': { energia: { level: 1 } }, '2026-01-19': { energia: { level: 1 } },
    }
    const todos = patrones(logs)
    expect(todos.length).toBeGreaterThan(1)
    expect(todos[0].clave).toBe('energia')
    expect(todos[0].apoyo).toBeGreaterThan(todos[1].apoyo)
  })

  it('sin periodos no hay patrones', () => {
    expect(patronesDelCiclo(en(['2026-01-01'], dolor), [], marco, '2026-12-31')).toEqual([])
  })
})
