/**
 * QUÉ COMER Y CÓMO MOVERSE HOY
 * ═══════════════════════════════════════════════════════════════════════════
 * La tabla de síntomas, la guía por fase y las señales de alerta, como DATO.
 * Y encima, la regla de selección: qué se enseña hoy, de todo lo que se podría
 * decir.
 *
 * ── Por qué es dato y no un prompt ─────────────────────────────────────────
 * La tentación es meter las diez filas dentro de una cadena y dejar que el
 * modelo las recite. Se hace así y pasan tres cosas: la tarjeta no se puede
 * pintar sin conexión, cada apertura de la app cuesta una llamada, y dos
 * usuarias con el mismo síntoma reciben consejos distintos sin motivo. Con la
 * tabla como estructura, la app responde al instante y el modelo queda para lo
 * que sí sabe hacer: personalizar el tono y cruzarlo con lo de hoy.
 *
 * ── Por qué vive en el núcleo compartido ───────────────────────────────────
 * Porque la necesitan los dos lados. El servidor la usa para el contexto de
 * ZENA; la app la usa para la tarjeta «Hoy recomendamos», que tiene que salir
 * aunque no haya red —y hoy los registros del ciclo viven en el teléfono, así
 * que el servidor ni siquiera puede calcularla solo—. Estaba escrita dos
 * veces: la guía larga en `services/cicloExperto.ts` y una línea por fase en
 * `NotaDeFase.tsx`. Dos copias que ya decían cosas distintas de la fase lútea.
 *
 * ── Aquí NO hay días de calendario ─────────────────────────────────────────
 * Las fichas de fase tenían un campo `rango` con «día 1 al 5», «alrededor del
 * día 14». Se ha ido, y no es una limpieza: es el error que el motor entero
 * existe para no cometer. La ovulación se calcula como C − 13 sobre el ciclo
 * real de cada una, así que en un ciclo de 21 días cae en el 8. Meter «día 14»
 * en el prompt junto a «día del ciclo: 8» le está dando al modelo dos datos
 * que se contradicen, y el que gana es el que suena a norma.
 *
 * ── Y no promete rendimiento ───────────────────────────────────────────────
 * La evidencia 2023-2025 sobre fase y rendimiento —fuerza máxima, hipertrofia—
 * es débil e inconsistente; varias revisiones concluyen que es prematuro
 * afirmarlo. Lo que sí se sostiene es el manejo de síntomas y la constancia, y
 * en esos términos está escrito todo lo de aquí. No hay una sola frase que
 * prometa quemar más grasa ni rendir más por estar en una fase.
 */

import { ORDEN_FASES, type Fase, type MarcoFases } from './fases'

/* ═══════════════════════════════════════════════════════════════════════════
   1 · La tabla de síntomas
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FichaSintoma {
  /** La clave interna. No es lo que registra la usuaria: ver `SENAL`. */
  id: string
  etiqueta: string
  /** Qué pasa en el cuerpo, en una frase que se lea sin estudiar nada. */
  fisiologia: string
  /** La explicación larga. Va al modelo, no a la tarjeta. */
  nutricion: string
  /** `null` cuando no hay recomendación de movimiento con respaldo. */
  entrenamiento: string | null
  /**
   * Lo concreto, para la tarjeta. Varias porque se rotan.
   *
   * El documento pide no repetir siempre los mismos tres ejemplos, y tiene
   * razón por un motivo práctico: una tarjeta que dice lo mismo cada día deja
   * de leerse a la semana. Se elige por el día del año, así que cambia entre
   * días pero NO entre renders del mismo día — una sugerencia que baila
   * mientras la lees es peor que una repetida.
   */
  ejemplos: string[]
  /** Lo concreto de movimiento. Vacío = se usa el de la fase. */
  ejemplosEntreno: string[]
}

