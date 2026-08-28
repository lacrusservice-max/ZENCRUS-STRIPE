/**
 * EVALUAR · de las respuestas al plazo
 * ═══════════════════════════════════════════════════════════════════════════
 * Función pura. Entra lo que contestó, sale qué hacer con ello.
 *
 * ── La precarga NO responde por ella ───────────────────────────────────────
 * El plan prometía bajar el cuestionario «de 30 preguntas a 8» rellenando lo
 * que ya está registrado. Al mapear ítem por ítem, esa promesa no se sostiene,
 * y el sitio donde se rompe es justo el peor.
 *
 * El ítem 1 del SAMANTA-Q —«¿sangras más de 7 días?»— parece precargable
 * desde `diasSangrado`. No lo es: ese campo cuenta días CON REGISTRO, no días
 * transcurridos, y su error va SIEMPRE en la misma dirección. Sangró nueve
 * días, se saltó de apuntar dos, y los dos últimos fueron manchado que no
 * suma: `diasSangrado` da 5, y la app precargaría «No». Ese ítem vale 3 de los
 * 10 puntos del cuestionario y el corte está en 3, así que un solo «No»
 * precargado y no leído puede tumbar el cribado entero.
 *
 * Y hay un problema más general debajo: casi todos los ítems de los tres
 * instrumentos son subjetivos —«¿encuentras tus reglas incómodas?», «¿evitas
 * planes?»— y no hay ningún dato del que deducirlos sin inventar.
 *
 * Así que la precarga hace otra cosa, más pequeña y honesta: enseña el dato al
 * lado de la pregunta —«tus últimos 4 periodos: 6, 5, 7 y 6 días registrados»—
 * y la deja contestar a ella. Se responde igual de rápido, se aprende algo, y
 * ningún «no» acaba guardado como suyo sin que lo haya dicho.
 *
 * Por eso `Respuesta.fuente` existe igualmente en el contrato: el día que algo
 * sí se precargue de verdad, la columna ya sabrá distinguirlo.
 */

import type {
  Evaluacion, Respuesta, Resultado, Estado, SiguientePaso,
} from './tipos'

/** La versión del cuestionario. Sube si cambian ítems, textos o reglas. */
export const VERSION = '2026.08.1'

export interface EntradaEvaluacion {
  evaluacion: Evaluacion
  /** Respuestas a las banderas rojas, por id. */
  banderas: Record<string, boolean | null>
  /** Respuestas a los ítems del instrumento, por id. */
  respuestas: Record<string, Respuesta>
  /** Motivos de no evaluable que se cumplen, por id. */
  noEvaluable: string[]
}

/** Si un ítem de Pedersen puntúa, según su valor. */
function puntuaPedersen(id: string, valor: Respuesta['valor']): boolean {
  if (id === 'ciclo') return valor === '35_60' || valor === 'mas_60' || valor === 'variable'
  /* Tres zonas o más, que es el corte del artículo. Se guarda la lista y no
     el número: al instrumento le basta cuántas, pero a la consulta le importa
     cuáles. */
  if (id === 'vello') return Array.isArray(valor) && valor.length >= 3
  return valor === true
}

/**
 * La puntuación, o `null` si el cuestionario no se puede puntuar.
 *
 * Un ítem sin contestar no vale cero: vale «no se sabe», y sumar ceros por los
 * huecos daría siempre una puntuación baja, que es el error que hace daño.
 */
export function puntuar(
  entrada: EntradaEvaluacion,
): { total: number; completo: boolean } {
  const { evaluacion, respuestas } = entrada
  let total = 0
  let completo = true

  for (const item of evaluacion.instrumento.items) {
    if (item.fueraDelTotal) continue
    const r = respuestas[item.id]
    if (!r || r.valor === null || r.valor === undefined) { completo = false; continue }

    const suma = evaluacion.instrumento.id === 'pedersen_2007'
      ? puntuaPedersen(item.id, r.valor)
      : r.valor === true

    if (suma) total += item.puntos ?? 1
  }

  return { total, completo }
}

