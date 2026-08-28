/**
 * EVALUACIONES DE SÍNTOMAS · EL CONTRATO
 * ═══════════════════════════════════════════════════════════════════════════
 * Los tipos de los cuestionarios de cribado. Están aparte porque las
 * decisiones difíciles de este módulo son de FORMA, no de cálculo, y se ven
 * mejor sin cien líneas de ítems alrededor.
 *
 * ── No hay «probabilidad», hay PLAZO ───────────────────────────────────────
 * La tabla nació con `likelihood` en baja/moderada/alta. Al ir a construir
 * los cuestionarios, la literatura dijo que esa escala no existe: los tres
 * instrumentos implementables son BINARIOS —Pedersen corta en ≥2 sobre 4,
 * SAMANTA-Q en ≥3 sobre 10, el PPST dispara con un solo «sí»— y ninguno da
 * tres niveles. «Moderada» habría que fabricarla.
 *
 * Y hay una razón de fondo, más importante que la aritmética. «SOP · alta»
 * tiene la misma forma que un informe de anatomía patológica: nombre de
 * enfermedad y grado, pegados. Se sale de la pantalla diciendo «la app dice
 * que tengo SOP». Un PLAZO no se puede leer así: «coméntalo en tu próxima
 * consulta» es una acción, y una acción no es un diagnóstico.
 *
 * ── «Sin señales» no es «no lo tienes» ─────────────────────────────────────
 * De los dos errores posibles, el falso tranquilizador es el que hace daño de
 * verdad, y no por poco. El susto se corrige en la consulta: se va asustada y
 * se sale con una ecografía normal. El «no tienes nada» no se corrige nunca,
 * porque cierra el bucle —deja de registrar, deja de preguntar— y el propio
 * resultado guardado se convierte en la prueba de que ya lo miró.
 *
 * Los números lo respaldan: Pedersen deja fuera a 1 de cada 4-7 mujeres con
 * SOP. Y el daño documentado en SOP y endometriosis no es que falten
 * cuestionarios: es la DEMORA —uno de cada tres tarda más de dos años—. Un
 * cribado que produce «baja» añade una parada más a ese recorrido.
 *
 * Por eso `sin_senales` solo se puede emitir si un instrumento corrió ENTERO
 * y dio negativo, y la pantalla que lo enseña nunca dice «no tienes»: dice
 * qué se preguntó, qué no puede saber, y cuándo volver a mirar.
 */

/** Los tres flujos con instrumento validado detrás. */
export type ClaveEvaluacion = 'sop' | 'sangrado_abundante' | 'endometriosis'

/**
 * De dónde salió cada respuesta.
 *
 * Es el mismo cuidado que ya tiene el PDF clínico, que distingue el inicio de
 * ciclo que ella declaró del que dedujo la app. Sin esto, un «no» precargado
 * que pasó sin leer es indistinguible de uno que tecleó —ni para ella, ni
 * para el médico que lo lea, ni para nosotros si algún día hay que recalibrar.
 */
export type Fuente = 'usuaria' | 'precargado_aceptado' | 'precargado_corregido'

export interface Respuesta {
  /* La lista es para el ítem del vello: al instrumento solo le importa
     CUÁNTAS zonas son, pero guardar cuáles vale para la consulta —el médico
     mira dónde crece, no solo si crece. */
  valor: boolean | number | string | string[] | null
  fuente: Fuente
  /** Qué módulo produjo la precarga, p. ej. `periodos.diasSangrado`. */
  origen?: string
  /** Sobre cuántas observaciones se precargó. */
  n?: number
  /** La ventana de fechas que se miró, para poder releerla dentro de un año. */
  ventana?: [string, string]
}

/** Cómo terminó el cuestionario. Decide qué se puede afirmar. */
export type Estado = 'completo' | 'parcial' | 'no_evaluable' | 'bandera_roja'

/**
 * Lo único que se le enseña. Un plazo, nunca un grado.
 *
 * `urgente` no dice «vía rápida en dos semanas»: eso es vocabulario del NHS y
 * en México no significa nada, solo produce susto sin destino. Dice hoy, esta
 * semana, o en tu próxima cita.
 */
export type SiguientePaso = 'urgente' | 'consulta' | 'sin_senales'

export interface TipoRespuestaSiNo { tipo: 'si_no' }
export interface TipoRespuestaOpciones { tipo: 'opciones'; opciones: { valor: string; texto: string }[] }
export interface TipoRespuestaZonas { tipo: 'zonas'; zonas: { id: string; texto: string }[] }

export type TipoRespuesta = TipoRespuestaSiNo | TipoRespuestaOpciones | TipoRespuestaZonas

export interface Item {
  id: string
  pregunta: string
  respuesta: TipoRespuesta
  /** Aclaración corta bajo la pregunta, cuando el ítem se presta a leerse mal. */
  ayuda?: string
  /**
   * Puntos que suma un «sí» (o la opción que puntúa). Puede ser negativo: el
   * ítem 4 de Pedersen RESTA, y eso obliga a tratarlo aparte (ver `banderas`).
   */
  puntos?: number
  /** Si es `true`, este ítem no entra en el total y se evalúa por su cuenta. */
  fueraDelTotal?: boolean
}

export interface Instrumento {
  /** Con año, para que una fila de hace dos años se pueda releer. */
  id: string
  nombre: string
  fuente: string
  items: Item[]
  /** El corte publicado. `null` cuando el instrumento no tiene puntuación. */
  corte: number | null
  /** Cómo se lee el corte, en las palabras del propio artículo. */
  regla: string
  /** Sensibilidad y especificidad publicadas, si las hay. */
  rendimiento: string | null
  /** Qué NO puede hacer. Se enseña, no se esconde. */
  limite: string
}

export interface Bandera {
  id: string
  /** La pregunta que la detecta. */
  pregunta: string
  ayuda?: string
  /** Qué hacer si sale que sí. */
  paso: Exclude<SiguientePaso, 'sin_senales'>
  /** Por qué, en una línea que se pueda enseñar. */
  porque: string
}

export interface Evaluacion {
  clave: ClaveEvaluacion
  /** El rótulo que ve ella: un SÍNTOMA, nunca el nombre de la enfermedad. */
  titulo: string
  subtitulo: string
  instrumento: Instrumento
  /** Se preguntan ANTES que nada y cortan el cuestionario. */
  banderas: Bandera[]
  /** Condiciones bajo las que este cribado no se puede interpretar. */
  noEvaluableSi: { motivo: string; explicacion: string }[]
  /** Lo que ella puede llevarse a la consulta pase lo que pase. */
  preguntasParaMedico: string[]
}

export interface Resultado {
  clave: ClaveEvaluacion
  version: string
  estado: Estado
  siguientePaso: SiguientePaso
  instrumento: string | null
  instrumentoPositivo: boolean | null
  puntuacion: number | null
  noEvaluableMotivo: string | null
  banderas: string[]
  respuestas: Record<string, Respuesta>
  preguntasParaMedico: string[]
}