export const SINTOMAS: FichaSintoma[] = [
  {
    id: 'colicos',
    etiqueta: 'Cólicos / dolor menstrual',
    fisiologia: 'El útero libera prostaglandinas para desprender el endometrio; en exceso generan inflamación y contracciones más dolorosas.',
    nutricion: 'Omega-3 (salmón, chía, linaza) y alimentos antiinflamatorios; magnesio (semillas de calabaza, plátano, chocolate oscuro); reducir ultraprocesados y exceso de sal.',
    entrenamiento: 'Movimiento suave: caminata, estiramientos, yoga con torsiones suaves y posturas de cadera abierta; el calor local más movimiento leve mejora el flujo sanguíneo pélvico.',
    ejemplos: [
      'Un puñado de semillas de calabaza: el magnesio ayuda con las contracciones.',
      'Salmón, sardinas o una cucharada de linaza molida — omega-3 baja la inflamación.',
      'Chía en el desayuno y menos ultraprocesados hoy: la sal empeora los cólicos.',
      'Chocolate oscuro del 70 % o más: magnesio, y sin el bajón del azúcar.',
    ],
    ejemplosEntreno: [
      'Caminar veinte minutos y estiramientos de cadera: el movimiento suave alivia más que el reposo.',
      'Yoga con posturas de cadera abierta, y calor local antes.',
      'Movilidad tranquila. Hoy el objetivo es circular, no rendir.',
    ],
  },
  {
    id: 'fatiga',
    etiqueta: 'Fatiga',
    fisiologia: 'Estrógeno y hierro están en su punto más bajo durante el sangrado; el cuerpo gasta energía extra reponiendo lo perdido.',
    nutricion: 'Hierro (carnes rojas magras, legumbres, espinaca) con vitamina C para mejorar su absorción (cítricos, pimiento); carbohidratos complejos para energía sostenida.',
    entrenamiento: 'Bajar el volumen e intensidad sin culpa; sesiones cortas o de recuperación activa; escuchar la señal de energía baja como información, no como fracaso.',
    ejemplos: [
      'Lentejas con pimiento rojo: el hierro se absorbe mucho mejor con vitamina C al lado.',
      'Espinaca con unas gotas de limón, y avena para sostener la energía.',
      'Carne roja magra o garbanzos, con algo cítrico de postre.',
      'Avena o arroz integral: los complejos sostienen más que un café.',
    ],
    ejemplosEntreno: [
      'Baja el volumen hoy sin darle vueltas. La energía baja es información, no falta de voluntad.',
      'Una sesión corta de recuperación activa cuenta igual para la racha.',
      'Camina. Es entrenamiento y hoy es el que toca.',
    ],
  },
  {
    id: 'cabeza',
    etiqueta: 'Dolor de cabeza / migraña',
    fisiologia: 'Suele coincidir con la caída brusca de estrógeno, justo antes o al inicio del sangrado.',
    nutricion: 'Buena hidratación, magnesio, evitar ayunos largos y estabilizar el azúcar en sangre con comidas regulares.',
    entrenamiento: 'Evitar entrenamientos de muy alta intensidad ese día; priorizar descanso, luz baja y movimiento ligero si el cuerpo lo permite.',
    ejemplos: [
      'No te saltes comidas hoy: los ayunos largos son de lo que más lo agrava.',
      'Agua y magnesio. La deshidratación leve basta para disparar el dolor.',
      'Come cada tres o cuatro horas para no dejar caer el azúcar en sangre.',
    ],
    ejemplosEntreno: [
      'Hoy nada de alta intensidad. Luz baja y movimiento ligero si el cuerpo lo permite.',
      'Deja el entreno fuerte para otro día; un paseo tranquilo sí ayuda.',
    ],
  },
  {
    id: 'hinchazon',
    etiqueta: 'Inflamación / hinchazón abdominal',
    fisiologia: 'La progesterona alta de la fase lútea enlentece la digestión y favorece la retención de líquidos.',
    nutricion: 'Reducir sodio y ultraprocesados; aumentar fibra de forma progresiva para no empeorar la hinchazón de golpe; té de jengibre o hinojo como apoyo digestivo.',
    entrenamiento: 'Ejercicio de bajo impacto que active la circulación (caminar, pilates); evitar comparar el abdomen hinchado con otros días — es fisiológico, no pérdida de progreso.',
    ejemplos: [
      'Té de jengibre o de hinojo después de comer: apoya la digestión lenta de estos días.',
      'Baja el sodio de ultraprocesados hoy, no el de la comida real.',
      'Sube la fibra poco a poco, no de golpe: de golpe hincha más.',
    ],
    ejemplosEntreno: [
      'Bajo impacto: caminar o pilates activan la circulación sin castigar.',
      'El abdomen hinchado de hoy es fisiológico, no progreso perdido. Muévete suave.',
    ],
  },
  {
    id: 'antojos',
    etiqueta: 'Antojos (dulce, salado, carbohidratos)',
    fisiologia: 'La progesterona eleva ligeramente el metabolismo basal y el gasto energético en fase lútea, así que el apetito sube de verdad, no es solo antojo emocional.',
    nutricion: 'Anticiparse con snacks nutritivos (fruta con mantequilla de maní, yogur con avena) en vez de restringir; el chocolate oscuro de 70 % o más cubre el antojo de dulce con menos azúcar y algo de magnesio.',
    entrenamiento: 'No es momento de iniciar un déficit calórico agresivo; mantener constancia con entrenamientos moderados regula el apetito mejor que restringir comida.',
    ejemplos: [
      'Ten listo un snack de verdad: fruta con mantequilla de maní, yogur con avena.',
      'Chocolate del 70 % cubre el antojo de dulce con bastante menos azúcar.',
      'El hambre de hoy es real: el gasto basal sube en esta fase. Come, pero come algo que sostenga.',
      'Hummus con zanahoria si el antojo es salado: sacia sin el bajón de después.',
    ],
    ejemplosEntreno: [
      'Mantén la constancia con algo moderado. Restringir hoy suele salir caro mañana.',
      'No es el día de empezar un déficit agresivo. Entrena normal y come.',
    ],
  },
  {
    id: 'animo',
    etiqueta: 'Cambios de ánimo / irritabilidad',
    fisiologia: 'La caída de progesterona y estrógeno al final de la fase lútea afecta a la serotonina.',
    nutricion: 'Triptófano y carbohidratos complejos (avena, plátano, legumbres) apoyan la producción de serotonina; la vitamina B6 (garbanzos, pollo) se asocia a menor irritabilidad premenstrual.',
    entrenamiento: 'El ejercicio aeróbico moderado (caminar rápido, bici, baile) es de lo más efectivo para regular el ánimo — más que la intensidad, importa la constancia.',
    ejemplos: [
      'Avena con plátano: triptófano y complejos, que es lo que la serotonina necesita.',
      'Garbanzos o pollo hoy — la B6 se asocia a menos irritabilidad premenstrual.',
      'Legumbres en la comida principal. Sostienen el ánimo mejor que un dulce rápido.',
    ],
    ejemplosEntreno: [
      'Aeróbico moderado —caminar rápido, bici, baile—: para el ánimo es de lo más efectivo que hay.',
      'Sal a moverte aunque sea poco. Para esto la constancia gana a la intensidad.',
    ],
  },
  {
    id: 'acne',
    etiqueta: 'Piel / acné premenstrual',
    fisiologia: 'El aumento relativo de andrógenos en la fase lútea tardía estimula la producción de sebo.',
    nutricion: 'Zinc (semillas de calabaza, legumbres) y omega-3; cuidar los picos de azúcar, que pueden agravar la inflamación de la piel.',
    entrenamiento: null,
    ejemplos: [
      'Zinc: semillas de calabaza o legumbres. Y cuidado con los picos de azúcar de hoy.',
      'Omega-3 y menos azúcar rápido: la inflamación de la piel responde a eso.',
    ],
    ejemplosEntreno: [],
  },
  {
    id: 'insomnio',
    etiqueta: 'Insomnio / mal descanso',
    fisiologia: 'La caída de progesterona —que tiene un efecto calmante leve— antes del periodo puede afectar a la calidad del sueño.',
    nutricion: 'Evitar cafeína después del mediodía esos días; magnesio antes de dormir; cenas más ligeras y tempranas.',
    entrenamiento: 'Evitar entrenar muy intenso cerca de la hora de dormir esos días; priorizar rutinas de bajada de revoluciones (estiramientos, respiración).',
    ejemplos: [
      'Corta la cafeína a partir del mediodía hoy, y cena ligero y temprano.',
      'Magnesio antes de dormir, y cena al menos dos horas antes de acostarte.',
    ],
    ejemplosEntreno: [
      'Si entrenas, que sea temprano: intenso y cerca de la cama hoy te va a costar dormir.',
      'Termina con estiramientos y respiración, para bajar revoluciones.',
    ],
  },
  {
    id: 'retencion',
    etiqueta: 'Retención de líquidos',
    fisiologia: 'Progesterona y aldosterona favorecen que el cuerpo retenga más sodio y agua en fase lútea.',
    nutricion: 'Reducir el sodio de ultraprocesados —no el sodio natural de la comida—; aumentar potasio (plátano, palta, papa); mantener buena hidratación, que aunque suene contraintuitivo ayuda a des-retener.',
    entrenamiento: 'Movimiento suave y regular ayuda más que el reposo total a drenar la retención.',
    ejemplos: [
      'Potasio: plátano, palta o papa. Y bebe agua — retener no se arregla bebiendo menos.',
      'Menos sodio de ultraprocesados, no menos sal de la comida real.',
    ],
    ejemplosEntreno: [
      'Movimiento suave y regular drena mejor que quedarse quieta.',
    ],
  },
  {
    id: 'libido',
    etiqueta: 'Cambios en el deseo sexual',
    fisiologia: 'La libido suele acompañar al pico de estrógeno y testosterona de la ovulación, y bajar en fase lútea y menstrual.',
    nutricion: 'No hay una recomendación nutricional específica con evidencia sólida; mantener buena energía general (hierro, sueño, hidratación) ayuda de forma indirecta.',
    entrenamiento: null,
    /* Sin ejemplos a propósito: no hay nada concreto que recomendar con
       respaldo, y rellenar el hueco con un alimento plausible sería inventarse
       una recomendación. Cuando este es el único síntoma, se cae a la fase. */
    ejemplos: [],
    ejemplosEntreno: [],
  },
]

