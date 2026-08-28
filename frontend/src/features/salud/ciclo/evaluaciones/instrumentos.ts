/**
 * LOS TRES INSTRUMENTOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Copiados de su artículo, con su regla de puntuación y su rendimiento
 * publicados. No hay ningún umbral inventado aquí: si un número no está en la
 * fuente, no está en este fichero.
 *
 * ── Por qué solo tres y no las seis del plan ───────────────────────────────
 * El plan pedía seis evaluaciones: SOP, endometriosis, miomas, TDPM, sangrado
 * abundante y perimenopausia. Al buscar los instrumentos, tres se cayeron:
 *
 *   · MIOMAS no tiene ninguno. Ni uno. Los instrumentos que existen o miden
 *     volumen de sangrado —de cualquier causa— o miden calidad de vida en
 *     mujeres a las que YA se los vieron por ecografía. El diagnóstico es por
 *     imagen. Un «cribado de miomas» sería un instrumento inventado.
 *
 *   · PERIMENOPAUSIA no se criba, se ESTADIFICA: STRAW+10 clasifica por
 *     patrón de sangrado y edad, y el diagnóstico es clínico. Los cortes de
 *     la MRS se contradicen entre publicaciones.
 *
 *   · TDPM tiene el PSST, pero en el estudio brasileño clasificó como TDPM al
 *     34,6% frente al 3,9% confirmado por diario prospectivo, con kappa 0,12:
 *     falso alrededor de nueve de cada diez veces. El estándar —DSM-5, RCOG,
 *     ACOG— exige registro DIARIO PROSPECTIVO de dos ciclos, que es
 *     precisamente lo que esta app sabe hacer. Así que el TDPM no es aquí un
 *     cuestionario: es un diario, y va aparte.
 */

import type { Instrumento, Bandera, Evaluacion } from './tipos'

/* ── Las ocho zonas de vello del ítem 2 de Pedersen, literales ────────────── */
const ZONAS_VELLO = [
  { id: 'labio', texto: 'Labio superior' },
  { id: 'menton', texto: 'Mentón' },
  { id: 'mamas', texto: 'Mamas' },
  { id: 'esternon', texto: 'Entre las mamas' },
  { id: 'espalda', texto: 'Espalda' },
  { id: 'abdomen', texto: 'Abdomen' },
  { id: 'brazos', texto: 'Brazos' },
  { id: 'muslos', texto: 'Muslos' },
]

/**
 * PEDERSEN 2007 · el más parecido a un cribado por síntomas puro que existe
 * para SOP y que esté validado en muestra independiente.
 *
 * ── El ítem que resta ──────────────────────────────────────────────────────
 * El cuarto ítem —secreción lechosa por el pezón— vale MENOS UNO, porque
 * apunta a una hiperprolactinemia y no a un SOP. Aritmética real: ciclos de 40
 * días (+1) más vello grueso en tres zonas (+1) da 2, que es compatible. Si
 * además hay secreción, el total baja a 1: no compatible.
 *
 * O sea: la única respuesta del cuestionario que apunta a un prolactinoma es
 * exactamente la que produce la pantalla tranquilizadora.
 *
 * Aquí se resuelve sin tocar la puntuación publicada. El ítem se pregunta
 * primero y fuera del total; si sale que sí, NO se calcula ninguna puntuación
 * en esa sesión y se va derecho a consulta. Si sale que no, resta cero y la
 * puntuación es exactamente la del artículo. Así el corte de ≥2 sigue
 * significando lo que significa en la fuente, y la que más necesita ir al
 * médico no ve nunca un número que la tranquilice.
 */
