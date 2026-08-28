/**
 * Las pruebas de las evaluaciones de síntomas.
 *
 * Casi todas fijan una decisión de seguridad, no una fórmula: lo que hay que
 * impedir es que un cambio futuro deje escapar un «no tienes nada» donde no
 * toca. Por eso hay más pruebas de lo que NO se puede decir que de puntuación.
 */

import { EVALUACIONES, PEDERSEN, SAMANTA_Q, PPST } from '../evaluaciones/instrumentos'
import { evaluar, puntuar, VERSION } from '../evaluaciones/evaluar'
import type { Respuesta } from '../evaluaciones/tipos'

const dicho = (valor: Respuesta['valor']): Respuesta => ({ valor, fuente: 'usuaria' })

/** Todas las respuestas de un instrumento con el mismo valor. */
function todas(clave: keyof typeof EVALUACIONES, valor: Respuesta['valor']) {
  const r: Record<string, Respuesta> = {}
  for (const i of EVALUACIONES[clave].instrumento.items) r[i.id] = dicho(valor)
  return r
}

const sinBanderas = (clave: keyof typeof EVALUACIONES) =>
  Object.fromEntries(EVALUACIONES[clave].banderas.map(b => [b.id, false]))

function corre(clave: keyof typeof EVALUACIONES, opts: {
  respuestas?: Record<string, Respuesta>
  banderas?: Record<string, boolean | null>
  noEvaluable?: string[]
} = {}) {
  return evaluar({
    evaluacion: EVALUACIONES[clave],
    banderas: opts.banderas ?? sinBanderas(clave),
    respuestas: opts.respuestas ?? {},
    noEvaluable: opts.noEvaluable ?? [],
  })
}

// ── Lo que NO se puede decir ────────────────────────────────────────────────

describe('«sin señales» solo sale cuando de verdad se puede decir', () => {
  it('no sale con el cuestionario a medias', () => {
    const r = corre('sangrado_abundante', { respuestas: { dias7: dicho(false) } })
    expect(r.estado).toBe('parcial')
    expect(r.siguientePaso).not.toBe('sin_senales')
    expect(r.puntuacion).toBeNull()      // sin puntuación a medias
  })

  it('no sale si hay una bandera roja, aunque el resto sea todo que no', () => {
    const r = corre('sangrado_abundante', {
      respuestas: todas('sangrado_abundante', false),
      banderas: { empapa_con_mareo: false, sangrado_posmenopausico: true },
    })
    expect(r.estado).toBe('bandera_roja')
    expect(r.siguientePaso).toBe('urgente')
    expect(r.instrumentoPositivo).toBeNull()
  })

  it('no sale con anticoncepción hormonal, que es cuando más tienta', () => {
    const r = corre('sop', {
      respuestas: todas('sop', false),
      noEvaluable: ['anticoncepcion_hormonal'],
    })
    expect(r.estado).toBe('no_evaluable')
    expect(r.siguientePaso).toBe('consulta')
    expect(r.noEvaluableMotivo).toMatch(/ni afirmar ni descartar/)
  })

  it('sí sale cuando el instrumento corrió entero y dio negativo', () => {
    const r = corre('endometriosis', { respuestas: todas('endometriosis', false) })
    expect(r.estado).toBe('completo')
    expect(r.siguientePaso).toBe('sin_senales')
    expect(r.instrumentoPositivo).toBe(false)
  })
})

// ── El ítem de Pedersen que resta ───────────────────────────────────────────

describe('la secreción lechosa no puede bajar la puntuación', () => {
  it('está fuera del instrumento, como bandera', () => {
    expect(PEDERSEN.items.map(i => i.id)).not.toContain('galactorrea')
    expect(EVALUACIONES.sop.banderas.map(b => b.id)).toContain('galactorrea')
  })

  /* El caso exacto del artículo: ciclos largos (+1) y vello en tres zonas (+1)
     dan 2, que es compatible. Con el ítem dentro, un «sí» a la secreción
     restaba y lo dejaba en 1: no compatible. La única respuesta que apunta a
     un prolactinoma producía la pantalla tranquilizadora. */
  it('un sí manda a consulta en vez de rebajar el resultado', () => {
    const respuestas = {
      ciclo: dicho('mas_60'),
      vello: dicho(['labio', 'menton', 'abdomen']),
      peso: dicho(false),
    }
    const sin = corre('sop', { respuestas })
    expect(sin.puntuacion).toBe(2)
    expect(sin.instrumentoPositivo).toBe(true)

    const con = corre('sop', {
      respuestas,
      banderas: { galactorrea: true, virilizacion: false },
    })
    expect(con.siguientePaso).toBe('consulta')
    expect(con.puntuacion).toBeNull()    // no se enseña ningún número
  })
})

