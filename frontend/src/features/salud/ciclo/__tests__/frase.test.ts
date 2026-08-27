/**
 * LAS OCHO CONDICIONES DE LA FRASE
 * ═══════════════════════════════════════════════════════════════════════════
 * El prompt maestro las da numeradas y con orden de prioridad explícito. El
 * orden ES la especificación: cambiar dos de sitio hace que una usuaria con
 * retraso lea «fase lútea» en vez de que se le diga que lleva cuatro días de
 * retraso.
 */

import { fraseDelDia } from '../frase'
import { marcoFases } from '@/nucleo/ciclo/fases'

const marco = marcoFases(28, 5)   // Ov = 15, ventana 10–16

const base = {
  sangradoHoy: null,
  diaDePeriodo: null,
  diaDeCiclo: 8,
  diasParaLaRegla: 20,
  marco,
}

describe('fraseDelDia · las ocho condiciones, en orden', () => {
  it('1 · sangrar hoy gana sobre todo lo demás', () => {
    // Aunque la predicción diga que aún faltan diez días.
    const f = fraseDelDia({ ...base, sangradoHoy: 3, diaDePeriodo: 2, diasParaLaRegla: 10 })
    expect(f.clave).toBe('sangrando')
    expect(f.texto).toBe('Día 2 de tu periodo')
  })

  it('2 · el retraso se cuenta en días y se dice', () => {
    const f = fraseDelDia({ ...base, diasParaLaRegla: -4, diaDeCiclo: 32 })
    expect(f.clave).toBe('retraso')
    expect(f.texto).toBe('Tu periodo está retrasado 4 días')
  })

  it('2b · un solo día de retraso va en singular', () => {
    const f = fraseDelDia({ ...base, diasParaLaRegla: -1, diaDeCiclo: 29 })
    expect(f.texto).toBe('Tu periodo está retrasado 1 día')
  })

  it('3 · el día justo', () => {
    expect(fraseDelDia({ ...base, diasParaLaRegla: 0, diaDeCiclo: 28 }).clave)
      .toBe('deberia_hoy')
  })

  it('4 · mañana se dice «mañana», no «a 1 días»', () => {
    const f = fraseDelDia({ ...base, diasParaLaRegla: 1, diaDeCiclo: 27 })
    expect(f.texto).toBe('Mañana comienza tu periodo')
  })

  it('4b · dentro de los cinco días previos', () => {
    expect(fraseDelDia({ ...base, diasParaLaRegla: 5, diaDeCiclo: 23 }).texto)
      .toBe('A 5 días de tu próximo periodo')
  })

  it('5 · el día de la ovulación tiene frase propia', () => {
    const f = fraseDelDia({ ...base, diaDeCiclo: 15, diasParaLaRegla: 13 })
    expect(f.clave).toBe('pico_fertil')
  })

  it('6 · el resto de la ventana fértil', () => {
    expect(fraseDelDia({ ...base, diaDeCiclo: 12, diasParaLaRegla: 16 }).clave)
      .toBe('ventana_fertil')
  })

  it('7 · folicular fuera de la ventana', () => {
    expect(fraseDelDia({ ...base, diaDeCiclo: 8, diasParaLaRegla: 20 }).clave)
      .toBe('folicular')
  })

  it('8 · lútea, que es el caso por defecto', () => {
    expect(fraseDelDia({ ...base, diaDeCiclo: 20, diasParaLaRegla: 8 }).clave)
      .toBe('lutea')
  })

  it('sin predicción, lo dice en vez de inventar una fase', () => {
    const f = fraseDelDia({ ...base, diasParaLaRegla: null, marco: null, diaDeCiclo: null })
    expect(f.clave).toBe('sin_datos')
  })

  /* La prioridad importa de verdad en los solapes: el día 16 es a la vez el
     último de la ventana fértil Y está dentro de los cinco días previos a la
     regla en un ciclo corto. Debe ganar la regla, que es lo que preocupa. */
  it('cuando la ventana fértil y la regla inminente se solapan, gana la regla', () => {
    const corto = marcoFases(21, 5)          // Ov = 8, ventana 3–9
    const f = fraseDelDia({
      sangradoHoy: null, diaDePeriodo: null,
      diaDeCiclo: 8, diasParaLaRegla: 3, marco: corto,
    })
    expect(f.clave).toBe('inminente')
  })
})