export const PEDERSEN: Instrumento = {
  id: 'pedersen_2007',
  nombre: 'Cuestionario de Pedersen',
  fuente: 'Pedersen SD, Brar S, Faris P, Corenblum B. Can Fam Physician. 2007;53(6):1041-1047',
  corte: 2,
  regla: 'Una puntuación de 2 o más es compatible con SOP. Por debajo, no lo es.',
  rendimiento: 'En la muestra de validación, sensibilidad 85,4% y especificidad 93,4%. '
    + 'Con esa sensibilidad, entre 1 de cada 7 y 1 de cada 4 mujeres con SOP dan negativo.',
  limite: 'No diagnostica. Los criterios exigen ecografía y analítica, y la mitad de los '
    + 'criterios de Rotterdam no se pueden contestar sin pruebas. Se validó contra los '
    + 'criterios NIH de 1990 en una consulta especializada, no en población general, y no '
    + 'se ha revalidado en adolescentes ni en población hispanohablante.',
  items: [
    {
      id: 'ciclo',
      pregunta: 'Entre los 16 y los 40 años, ¿cuánto han durado tus ciclos por término medio?',
      ayuda: 'Del primer día de una regla al primer día de la siguiente.',
      puntos: 1,
      respuesta: {
        tipo: 'opciones',
        opciones: [
          { valor: 'menos_35', texto: 'Menos de 35 días' },
          { valor: '35_60', texto: 'Entre 35 y 60 días' },
          { valor: 'mas_60', texto: 'Más de 60 días' },
          { valor: 'variable', texto: 'Totalmente variable' },
        ],
      },
    },
    {
      id: 'vello',
      pregunta: '¿Te crece vello oscuro y grueso en alguna de estas zonas?',
      ayuda: 'Vello grueso y pigmentado, no el vello fino de siempre. Marca todas las que sean.',
      puntos: 1,
      respuesta: { tipo: 'zonas', zonas: ZONAS_VELLO },
    },
    {
      id: 'peso',
      pregunta: '¿Has tenido sobrepeso u obesidad en algún momento entre los 16 y los 40 años?',
      puntos: 1,
      respuesta: { tipo: 'si_no' },
    },
  ],
}

/**
 * SAMANTA-Q 2020 · el único de los tres desarrollado y validado ORIGINALMENTE
 * EN ESPAÑOL, que para esta app no es un detalle menor: los otros dos son
 * traducciones nuestras de un original en inglés.
 *
 * Combina volumen con impacto, que es lo que pide la definición vigente de
 * NICE —«pérdida menstrual excesiva que interfiere con la calidad de vida»—,
 * y no mililitros: el umbral histórico de 80 ml ya no es el criterio clínico.
 *
 * Los ítems 1 y 3 valen 3 puntos; los otros cuatro valen 1. Rango 0-10.
 */
export const SAMANTA_Q: Instrumento = {
  id: 'samanta_q_2020',
  nombre: 'Cuestionario SAMANTA',
  fuente: 'Calaf J et al. J Womens Health. 2020 (PMID 32580622). Validación: Perelló-Capó J et al., 2024',
  corte: 3,
  regla: 'Una puntuación de 3 o más indica que puede haber sangrado menstrual abundante.',
  rendimiento: 'Sensibilidad 86,7% y especificidad 89,5%.',
  limite: 'Dice que el sangrado probablemente es excesivo y que te está afectando. Nunca '
    + 'POR QUÉ: el sangrado abundante es un síntoma con nueve familias de causas —pólipos, '
    + 'adenomiosis, miomas, coagulopatías, disfunción ovulatoria y más—, y cuatro de ellas '
    + 'solo se ven con imagen.',
  items: [
    { id: 'dias7', puntos: 3, respuesta: { tipo: 'si_no' },
      pregunta: '¿Sangras más de 7 días cada mes?' },
    { id: 'intensos3', puntos: 1, respuesta: { tipo: 'si_no' },
      pregunta: '¿Tienes 3 o más días de sangrado especialmente intenso durante la regla?' },
    { id: 'incomodas', puntos: 3, respuesta: { tipo: 'si_no' },
      pregunta: '¿Encuentras tus reglas particularmente incómodas por lo abundantes que son?' },
    { id: 'noche', puntos: 1, respuesta: { tipo: 'si_no' },
      pregunta: '¿Manchas la ropa de dormir por la noche en los días de más sangrado?' },
    { id: 'asiento', puntos: 1, respuesta: { tipo: 'si_no' },
      pregunta: '¿Te preocupa manchar el asiento de una silla o el sofá en los días de más sangrado?' },
    { id: 'evitar', puntos: 1, respuesta: { tipo: 'si_no' },
      pregunta: '¿Evitas actividades, viajes o planes de ocio en los días de más sangrado?' },
  ],
}