export const SINTOMA_POR_ID = new Map(SINTOMAS.map(s => [s.id, s]))

/**
 * El orden en que se atiende un síntoma cuando hay varios.
 *
 * No es arbitrario ni es el orden de la tabla: va de lo que más condiciona el
 * día a lo que menos. El dolor manda sobre el ánimo, y el ánimo sobre la piel,
 * porque quien abre la app con cólicos y acné el mismo día no quiere leer
 * sobre el zinc. `libido` queda fuera: no tiene nada concreto que ofrecer.
 */
export const PRIORIDAD: string[] = [
  'colicos', 'cabeza', 'fatiga', 'insomnio', 'hinchazon',
  'animo', 'antojos', 'retencion', 'acne', 'libido',
]

/* ═══════════════════════════════════════════════════════════════════════════
   2 · La guía por fase
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FichaFase {
  etiqueta: string
  hormonas: string
  favorece: string
  /** La explicación larga, para el modelo. */
  comer: string
  entrenar: string
  /** Lo concreto para la tarjeta, rotado igual que en los síntomas. */
  ejemplos: string[]
  ejemplosEntreno: string[]
  /** Una línea, para la tira que va en Nutrición y en Entrena. */
  notaNutricion: string
  notaEntreno: string
}

export const FASES: Record<Fase, FichaFase> = {
  menstrual: {
    etiqueta: 'Menstrual',
    hormonas: 'Estrógeno y progesterona en su punto más bajo del ciclo.',
    favorece: 'Bajar el ritmo sin culpa, reponer hierro y tomarse la energía baja como información válida.',
    comer: 'Hierro con vitamina C (lentejas con pimiento, espinaca con cítricos), omega-3 antiinflamatorio, buena hidratación, comidas calientes y reconfortantes.',
    entrenar: 'Caminatas, yoga, movilidad, pilates suave; si el cuerpo lo pide, fuerza ligera está bien — la clave es que sea elección, no exigencia.',
    ejemplos: [
      'Hierro con vitamina C: lentejas con pimiento, o espinaca con algo cítrico.',
      'Algo caliente y reconfortante, y agua. Estos días el cuerpo repone.',
      'Salmón o linaza: el omega-3 juega a favor esta semana.',
    ],
    ejemplosEntreno: [
      'Caminar, yoga o movilidad. Fuerza ligera si te apetece, no si toca.',
      'Bajar el ritmo hoy es elección, no rendirse.',
    ],
    notaNutricion: 'Hierro y magnesio ayudan estos días: lentejas, espinaca, semillas de calabaza.',
    notaEntreno: 'Si el cuerpo pide bajar el ritmo, bájalo. Caminar, movilidad o yoga cuentan.',
  },
  folicular: {
    etiqueta: 'Folicular',
    hormonas: 'El estrógeno sube de forma sostenida; suele acompañarse de más energía, mejor ánimo y mejor tolerancia al esfuerzo percibido.',
    favorece: 'Construir hábito, probar cosas nuevas y progresar cargas de forma gradual.',
    comer: 'Proteína magra y carbohidratos complejos (quinoa, avena, arroz integral) para sostener el mayor gasto; vegetales crucíferos y fermentados, que apoyan el metabolismo del estrógeno.',
    entrenar: 'Buen momento para fuerza progresiva y cardio de mayor intensidad, aprovechando que la energía percibida suele ser más alta — según cómo se sienta cada usuaria, no como regla fija.',
    ejemplos: [
      'Proteína magra con quinoa o arroz integral: el gasto sube con la energía.',
      'Brócoli, coliflor o algo fermentado — apoyan el metabolismo del estrógeno.',
      'Avena en el desayuno y proteína en cada comida. Sencillo y sostiene.',
    ],
    ejemplosEntreno: [
      'Si sientes la energía, es buen momento para progresar cargas.',
      'Buen día para cardio de más intensidad, si el cuerpo acompaña.',
    ],
    notaNutricion: 'Buen momento para proteína y carbohidratos complejos; el gasto sube con la energía.',
    notaEntreno: 'Suele haber más energía. Si la sientes, es buen momento para progresar cargas.',
  },
  ovulatoria: {
    etiqueta: 'Ovulatoria',
    hormonas: 'Pico de estrógeno y un pequeño pico de testosterona; suele coincidir con el punto más alto de energía percibida del ciclo.',
    favorece: 'Retos de alta intensidad si el cuerpo acompaña, aunque la ventana es corta y muy variable entre personas.',
    comer: 'Mantener proteína y carbohidratos complejos; buen día para comidas sociales o más variadas, sin necesidad de restricciones.',
    entrenar: 'Alta intensidad (HIIT, cargas más pesadas) si la energía acompaña — sin forzarlo si no es así, porque la variabilidad individual es alta.',
    ejemplos: [
      'Mantén proteína y complejos. Buen día para comer variado, sin restricciones.',
      'Si hay comida social hoy, disfrútala: no hace falta compensar nada.',
    ],
    ejemplosEntreno: [
      'Si la energía acompaña, hoy admite alta intensidad o cargas más pesadas.',
      'Punto alto de energía en muchas personas. Aprovéchalo solo si lo notas.',
    ],
    notaNutricion: 'Mantén proteína y complejos. Buen día para comer variado, sin restricciones.',
    notaEntreno: 'Punto alto de energía en muchas personas. Alta intensidad si el cuerpo acompaña.',
  },
  lutea: {
    etiqueta: 'Lútea',
    hormonas: 'La progesterona sube y luego cae junto al estrógeno al final de la fase; el metabolismo basal se eleva un poco (más apetito real) y pueden aparecer síntomas premenstruales.',
    favorece: 'Constancia y manejo de síntomas por encima de la intensidad; es normal necesitar más comida y más descanso hacia el final.',
    comer: 'Carbohidratos complejos y fibra para estabilizar el azúcar en sangre y controlar antojos; magnesio y vitamina B6 para síntomas premenstruales; anticiparse con snacks nutritivos en vez de restringir.',
    entrenar: 'Bajar gradualmente la intensidad hacia el final; el cardio moderado (caminar rápido, bici, baile) es especialmente útil para el ánimo; fuerza con cargas moderadas está bien si el cuerpo responde.',
    ejemplos: [
      'Complejos y fibra para sostener el azúcar en sangre: es lo que corta los antojos.',
      'Es normal tener más hambre: el gasto basal sube en esta fase. Come algo que aguante.',
      'Magnesio y B6 —semillas, garbanzos— para los síntomas premenstruales.',
    ],
    ejemplosEntreno: [
      'Cardio moderado: para el ánimo de esta fase es de lo más útil.',
      'Cargas moderadas si el cuerpo responde. Hacia el final, ir bajando.',
    ],
    notaNutricion: 'Es normal tener más hambre: el gasto basal sube en esta fase. Fibra y complejos sostienen mejor que restringir.',
    notaEntreno: 'Hacia el final de la fase la intensidad suele costar más. El cardio moderado ayuda al ánimo.',
  },
}