/**
 * El resultado.
 *
 * El orden de las ramas ES la seguridad, y no es intercambiable:
 *
 *   1. Bandera roja. Corta todo. Ni se puntúa ni se mira nada más.
 *   2. No evaluable. Con anticoncepción hormonal, un negativo de SOP no
 *      significa nada, así que no se emite ninguno.
 *   3. Incompleto. Sin todas las respuestas no hay puntuación, y sobre todo
 *      no hay derecho a decir que no se encontró nada.
 *   4. Completo. Solo aquí puede salir `sin_senales`, y solo si el
 *      instrumento corrió entero y dio negativo.
 */
export function evaluar(entrada: EntradaEvaluacion): Resultado {
  const { evaluacion, banderas, respuestas, noEvaluable } = entrada
  const base = {
    clave: evaluacion.clave,
    version: VERSION,
    respuestas,
    preguntasParaMedico: evaluacion.preguntasParaMedico,
  }

  /* 1 · Banderas rojas ─────────────────────────────────────────────────────
     Se escribe fila igualmente, con las respuestas que hubiera y las preguntas
     para el médico. Antes esto no tenía dónde caerse: o no quedaba rastro del
     caso más urgente, o había que inventarle un resultado para poder guardar. */
  const encendidas = evaluacion.banderas.filter(b => banderas[b.id] === true)
  if (encendidas.length) {
    const urgente = encendidas.some(b => b.paso === 'urgente')
    return {
      ...base,
      estado: 'bandera_roja' as Estado,
      siguientePaso: (urgente ? 'urgente' : 'consulta') as SiguientePaso,
      instrumento: null,
      instrumentoPositivo: null,
      puntuacion: null,
      noEvaluableMotivo: null,
      banderas: encendidas.map(b => b.id),
    }
  }

  /* 2 · No evaluable ───────────────────────────────────────────────────────
     No es un fallo ni un «no sabemos»: es el resultado, y se dice con esas
     palabras. Que la píldora tape los síntomas no es lo mismo que no tenerlos. */
  if (noEvaluable.length) {
    const motivo = evaluacion.noEvaluableSi.find(n => n.motivo === noEvaluable[0])
    return {
      ...base,
      estado: 'no_evaluable' as Estado,
      siguientePaso: 'consulta' as SiguientePaso,
      instrumento: null,
      instrumentoPositivo: null,
      puntuacion: null,
      noEvaluableMotivo: motivo?.explicacion ?? noEvaluable[0],
      banderas: [],
    }
  }

  const { total, completo } = puntuar(entrada)

  /* 3 · Incompleto ─────────────────────────────────────────────────────────
     Si ya ha superado el corte con lo contestado, eso no se pierde: un
     positivo no necesita las preguntas que faltan. Lo que no se puede es lo
     contrario, decir que no hay nada con el cuestionario a medias. */
  const corte = evaluacion.instrumento.corte
  const yaPositivo = corte != null && total >= corte

  if (!completo && !yaPositivo) {
    return {
      ...base,
      estado: 'parcial' as Estado,
      siguientePaso: 'consulta' as SiguientePaso,
      instrumento: evaluacion.instrumento.id,
      instrumentoPositivo: null,
      puntuacion: null,
      noEvaluableMotivo: null,
      banderas: [],
    }
  }

  /* 4 · Completo ───────────────────────────────────────────────────────────── */
  const positivo = corte != null && total >= corte
  return {
    ...base,
    estado: (completo ? 'completo' : 'parcial') as Estado,
    siguientePaso: (positivo ? 'consulta' : 'sin_senales') as SiguientePaso,
    instrumento: evaluacion.instrumento.id,
    instrumentoPositivo: positivo,
    puntuacion: total,
    noEvaluableMotivo: null,
    banderas: [],
  }
}