/**
 * PPST 2018 · cinco preguntas de sí o no.
 *
 * Sus autores lo diseñaron, literalmente, «como evaluación de síntomas
 * típicos, NO como herramienta diagnóstica». Su regla publicada no es un
 * punto de corte: es una frase que dice «habla con tu médico». Por eso su
 * `rendimiento` es null y no un número aproximado — no existe sensibilidad ni
 * especificidad asociadas a ese umbral, y ponerle una sería inventarla.
 */
export const PPST: Instrumento = {
  id: 'ppst_2018',
  nombre: 'Painful Periods Screening Tool',
  fuente: 'DiBenedetti DB, Soliman AM, Ervin C, et al. Postgrad Med. 2018;130(8)',
  corte: 1,
  regla: 'Con un solo «sí» ya merece la pena comentarlo con un médico. Así está escrito en '
    + 'el propio cuestionario, y no es un punto de corte diagnóstico: es un disparador de '
    + 'conversación.',
  rendimiento: null,
  limite: 'No diagnostica endometriosis y no puede hacerlo. ESHRE es explícita: los '
    + 'síntomas no son específicos. El diagnóstico se apoya en imagen y, en algunos casos, '
    + 'en laparoscopia. Un «no» a las cinco tampoco descarta nada.',
  items: [
    { id: 'dolor_regla', respuesta: { tipo: 'si_no' }, puntos: 1,
      pregunta: '¿Tienes dolor pélvico, abdominal o lumbar antes o durante la regla que te '
        + 'limita la actividad o te obliga a tomar medicación?' },
    { id: 'dolor_entre', respuesta: { tipo: 'si_no' }, puntos: 1,
      pregunta: '¿Tienes ese mismo dolor también entre reglas?' },
    { id: 'dolor_sexo', respuesta: { tipo: 'si_no' }, puntos: 1,
      pregunta: '¿Tienes dolor durante o después de las relaciones sexuales?',
      ayuda: 'Si no tienes relaciones, puedes saltarla.' },
    { id: 'evita_sexo', respuesta: { tipo: 'si_no' }, puntos: 1,
      pregunta: '¿Evitas las relaciones sexuales para no tener ese dolor?',
      ayuda: 'Si no tienes relaciones, puedes saltarla.' },
    { id: 'dolor_defecar', respuesta: { tipo: 'si_no' }, puntos: 1,
      pregunta: '¿Te duele al defecar antes o durante la regla?' },
  ],
}

/* ═══════════════════════════════════════════════════════════════════════════
 * LAS BANDERAS ROJAS
 *
 * Se preguntan ANTES del cuestionario y lo cortan. No es una precaución
 * genérica: son cosas que no deben esperar a que alguien termine catorce
 * preguntas, y antes se quedaban sin sitio donde caerse —o no se escribía
 * fila, y el caso más urgente era el único que no dejaba rastro.
 *
 * El plazo se dice en palabras que signifiquen algo aquí. «Derivación urgente
 * en dos semanas» es vocabulario del NHS británico: en México no quiere decir
 * nada y solo produce susto sin destino.
 * ═══════════════════════════════════════════════════════════════════════════ */

const SANGRADO_POSMENOPAUSICO: Bandera = {
  id: 'sangrado_posmenopausico',
  pregunta: '¿Has vuelto a sangrar después de llevar 12 meses o más sin regla?',
  paso: 'urgente',
  porque: 'Sangrar después de un año entero sin regla es el motivo de consulta más claro '
    + 'que hay en toda esta sección. Casi siempre no es nada grave, pero es de las pocas '
    + 'cosas que conviene mirar sin dejar pasar semanas.',
}