/* ═══════════════════════════════════════════════════════════════════════════
   3 · De lo que registró a lo que dice la tabla
   ═══════════════════════════════════════════════════════════════════════════ */

type Dia = Record<string, unknown>

/** Energía por debajo de la cual no se sugiere intensidad, pase lo que pase. */
export const ENERGIA_BAJA = 2

/** Valencia por debajo de la cual el ánimo cuenta como síntoma. */
const ANIMO_BAJO = -0.35

/** Intensidad de dolor (de 1 a 10) que se considera señal de alerta. */
export const DOLOR_ALERTA = 8

/** Nivel de sangrado que se considera señal de alerta. */
export const SANGRADO_ALERTA = 5

const zonas = (d: Dia): { id: string; intensity: number }[] =>
  ((d.dolor as { zones?: { id: string; intensity: number }[] } | undefined)?.zones) ?? []

const tags = (d: Dia, kind: string): string[] =>
  ((d[kind] as { tags?: string[] } | undefined)?.tags) ?? []

const nivel = (d: Dia, kind: string, campo = 'level'): number | null => {
  const v = (d[kind] as Record<string, unknown> | undefined)?.[campo]
  return typeof v === 'number' ? v : null
}

/**
 * Los síntomas de la tabla que hoy están presentes, según lo REGISTRADO.
 *
 * Cada regla apunta a un campo que existe de verdad en el esquema. Ninguna
 * inventa una etiqueta que la interfaz no ofrezca: un mapeo a un campo que no
 * se puede registrar produce una fila que nunca se dispara y nadie se entera
 * hasta que alguien va a buscar por qué su síntoma no sale nunca.
 *
 * `retencion` NO aparece aquí, y es a propósito: no hay ningún campo en el
 * registro diario que la exprese —ni etiqueta de digestión, ni de piel, ni
 * tracker propio—. Su ficha se conserva porque el modelo sí la usa cuando la
 * usuaria la menciona en el chat, pero desde el registro es inalcanzable, y
 * colgarla de «hinchazón» sería decidir por ella que son la misma cosa.
 */