// ── Las reglas publicadas, tal cual ─────────────────────────────────────────

describe('las puntuaciones son las de la fuente', () => {
  it('SAMANTA-Q: los ítems 1 y 3 valen 3, los demás 1, corte en 3', () => {
    expect(SAMANTA_Q.corte).toBe(3)
    const pesos = Object.fromEntries(SAMANTA_Q.items.map(i => [i.id, i.puntos]))
    expect(pesos).toEqual({ dias7: 3, intensos3: 1, incomodas: 3, noche: 1, asiento: 1, evitar: 1 })

    // Solo «incómodas» ya llega al corte: 3 puntos de un golpe.
    const r = corre('sangrado_abundante', {
      respuestas: { ...todas('sangrado_abundante', false), incomodas: dicho(true) },
    })
    expect(r.puntuacion).toBe(3)
    expect(r.instrumentoPositivo).toBe(true)
  })

  it('PPST: un solo sí ya dispara, y no finge tener sensibilidad', () => {
    expect(PPST.corte).toBe(1)
    expect(PPST.rendimiento).toBeNull()
    const r = corre('endometriosis', {
      respuestas: { ...todas('endometriosis', false), dolor_defecar: dicho(true) },
    })
    expect(r.instrumentoPositivo).toBe(true)
    expect(r.siguientePaso).toBe('consulta')
  })

  it('Pedersen: el vello puntúa a partir de TRES zonas, no de una', () => {
    const dos = corre('sop', { respuestas: { ciclo: dicho('menos_35'), vello: dicho(['labio', 'menton']), peso: dicho(false) } })
    expect(dos.puntuacion).toBe(0)
    const tres = corre('sop', { respuestas: { ciclo: dicho('menos_35'), vello: dicho(['labio', 'menton', 'espalda']), peso: dicho(false) } })
    expect(tres.puntuacion).toBe(1)
  })

  it('un hueco no vale cero: no se puntúa lo que no se contestó', () => {
    const { total, completo } = puntuar({
      evaluacion: EVALUACIONES.sangrado_abundante,
      banderas: {}, noEvaluable: [],
      respuestas: { dias7: dicho(true) },
    })
    expect(total).toBe(3)
    expect(completo).toBe(false)
  })
})

// ── Lo que sobrevive a todo ─────────────────────────────────────────────────

describe('las preguntas para el médico siempre salen', () => {
  it.each(['sop', 'sangrado_abundante', 'endometriosis'] as const)('%s', clave => {
    for (const r of [
      corre(clave, { respuestas: {} }),
      corre(clave, { respuestas: todas(clave, false) }),
      corre(clave, { banderas: { ...sinBanderas(clave), [EVALUACIONES[clave].banderas[0].id]: true } }),
    ]) {
      expect(r.preguntasParaMedico.length).toBeGreaterThan(0)
      expect(r.version).toBe(VERSION)
    }
  })
})

// ── Que nadie invente un instrumento ────────────────────────────────────────

describe('no hay nada inventado en los instrumentos', () => {
  it('los tres citan su artículo', () => {
    for (const e of Object.values(EVALUACIONES)) {
      expect(e.instrumento.fuente).toMatch(/\d{4}/)
      expect(e.instrumento.limite.length).toBeGreaterThan(40)
    }
  })

  it('el rótulo que se ve es un síntoma, nunca el nombre de la enfermedad', () => {
    const prohibidas = /SOP|ovario|endometriosis|mioma/i
    for (const e of Object.values(EVALUACIONES)) {
      expect(e.titulo).not.toMatch(prohibidas)
      expect(e.subtitulo).not.toMatch(prohibidas)
    }
  })

  it('solo se construyeron los tres que tienen instrumento', () => {
    expect(Object.keys(EVALUACIONES).sort()).toEqual(['endometriosis', 'sangrado_abundante', 'sop'])
  })
})
