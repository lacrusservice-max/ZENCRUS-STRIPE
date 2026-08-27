/**
 * LA TABLA DE REFERENCIA DEL PROMPT MAESTRO
 * ═══════════════════════════════════════════════════════════════════════════
 * El documento de funcionamiento trae una tabla con nueve duraciones de ciclo
 * y los rangos exactos que debe dar cada una. Eso no es documentación: es un
 * criterio de aceptación, y aquí se comprueba fila por fila.
 *
 * ── Por qué merece un test propio ──────────────────────────────────────────
 * `marcoFases` es la función de la que cuelga todo lo demás — los arcos del
 * anillo, los colores del calendario, las fases de las estadísticas y lo que
 * ZENA dice del día de hoy. Un cambio de un día en la ovulación se propaga a
 * cuatro pantallas y a un chat, y no se nota mirando: se nota cuando alguien
 * se fía de una ventana fértil corrida.
 */

import { marcoFases, LUTEA } from '@/nucleo/ciclo/fases'

/** Fila de la tabla: [C, folicularIni, folicularFin, ovulación, fértilIni, fértilFin, lúteaIni, lúteaFin] */
const TABLA: [number, number, number, number, number, number, number, number][] = [
  [23, 6,  9, 10,  5, 11, 11, 23],
  [25, 6, 11, 12,  7, 13, 13, 25],
  [26, 6, 12, 13,  8, 14, 14, 26],
  [28, 6, 14, 15, 10, 16, 16, 28],
  [30, 6, 16, 17, 12, 18, 18, 30],
  [32, 6, 18, 19, 14, 20, 20, 32],
  [35, 6, 21, 22, 17, 23, 23, 35],
  [38, 6, 24, 25, 20, 26, 26, 38],
  [40, 6, 26, 27, 22, 28, 28, 40],
]

const D_SANGRADO = 5

describe('marcoFases · tabla de referencia del prompt maestro', () => {
  test.each(TABLA)(
    'ciclo de %i días',
    (C, folIni, folFin, ovu, ferIni, ferFin, lutIni, lutFin) => {
      const m = marcoFases(C, D_SANGRADO)

      expect(m.duracion).toBe(C)
      expect(m.diaOvulacion).toBe(ovu)

      // La folicular empieza el día siguiente al último de sangrado…
      expect(m.limites.folicular).toBe(folIni)
      // …y acaba la víspera de la ovulación.
      expect(m.limites.ovulatoria - 1).toBe(folFin)

      // La lútea empieza al día siguiente de ovular y llega al final del ciclo.
      expect(m.limites.lutea).toBe(lutIni)
      expect(m.duracion).toBe(lutFin)

      expect(m.ventanaFertil).toEqual([ferIni, ferFin])
    },
  )

  test('la ovulación se cuenta hacia atrás desde la regla, no desde el día 14', () => {
    // El error de toda la categoría: en un ciclo de 35 la ovulación NO es el 14.
    expect(marcoFases(35, 5).diaOvulacion).toBe(35 - LUTEA)
    expect(marcoFases(35, 5).diaOvulacion).not.toBe(14)
  })

  test('en ciclos muy cortos la ovulación no cae dentro del sangrado', () => {
    // C=15 daría 15−13=2, que caería en pleno periodo.
    const m = marcoFases(15, 5)
    expect(m.diaOvulacion).toBeGreaterThan(m.diasPeriodo)
  })

  test('la fase ovulatoria dura UN día; la ventana fértil, seis', () => {
    const m = marcoFases(28, 5)
    expect(m.limites.lutea - m.limites.ovulatoria).toBe(1)
    expect(m.ventanaFertil[1] - m.ventanaFertil[0] + 1).toBe(7)
  })
})