export function sintomasDelDia(d: Dia): string[] {
  const z = zonas(d)
  const dig = tags(d, 'digestion')
  const piel = tags(d, 'piel')
  const peri = tags(d, 'perimenopausia')
  const animo = d.animo as { valence?: number } | undefined
  const sueno = d.sueno as { hours?: number; quality?: string } | undefined

  const fuera: string[] = []
  const con = (id: string, hay: boolean) => { if (hay) fuera.push(id) }

  con('colicos', z.some(x => x.id === 'abdomen_bajo' || x.id === 'ovarios'))
  con('cabeza', z.some(x => x.id === 'cabeza'))
  con('fatiga', (nivel(d, 'energia') ?? 99) <= ENERGIA_BAJA)
  con('hinchazon', dig.includes('hinchazon') || dig.includes('gases'))
  con('antojos', tags(d, 'antojos').length > 0 || dig.includes('antojos'))
  con('animo', typeof animo?.valence === 'number' && animo.valence <= ANIMO_BAJO)
  con('acne', piel.includes('acne') || piel.includes('grasa'))
  con('insomnio',
    sueno?.quality === 'mal'
    || (typeof sueno?.hours === 'number' && sueno.hours < 6)
    || peri.includes('insomnio'))
  con('libido', (nivel(d, 'libido', 'desire') ?? 99) <= 2)

  return fuera
}