export const EVALUACIONES: Record<string, Evaluacion> = {
  sop: {
    clave: 'sop',
    titulo: 'Reglas irregulares y vello',
    subtitulo: 'Cuatro preguntas sobre tu patrón de ciclo y el vello corporal.',
    instrumento: PEDERSEN,
    banderas: [
      {
        id: 'galactorrea',
        pregunta: '¿Has notado alguna vez secreción lechosa por el pezón, fuera del '
          + 'embarazo y de la lactancia?',
        paso: 'consulta',
        porque: 'Esto apunta hacia otro sitio distinto del que miran las demás preguntas, '
          + 'y se resuelve con un análisis de sangre sencillo. Merece una consulta por sí '
          + 'solo, sin esperar al resto del cuestionario.',
      },
      {
        id: 'virilizacion',
        pregunta: '¿Has notado la voz más grave, más masa muscular, o cambios en el clítoris?',
        ayuda: 'Cambios que hayan aparecido en meses, no cómo has sido siempre.',
        paso: 'urgente',
        porque: 'Cuando estos cambios aparecen deprisa conviene mirarlos pronto, y no es '
          + 'algo que este cuestionario pueda evaluar.',
      },
    ],
    noEvaluableSi: [
      {
        motivo: 'anticoncepcion_hormonal',
        explicacion: 'Llevas un método hormonal. Eso regulariza el ciclo, mejora el acné y '
          + 'el vello, y cambia la analítica: con él puesto, este cuestionario no puede ni '
          + 'afirmar ni descartar nada. La guía internacional de 2023 lo dice con estas '
          + 'palabras: ni diagnosticada, ni descartada. No es un fallo del cuestionario, es '
          + 'el resultado.',
      },
    ],
    preguntasParaMedico: [
      '¿Cumplo los criterios de Rotterdam? ¿Cuáles sí y cuáles no?',
      '¿Merece la pena una ecografía o una analítica de andrógenos en mi caso?',
      'Llevo anticoncepción hormonal: ¿hace falta suspenderla para poder valorar esto?',
      '¿Habría que descartar otras causas de reglas irregulares antes que el SOP?',
    ],
  },

  sangrado_abundante: {
    clave: 'sangrado_abundante',
    titulo: 'Sangrado muy abundante',
    subtitulo: 'Seis preguntas sobre cuánto sangras y cómo te afecta.',
    instrumento: SAMANTA_Q,
    banderas: [
      {
        id: 'empapa_con_mareo',
        pregunta: '¿Has tenido que cambiarte la compresa o el tampón cada hora durante más '
          + 'de dos horas seguidas y además te has sentido mareada, con falta de aire o con '
          + 'dolor en el pecho?',
        paso: 'urgente',
        porque: 'Esa combinación es la única de esta sección que se atiende el mismo día. '
          + 'Sangrar mucho sola no lo es; sangrar mucho con esos síntomas, sí.',
      },
      SANGRADO_POSMENOPAUSICO,
    ],
    noEvaluableSi: [],
    preguntasParaMedico: [
      '¿Me conviene una analítica de hierro y ferritina?',
      '¿Habría que descartar un problema de coagulación? Me sangra así desde la primera regla.',
      '¿Una ecografía ayudaría a ver de dónde viene?',
      '¿Qué opciones hay para reducirlo, y cuáles son compatibles con querer embarazo?',
    ],
  },

  endometriosis: {
    clave: 'endometriosis',
    titulo: 'Dolor con la regla',
    subtitulo: 'Cinco preguntas sobre el dolor y cuándo aparece.',
    instrumento: PPST,
    banderas: [
      {
        id: 'dolor_agudo',
        pregunta: '¿Tienes ahora mismo un dolor abdominal fuerte que ha empezado de golpe, '
          + 'con náuseas, vómitos o mareo?',
        paso: 'urgente',
        porque: 'Un dolor así, de golpe y con esos síntomas, se mira hoy. No tiene que ver '
          + 'con el dolor de regla de siempre, que es de lo que van las otras preguntas.',
      },
    ],
    noEvaluableSi: [],
    preguntasParaMedico: [
      '¿Mi dolor de regla es normal o merece que lo miremos?',
      '¿Una ecografía transvaginal ayudaría a ver algo, y quién la interpreta mejor?',
      '¿Qué se puede hacer con el dolor mientras tanto, sin esperar a un diagnóstico?',
      'Llevo años con esto: ¿a qué especialista debería ir?',
    ],
  },
}
