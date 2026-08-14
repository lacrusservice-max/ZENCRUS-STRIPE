import { aFechaLocal, hoyLocal, sumarDias, haceDias, enDias, diasEntre } from '../fechas'

describe('aFechaLocal', () => {
  it('escribe la fecha del reloj del usuario, no la de UTC', () => {
    // Las 21:00 del 12 de agosto en un huso negativo son ya el día 13 en UTC.
    // Es exactamente el caso que rompía el diario: cenar y verlo en mañana.
    const cena = new Date(2098, 7, 12, 21, 30)
    expect(aFechaLocal(cena)).toBe('2098-08-12')
  })

  it('rellena mes y día con cero a la izquierda', () => {
    expect(aFechaLocal(new Date(2098, 0, 5))).toBe('2098-01-05')
  })

  it('no se adelanta con la primera hora del día', () => {
    expect(aFechaLocal(new Date(2098, 7, 12, 0, 1))).toBe('2098-08-12')
  })

  it('no se retrasa con la última', () => {
    expect(aFechaLocal(new Date(2098, 7, 12, 23, 59))).toBe('2098-08-12')
  })
})

describe('hoyLocal', () => {
  it('coincide con el día que marca el dispositivo', () => {
    const ahora = new Date()
    expect(hoyLocal()).toBe(aFechaLocal(ahora))
  })

  it('tiene forma de fecha', () => {
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('sumarDias', () => {
  it('cruza el fin de mes', () => {
    expect(sumarDias('2098-01-31', 1)).toBe('2098-02-01')
  })

  it('cruza el fin de año hacia atrás', () => {
    expect(sumarDias('2098-01-01', -1)).toBe('2097-12-31')
  })

  it('respeta los años bisiestos', () => {
    expect(sumarDias('2096-02-28', 1)).toBe('2096-02-29')
    expect(sumarDias('2098-02-28', 1)).toBe('2098-03-01')
  })

  it('no pierde ni gana un día en el cambio de hora', () => {
    // Los dos domingos en los que un día no mide 24 horas en local.
    expect(sumarDias('2098-10-25', -1)).toBe('2098-10-24')
    expect(sumarDias('2098-03-29', -1)).toBe('2098-03-28')
  })

  it('sumar cero no mueve nada', () => {
    expect(sumarDias('2098-08-12', 0)).toBe('2098-08-12')
  })

  it('encadena sin desviarse', () => {
    let f = '2098-01-01'
    for (let i = 0; i < 365; i++) f = sumarDias(f, 1)
    expect(f).toBe('2099-01-01')
  })
})

describe('haceDias y enDias', () => {
  it('ayer es un día antes de hoy', () => {
    expect(haceDias(1)).toBe(sumarDias(hoyLocal(), -1))
  })

  it('hace cero días es hoy', () => {
    expect(haceDias(0)).toBe(hoyLocal())
  })

  it('mañana es un día después', () => {
    expect(enDias(1)).toBe(sumarDias(hoyLocal(), 1))
  })

  it('la semana que mira la rejilla de hábitos tiene siete días distintos', () => {
    const semana = Array.from({ length: 7 }, (_, i) => haceDias(6 - i))
    expect(new Set(semana).size).toBe(7)
    expect(semana[6]).toBe(hoyLocal())
  })
})

describe('diasEntre', () => {
  it('cuenta hacia delante', () => {
    expect(diasEntre('2098-08-12', '2098-08-15')).toBe(3)
  })

  it('cuenta hacia atrás', () => {
    expect(diasEntre('2098-08-15', '2098-08-12')).toBe(-3)
  })

  it('el mismo día son cero', () => {
    expect(diasEntre('2098-08-12', '2098-08-12')).toBe(0)
  })

  it('no se descuadra en el cambio de hora', () => {
    expect(diasEntre('2098-10-24', '2098-10-26')).toBe(2)
  })
})