/* ═══════════════════════════════════════════════════════════════════════════
   4 · Señales de alerta
   ═══════════════════════════════════════════════════════════════════════════ */

export interface Alerta {
  id: string
  /** Lo que se le dice. Nunca nombra una condición. */
  mensaje: string
}

/**
 * Cuándo sugerir que lo vea un profesional.
 *
 * Tres reglas y ninguna nombra una condición: ni anemia, ni endometriosis, ni
 * SOP. Decir «esto podría ser X» a alguien que abrió la app para apuntar cómo
 * durmió es hacer un diagnóstico sin serlo y sin poder sostenerlo.
 *
 * El documento pide detectar «dolor de cabeza súbito e intenso». Lo súbito no
 * se puede ver en el registro de un día —haría falta comparar con los
 * anteriores, y no registrar nada no es lo mismo que no tener dolor—, así que
 * se detecta lo intenso y se dice exactamente eso, sin dar por hecho lo otro.
 */
export function alertasDelDia(d: Dia): Alerta[] {
  const fuera: Alerta[] = []
  const z = zonas(d)

  const cabeza = z.find(x => x.id === 'cabeza')
  if (cabeza && cabeza.intensity >= DOLOR_ALERTA) {
    fuera.push({
      id: 'cabeza_intensa',
      mensaje: 'Has marcado un dolor de cabeza muy fuerte. Si aparece de golpe o se repite, vale la pena comentarlo con un profesional de salud.',
    })
  }

  const otro = z.find(x => x.id !== 'cabeza' && x.intensity >= DOLOR_ALERTA)
  if (otro) {
    fuera.push({
      id: 'dolor_incapacitante',
      mensaje: 'Un dolor de esta intensidad no tiene por qué formar parte de tu ciclo. Si te impide hacer vida normal, coméntalo con un profesional de salud.',
    })
  }

  if ((nivel(d, 'sangrado') ?? 0) >= SANGRADO_ALERTA) {
    fuera.push({
      id: 'sangrado_abundante',
      mensaje: 'Has registrado un sangrado muy abundante. Si se repite varios ciclos, es de las cosas que conviene revisar con un profesional de salud.',
    })
  }

  return fuera
}

