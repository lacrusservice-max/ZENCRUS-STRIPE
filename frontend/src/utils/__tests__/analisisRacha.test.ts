/**
 * Los tramos, comprobados donde se rompen.
 *
 * Un tramo mal contado no da error: da un número creíble y equivocado. Si
 * «14 días» sale de sumar dos rachas de siete con un hueco en medio, nadie lo
 * nota mirando la pantalla — pero la app estaría felicitando por algo que no
 * pasó.
 */

import {
  tramos, inicioDeRacha, rachasPrevias, patronSemanal, diaFlojo,
  fechaDelHito, enLetra, enCorto, type DiaHistorial,
} from '../analisisRacha'
import { hoyLocal, aFechaLocal } from '@/utils/fechas'

/**
 * Construye historial en el orden real del store: hoy primero.
 *
 * Las fechas se escriben con `aFechaLocal` y NO con `toISOString`. Aquí había
 * un `toISOString().slice(0, 10)` y estas pruebas fallaban todas las tardes:
 * el código bajo prueba compara contra `hoyLocal()` —el día del reloj del
 * usuario— y el ayudante generaba el día en UTC. En México, a partir de las
 * seis de la tarde, son días distintos y «hoy» dejaba de coincidir consigo
 * mismo.
 *
 * Es literalmente el fallo que `utils/fechas.ts` documenta y existe para
 * evitar; se había colado en el andamiaje de su propia prueba.
 */
function hist(estados: string): DiaHistorial[] {
  const hoy = new Date()
  return estados.split('').map((ch, i) => {
    const f = new Date(hoy)
    f.setDate(hoy.getDate() - i)
    const status = ch === 'x' ? 'completed' : ch === 'p' ? 'protected' : 'missed'
    return { date: aFechaLocal(f), status } as DiaHistorial
  })
}

describe('tramos', () => {
  it('un hueco parte la racha en dos, no la suma', () => {
    // Leído desde hoy: 2 hechos, 1 fallado, 3 hechos
    const t = tramos(hist('xx.xxx'))
    expect(t.map(x => x.dias)).toEqual([3, 2])   // del más antiguo al más nuevo
  })

  it('los días protegidos cuentan como hechos', () => {
    expect(tramos(hist('xpx'))[0].dias).toBe(3)
  })

  it('los días futuros no rompen nada', () => {
    const h = hist('xx')
    h.unshift({ date: '2099-01-01', status: 'future' })
    expect(tramos(h)[0].dias).toBe(2)
  })

  it('sin ningún día hecho no hay tramos', () => {
    expect(tramos(hist('...'))).toEqual([])
  })
})

describe('inicioDeRacha', () => {
  it('da el primer día del tramo que llega hasta hoy', () => {
    const h = hist('xxx')
    expect(inicioDeRacha(h)).toBe(h[2].date)
  })

  it('devuelve null si la racha se rompió: acabar ayer no es tenerla', () => {
    // hoy fallado, ayer y antes hechos
    expect(inicioDeRacha(hist('.xx'))).toBeNull()
  })
})

describe('rachasPrevias', () => {
  it('excluye la actual y ordena de mayor a menor', () => {
    // hoy: 2 seguidos · antes: 1 · antes: 4
    const p = rachasPrevias(hist('xx.x.xxxx'))
    expect(p.map(x => x.dias)).toEqual([4, 1])
  })
})

describe('patronSemanal', () => {
  it('no inventa patrón con un solo dato', () => {
    // 3 días: cada uno cae en un día distinto de la semana → todos con 1 dato
    expect(patronSemanal(hist('xxx')).filter(v => v != null)).toHaveLength(0)
  })

  it('con datos suficientes da la proporción', () => {
    const p = patronSemanal(hist('x'.repeat(28)))
    // 28 días seguidos: cada día de la semana aparece 4 veces, todas hechas
    expect(p.every(v => v === 1)).toBe(true)
  })
})

describe('diaFlojo', () => {
  it('solo señala si de verdad destaca', () => {
    expect(diaFlojo([1, 1, 1, 1, 1, 0.2, 1])).toBe(5)
    // Nada por debajo del 70 %: no hay punto flojo que avisar
    expect(diaFlojo([0.9, 0.85, 0.8, 0.95, 0.75, 0.72, 0.9])).toBeNull()
  })

  it('ignora los días sin datos suficientes', () => {
    expect(diaFlojo([null, null, 0.3, null, null, null, null])).toBe(2)
  })
})

describe('la fecha del hito', () => {
  it('suma días naturales', () => {
    const f = fechaDelHito(98, new Date(2026, 7, 20))   // 20 ago 2026
    expect(f.getMonth()).toBe(10)                        // noviembre
    expect(f.getDate()).toBe(26)
  })

  it('el año solo aparece si no es el actual', () => {
    const hoy = new Date(2026, 0, 1)
    expect(enLetra(new Date(2026, 10, 27), hoy)).toBe('27 de noviembre')
    expect(enLetra(new Date(2027, 10, 27), hoy)).toBe('27 de noviembre de 2027')
  })

  it('el formato corto no lleva año', () => {
    expect(enCorto('2026-08-14')).toBe('14 ago')
  })
})
