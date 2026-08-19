/**
 * El score, comprobado justo donde falló.
 *
 * La primera prueba es la que importa: sin ninguna señal el score no existe.
 * Durante meses ahí salía un 70 —creíble, verde y falso— porque el pulso se
 * inventaba un 65 cuando no había medición. Nadie lo iba a ver mirando la
 * pantalla: 70 sobre 100 es exactamente el número que uno espera de una app de
 * salud, y quien acababa de instalarla no tenía con qué compararlo.
 */

import {
  puntuarRecuperacion, puntosDePulso, fuentesDeRecuperacion,
} from '../scoreRecuperacion'

const NADA = { checkIn: null, sueno: null, pulso: null }
const BIEN = { energy: 4, soreness: 4, stress: 4 }

describe('sin datos no hay score', () => {
  it('devuelve null, no un número', () => {
    expect(puntuarRecuperacion(NADA)).toBeNull()
  })

  it('y NO devuelve el 70 que salía del pulso inventado', () => {
    // 65 ppm era el valor que el store fabricaba sin mediciones, y daba 70.
    expect(puntuarRecuperacion(NADA)).not.toBe(70)
    expect(puntosDePulso(65)).toBe(70)   // de aquí salía; queda documentado
  })

  it('tampoco devuelve 0: un cero afirma que estás mal', () => {
    expect(puntuarRecuperacion(NADA)).not.toBe(0)
  })
})

describe('con una sola señal ya hay score', () => {
  it('solo pulso', () => {
    expect(puntuarRecuperacion({ ...NADA, pulso: 60 })).toBe(80)
  })

  it('solo sueño', () => {
    expect(puntuarRecuperacion({ ...NADA, sueno: 90 })).toBe(90)
  })

  it('solo check-in, sin promediarlo consigo mismo', () => {
    // 4/5 de media en las tres = 80 %. La versión anterior calculaba
    // subjetivo*0.5 + subjetivo*0.5, que es el mismo número contado dos veces:
    // el resultado coincide, pero escondía que no había nada medido.
    expect(puntuarRecuperacion({ ...NADA, checkIn: BIEN })).toBe(80)
  })
})

describe('el reparto entre lo que dices y lo que se mide', () => {
  it('el check-in pesa la mitad y lo medido la otra mitad', () => {
    // subjetivo 80, medido (sueño 100 y pulso 50 ppm → 100) = 100
    const s = puntuarRecuperacion({ checkIn: BIEN, sueno: 100, pulso: 50 })
    expect(s).toBe(90)
  })

  it('promedia entre sí las señales medidas antes de pesarlas', () => {
    // sueño 60 y pulso 70 ppm (→ 60) promedian 60; con subjetivo 80 → 70
    expect(puntuarRecuperacion({ checkIn: BIEN, sueno: 60, pulso: 70 })).toBe(70)
  })
})

describe('la escala del pulso tiene topes', () => {
  it('50 ppm o menos es el máximo', () => {
    expect(puntosDePulso(50)).toBe(100)
    expect(puntosDePulso(38)).toBe(100)
  })

  it('un pulso altísimo no baja de cero', () => {
    expect(puntosDePulso(140)).toBe(0)
  })

  it('y el score nunca se sale de 0-100', () => {
    const alto = puntuarRecuperacion({ checkIn: { energy: 5, soreness: 5, stress: 5 }, sueno: 100, pulso: 45 })
    const bajo = puntuarRecuperacion({ checkIn: { energy: 1, soreness: 1, stress: 1 }, sueno: 0, pulso: 200 })
    expect(alto).toBe(100)
    expect(bajo).toBeGreaterThanOrEqual(0)
    expect(bajo).toBeLessThanOrEqual(100)
  })
})

describe('las fuentes dicen la verdad sobre el origen', () => {
  it('sin nada, ninguna fuente', () => {
    expect(fuentesDeRecuperacion(NADA)).toEqual({ checkIn: false, sueno: false, pulso: false })
  })

  it('nombra solo lo que hay', () => {
    // El texto de la pantalla decía siempre «sueño y frecuencia cardíaca».
    // Con solo pulso, mencionar el sueño es inventarse una procedencia.
    expect(fuentesDeRecuperacion({ ...NADA, pulso: 58 }))
      .toEqual({ checkIn: false, sueno: false, pulso: true })
  })
})