/* ═══════════════════════════════════════════════════════════════════════════
   5 · La recomendación del día
   ═══════════════════════════════════════════════════════════════════════════ */

export type Motivo = 'sintoma' | 'antojo' | 'fase'

export interface Consejo {
  texto: string
  motivo: Motivo
  /** Qué ficha lo produjo: un id de síntoma o el nombre de la fase. */
  fuente: string
}

export interface Recomendacion {
  nutricion: Consejo
  entrenamiento: Consejo
  /** `null` si no hay ninguna señal. Va primero cuando la hay. */
  alerta: string | null
  /** El patrón del bloque 5, si lo hay, ya redactado. */
  patron: string | null
  /**
   * Cuando usa anticoncepción hormonal. Una frase, no una advertencia: su
   * ciclo no refleja fluctuaciones naturales, así que lo que se le ofrece es
   * bienestar y manejo de síntomas, no una ventana hormonal.
   */
  nota: string | null
}

export interface EntradaRecomendacion {
  fase: Fase
  /** El registro de hoy, tal cual. */
  dia: Dia
  /** Energía de hoy, si la registró. Manda sobre la fase. */
  energia: number | null
  anticonceptivo: string | null
  /** El patrón detectado por las estadísticas, ya en palabras. */
  patron?: string | null
  /**
   * Con qué rotar los ejemplos. Se espera el día del año o algo igual de
   * estable: lo importante es que NO cambie dentro del mismo día.
   */
  semilla: number
}

/** Elige de una lista sin azar: mismo día, misma elección. */
const rotar = <T,>(xs: T[], semilla: number): T | null =>
  xs.length ? xs[((semilla % xs.length) + xs.length) % xs.length] : null

/**
 * Qué se le dice hoy.
 *
 * El orden de prioridad es el del documento: lo registrado hoy manda sobre la
 * fase. Quien apuntó cólicos no necesita que le hablen de la fase folicular en
 * abstracto; necesita saber qué hacer con los cólicos.
 *
 * Y hay una regla que se salta a la fase entera: con energía de 1 o 2 no se
 * sugiere intensidad, aunque sea el día de ovulación y la guía diga que es el
 * mejor momento del mes. La guía describe una tendencia de población; la
 * energía registrada es un dato de ella. Gana el dato.
 */
