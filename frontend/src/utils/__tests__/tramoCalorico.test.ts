/**
 * Los cuatro tramos, comprobados en sus bordes.
 *
 * Se prueba aquí y no mirando la pantalla porque los bordes son justo lo que no
 * se puede ver a ojo: nadie va a comer exactamente 1.700 kcal para comprobar que
 * el color cambia en el sitio. Y porque el orden de las comparaciones ya se
 * equivocó una vez — preguntando primero por «>= meta», un día de 2.500 salía
 * en verde.
 */

import {
  limitesDe, tramoDe, finDeEscala, fraccion, frase, aviso, FRACCION_TECHO,
} from '../tramoCalorico'

const L = { minimo: 1700, meta: 2000, techo: 2300 }

describe('limitesDe', () => {
  it('deriva piso y techo simétricos cuando el perfil no los trae', () => {
    expect(limitesDe({ calories_target: 2000 })).toEqual({
      meta: 2000, minimo: 1700, techo: 2300,
    })
  })

  it('respeta los del perfil cuando existen', () => {
    expect(limitesDe({ calories_target: 2400, calories_min: 2000, calories_max: 2900 }))
      .toEqual({ meta: 2400, minimo: 2000, techo: 2900 })
  })

  it('sobrevive a un perfil vacío', () => {
    expect(limitesDe(null).meta).toBe(2000)
    expect(limitesDe(undefined).techo).toBe(2300)
  })
})

describe('tramoDe · los bordes exactos', () => {
  it('el día en blanco va en gris', () => {
    expect(tramoDe(0, L)).toBe('bajo')
  })

  it('cambia a ámbar justo AL alcanzar el mínimo, no después', () => {
    expect(tramoDe(1699, L)).toBe('bajo')
    expect(tramoDe(1700, L)).toBe('minimo')
  })

  it('cambia a verde justo AL alcanzar la meta', () => {
    expect(tramoDe(1999, L)).toBe('minimo')
    expect(tramoDe(2000, L)).toBe('meta')
  })

  it('el techo todavía es verde: rojo es PASARSE, no llegar', () => {
    expect(tramoDe(2300, L)).toBe('meta')
    expect(tramoDe(2301, L)).toBe('pasado')
  })

  it('un exceso grande no se cuela como meta', () => {
    // Con las comparaciones al revés, 2.500 entraba por «>= meta» y salía verde.
    expect(tramoDe(2500, L)).toBe('pasado')
    expect(tramoDe(9000, L)).toBe('pasado')
  })
})

describe('la escala deja sitio para pasarse', () => {
  it('el techo cae al 85 %, no al final', () => {
    expect(fraccion(L.techo, L)).toBeCloseTo(FRACCION_TECHO, 2)
  })

  it('pasarse poco y pasarse mucho NO se ven igual', () => {
    const poco = fraccion(2350, L)
    const mucho = fraccion(2650, L)
    expect(poco).toBeGreaterThan(FRACCION_TECHO)
    expect(mucho).toBeGreaterThan(poco)
  })

  it('pero la barra nunca se desborda del todo', () => {
    expect(fraccion(99999, L)).toBe(1)
    expect(fraccion(-500, L)).toBe(0)
  })

  it('el fin de escala es coherente con la fracción del techo', () => {
    expect(finDeEscala(L)).toBe(Math.round(2300 / 0.85))
  })
})

describe('la frase dice la verdad en cada tramo', () => {
  it('el día en blanco invita a empezar, no regaña', () => {
    expect(frase(0, L)).toMatch(/no has apuntado nada/i)
  })

  it('por debajo del mínimo dice cuánto falta', () => {
    expect(frase(1200, L)).toContain('500')
  })

  it('en la meta reconoce lo hecho', () => {
    expect(frase(2050, L)).toMatch(/excelente|meta/i)
  })

  it('al pasarse da el número exacto y quita hierro', () => {
    const f = frase(2560, L)
    expect(f).toContain('260')
    expect(f).toMatch(/no rompe nada/i)
  })

  it('nunca promete margen que no existe', () => {
    // A 2.300 clavadas el margen es cero; decir «te quedan 0» sería absurdo.
    expect(frase(2300, L)).not.toMatch(/te quedan 0\b/i)
  })
})

describe('el aviso acompaña al tramo', () => {
  it('cubre los cuatro, no solo los dos extremos', () => {
    // Antes solo había aviso para «piso» y «pasado»: quien iba en la meta o
    // acababa de cruzar el mínimo no leía nada.
    for (const kcal of [0, 1800, 2100, 2500]) {
      const a = aviso(kcal, L)
      expect(a.titulo.length).toBeGreaterThan(0)
      expect(a.cuerpo.length).toBeGreaterThan(0)
      expect(a.tramo).toBe(tramoDe(kcal, L))
    }
  })

  it('al pasarse propone una corrección que no supera el propio exceso', () => {
    expect(aviso(2320, L).cuerpo).toContain('20')
    // Y con un exceso enorme, la corrección se topa en 300.
    expect(aviso(3500, L).cuerpo).toContain('300')
  })
})
