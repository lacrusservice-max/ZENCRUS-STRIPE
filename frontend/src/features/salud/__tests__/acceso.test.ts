/**
 * La puerta del módulo de ciclo.
 *
 * Estas pruebas existen por un fallo concreto: la regla estaba escrita dos
 * veces —cliente y servidor— con una lista de correos de pruebas que nadie
 * vació, y el módulo acabó existiendo para UNA cuenta. La primera mujer que
 * se dio de alta no lo vio nunca.
 */

import { tieneCiclo, puedeOfrecerseCiclo } from '../acceso'
import type { User } from '@/store/authStore'

const cuenta = (u: Partial<User>): User => ({
  id: '1', email: 'a@b.com', full_name: 'A', ...u,
} as User)

describe('tieneCiclo', () => {
  it('manda lo que dijo el servidor, en los dos sentidos', () => {
    expect(tieneCiclo(cuenta({ cycleEnabled: true, gender: 'male' }))).toBe(true)
    expect(tieneCiclo(cuenta({ cycleEnabled: false, gender: 'female' }))).toBe(false)
  })

  /* Que una mujer pueda apagarlo era la razón de D-13 para no derivar del
     género, y se conserva: su decisión gana sobre el valor derivado. */
  it('una mujer que lo apagó sigue con él apagado', () => {
    expect(tieneCiclo(cuenta({ cycleEnabled: false, gender: 'female' }))).toBe(false)
  })

  describe('sin llave del servidor (sesión vieja) se deriva del género', () => {
    it('lo ve quien declaró género femenino', () => {
      expect(tieneCiclo(cuenta({ gender: 'female' }))).toBe(true)
    })

    it('lo ve quien declaró «otro», que era la objeción de D-13', () => {
      expect(tieneCiclo(cuenta({ gender: 'other' }))).toBe(true)
    })

    it('NO lo ve quien declaró género masculino', () => {
      expect(tieneCiclo(cuenta({ gender: 'male' }))).toBe(false)
      expect(tieneCiclo(cuenta({ gender: 'MALE' } as Partial<User>))).toBe(false)
      expect(tieneCiclo(cuenta({ gender: ' male ' } as Partial<User>))).toBe(false)
    })
  })

  it('sin usuario no se pinta nada', () => {
    expect(tieneCiclo(null)).toBe(false)
    expect(tieneCiclo(undefined)).toBe(false)
  })
})

describe('puedeOfrecerseCiclo', () => {
  it('no se le ofrece a quien declaró género masculino', () => {
    expect(puedeOfrecerseCiclo(cuenta({ gender: 'male' }))).toBe(false)
    expect(puedeOfrecerseCiclo(cuenta({ gender: 'female' }))).toBe(true)
    expect(puedeOfrecerseCiclo(cuenta({ gender: 'other' }))).toBe(true)
  })
})
