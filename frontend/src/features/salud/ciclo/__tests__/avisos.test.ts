/**
 * LOS AVISOS DEL CICLO
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que hay que garantizar aquí no son las fechas: es que en modo discreto no
 * se lea nada que delate de qué va la app en una pantalla bloqueada. Un fallo
 * en una fecha es un aviso que llega tarde; un fallo en el texto es alguien
 * enterándose de algo que no le habían contado.
 */

import {
  avisosDe, textoDelAviso, AVISOS_POR_DEFECTO, TOPE_AVISOS, PREFIJO,
  type AjustesAvisos, type ContextoAvisos,
} from '../avisosPlan'

const AHORA = new Date(2026, 7, 27, 12, 0, 0)   // 27-ago-2026, mediodía

const ctx: ContextoAvisos = {
  proximoPeriodo: '2026-09-18',
  inicioFertil: '2026-09-04',
  predice: true,
}

const con = (a: Partial<AjustesAvisos>): AjustesAvisos => ({ ...AVISOS_POR_DEFECTO, ...a })
const plan = (a: Partial<AjustesAvisos>, c: Partial<ContextoAvisos> = {}) =>
  avisosDe(con(a), { ...ctx, ...c }, AHORA)
const uno = (a: Partial<AjustesAvisos>, id: string, c: Partial<ContextoAvisos> = {}) =>
  plan(a, c).find(x => x.id === PREFIJO + id)

/** Todo lo que no debería poder leerse nunca con el modo discreto puesto. */
const DELATORAS = [
  'periodo', 'regla', 'menstrua', 'fértil', 'fertil', 'ovula', 'retraso',
  'sangrado', 'ciclo', 'temperatura', 'basal',
]

describe('el modo discreto no delata', () => {
  it('viene encendido de fábrica', () => {
    expect(AVISOS_POR_DEFECTO.discreto).toBe(true)
  })

  it('ninguno de los cinco dice una palabra delatora', () => {
    const todos = plan({
      periodo: 2, retraso: 3, fertil: true, registro: '21:00', temperatura: '07:00',
    })
    expect(todos).toHaveLength(5)
    for (const a of todos) {
      const t = `${a.titulo} ${a.cuerpo}`.toLowerCase()
      for (const palabra of DELATORAS) {
        expect(t).not.toContain(palabra)
      }
    }
  })

  it('los tres que cuelgan del ciclo dicen exactamente lo mismo', () => {
    /* Si cada uno tuviera su propia frase neutra, la frase sería la pista:
       quien viera dos veces la misma sabría que es el mismo aviso, y quien
       viera una distinta sabría que ha pasado algo. */
    const todos = plan({ periodo: 2, retraso: 3, fertil: true })
    const cuerpos = new Set(todos.map(a => a.cuerpo))
    expect(todos).toHaveLength(3)
    expect(cuerpos.size).toBe(1)
  })

  it('apagándolo sí se lee lo que pasa', () => {
    const a = uno({ discreto: false, periodo: 2 }, 'periodo')
    expect(a?.cuerpo).toBe('Debería empezar en 2 días.')
    expect(uno({ discreto: false, periodo: 1 }, 'periodo')?.cuerpo)
      .toBe('Debería empezar mañana.')
    expect(uno({ discreto: false, retraso: 1 }, 'retraso')?.cuerpo)
      .toContain('1 día de retraso')
  })

  it('el de ventana fértil nunca se ofrece como anticonceptivo', () => {
    const t = textoDelAviso('fertil', con({ discreto: false }), {})
    const dicho = `${t.titulo} ${t.cuerpo}`.toLowerCase()
    for (const palabra of ['anticoncep', 'protegid', 'seguro', 'no puedes']) {
      expect(dicho).not.toContain(palabra)
    }
    expect(dicho).toContain('estimada')
  })
})

describe('las fechas', () => {
  it('el del periodo va N días antes del día probable', () => {
    const a = uno({ periodo: 2, hora: '09:00' }, 'periodo')
    // 18 de septiembre menos 2 = 16, a las 9:00.
    expect(a?.cuando?.getDate()).toBe(16)
    expect(a?.cuando?.getMonth()).toBe(8)
    expect(a?.cuando?.getHours()).toBe(9)
  })

  it('el de retraso va N días después', () => {
    expect(uno({ retraso: 3 }, 'retraso')?.cuando?.getDate()).toBe(21)
  })

  it('no se programa lo que ya pasó', () => {
    /* Con el aviso a 60 días antes, la fecha cae en julio: iOS dispararía un
       aviso con fecha pasada en el acto, y llegaría «tu periodo empieza en 60
       días» ahora mismo. */
    expect(uno({ periodo: 60 }, 'periodo')).toBeUndefined()
  })

  it('la hora elegida se respeta', () => {
    expect(uno({ periodo: 2, hora: '20:00' }, 'periodo')?.cuando?.getHours()).toBe(20)
  })
})

describe('cuándo NO hay que avisar', () => {
  it('sin predicción no hay avisos de ciclo, pero sí los de hora fija', () => {
    const todos = plan(
      { periodo: 2, retraso: 3, fertil: true, registro: '21:00' },
      { proximoPeriodo: null, inicioFertil: null })
    expect(todos.map(a => a.id)).toEqual([PREFIJO + 'registro'])
  })

  it('en un modo que no predice tampoco', () => {
    /* Embarazo o sin ciclo: avisar de que «tu periodo empieza en dos días» a
       quien está embarazada no es un fallo de fecha, es otra cosa. */
    const todos = plan(
      { periodo: 2, retraso: 3, fertil: true, temperatura: '07:00' },
      { predice: false })
    expect(todos.map(a => a.id)).toEqual([PREFIJO + 'temperatura'])
  })

  it('con todo apagado no se programa nada', () => {
    expect(plan({})).toEqual([])
  })

  it('nunca se pasa del tope', () => {
    const todos = plan({
      periodo: 2, retraso: 3, fertil: true, registro: '21:00', temperatura: '07:00',
    })
    expect(todos.length).toBeLessThanOrEqual(TOPE_AVISOS)
  })
})

describe('los de hora fija', () => {
  it('se programan con hora y sin fecha, para poder repetirse', () => {
    const a = uno({ registro: '21:30' }, 'registro')
    expect(a?.hora).toEqual({ hour: 21, minute: 30 })
    expect(a?.cuando).toBeUndefined()
  })

  it('el de temperatura sí puede ser concreto en discreto', () => {
    /* Medir algo por la mañana no delata nada: cualquiera registra cosas en
       una app de salud. Lo que no puede aparecer es la palabra. */
    const a = uno({ temperatura: '07:00' }, 'temperatura')
    expect(a?.cuerpo).toContain('antes de levantarte')
    expect(a?.cuerpo.toLowerCase()).not.toContain('temperatura')
  })
})