export function recomendacionDelDia(e: EntradaRecomendacion): Recomendacion {
  const f = FASES[e.fase]
  const presentes = sintomasDelDia(e.dia)
  const alertas = alertasDelDia(e.dia)

  /* Se ordenan por prioridad clínica y se queda el primero que tenga algo
     concreto que decir. `libido` está en la lista pero no tiene ejemplos, así
     que nunca gana: no hay nada con respaldo que ofrecer y rellenarlo sería
     inventarlo. */
  const ordenados = PRIORIDAD.filter(id => presentes.includes(id))

  const nut = (() => {
    for (const id of ordenados) {
      const texto = rotar(SINTOMA_POR_ID.get(id)?.ejemplos ?? [], e.semilla)
      if (texto) {
        return {
          texto,
          motivo: (id === 'antojos' ? 'antojo' : 'sintoma') as Motivo,
          fuente: id,
        }
      }
    }
    return {
      texto: rotar(f.ejemplos, e.semilla) ?? f.notaNutricion,
      motivo: 'fase' as Motivo,
      fuente: e.fase,
    }
  })()

  const sinFuerza = e.energia !== null && e.energia <= ENERGIA_BAJA

  const ent = (() => {
    /* Con energía baja se salta la fase y se va directo a la ficha de fatiga,
       que es la única que habla el idioma de un día así. Si además hay otro
       síntoma con recomendación propia, ese gana: dolor de cabeza con energía
       baja sigue siendo, sobre todo, dolor de cabeza. */
    const cola = sinFuerza
      ? [...ordenados.filter(id => id !== 'fatiga'), 'fatiga']
      : ordenados

    for (const id of cola) {
      const texto = rotar(SINTOMA_POR_ID.get(id)?.ejemplosEntreno ?? [], e.semilla)
      if (texto) {
        return {
          texto,
          motivo: (id === 'antojos' ? 'antojo' : 'sintoma') as Motivo,
          fuente: id,
        }
      }
    }
    return {
      texto: rotar(f.ejemplosEntreno, e.semilla) ?? f.notaEntreno,
      motivo: 'fase' as Motivo,
      fuente: e.fase,
    }
  })()

  return {
    nutricion: nut,
    entrenamiento: ent,
    alerta: alertas.length ? alertas[0].mensaje : null,
    patron: e.patron ?? null,
    nota: e.anticonceptivo
      ? 'Con anticoncepción hormonal tu ciclo no sigue las subidas y bajadas naturales, así que esto va de cómo te sientes hoy, no de en qué fase estás.'
      : null,
  }
}

/**
 * La semilla estándar: el día del año.
 *
 * Se calcula desde la fecha en texto y no desde un `Date` para que dé lo mismo
 * en el teléfono y en el servidor, y para que no dependa de la zona horaria —
 * que es de donde salen los desfases de un día que luego nadie encuentra.
 */
export function semillaDeFecha(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number)
  return (a ?? 0) * 372 + (m ?? 0) * 31 + (d ?? 0)
}

/**
 * Dónde cae un día dentro de su propia fase.
 *
 * «Día 2 de 5 de tu fase menstrual» no es lo mismo que el día 5, y sin este
 * dato los cinco se tratan igual. Se cuenta sobre los límites del marco, que
 * salen del ciclo real de ella: en un ciclo de 21 días la ovulación cae en el
 * 8 y la fase folicular dura dos días, no ocho. Un calendario fijo diría «día
 * 2 de 8» y estaría mintiendo con seguridad.
 */
export function dentroDeFase(
  diaDeCiclo: number, marco: MarcoFases, fase: Fase,
): { n: number; de: number } {
  const i = ORDEN_FASES.indexOf(fase)
  const inicio = marco.limites[fase]
  const fin = i === ORDEN_FASES.length - 1
    ? marco.duracion + 1
    : marco.limites[ORDEN_FASES[i + 1]]
  const de = Math.max(1, fin - inicio)
  return { n: Math.max(1, Math.min(de, diaDeCiclo - inicio + 1)), de }
}

/**
 * La nota de evidencia, tal cual se le enseña.
 *
 * Vivía solo en el servidor, dentro de un prompt, así que la usuaria nunca la
 * leía: se la contaba el modelo si le apetecía. Aquí es texto de la app, y va
 * al pie de cada explicación. Es la diferencia entre una app que es honesta
 * con su nivel de evidencia y una que dice serlo en su documentación interna.
 */
export const NOTA_EVIDENCIA =
  'El manejo de síntomas —comer antiinflamatorio, hidratarte, moverte suave los días '
  + 'de dolor— tiene buen respaldo. El efecto de la fase sobre el rendimiento puro '
  + '(fuerza máxima, hipertrofia) NO: la evidencia es débil e inconsistente, y pesan '
  + 'más el sueño, el estrés y lo que comes en general. Por eso aquí no vas a leer que '
  + 'una fase te hará rendir más ni quemar más grasa.'
