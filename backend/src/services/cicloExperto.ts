/**
 * CICLO · EL MOTOR EXPERTO
 * ═══════════════════════════════════════════════════════════════════════════
 * La persona clínica del módulo de ciclo, la tabla de síntomas y los cuatro
 * prompts que consumen las pantallas: predicción, estadísticas, síntomas y la
 * recomendación diaria.
 *
 * ── La tabla es DATO, no solo texto dentro de un prompt ────────────────────
 * La tentación es meter las diez filas de síntomas dentro de la cadena del
 * prompt y dejar que el modelo las recite. Se hace así y pasan tres cosas: la
 * app no puede responder sin conexión, cada tarjeta cuesta una llamada, y dos
 * usuarias con el mismo síntoma reciben consejos distintos sin motivo. Con la
 * tabla como estructura, la app enseña la recomendación al instante y el
 * modelo se usa para lo que sí sabe hacer: personalizar el tono y cruzarlo con
 * lo que registró hoy.
 *
 * ── Lo que este módulo NO promete ──────────────────────────────────────────
 * Que entrenar según la fase mejore el rendimiento. La evidencia de 2023-2025
 * es débil e inconsistente —varias revisiones sistemáticas concluyen que es
 * prematuro afirmarlo— y prometerlo sería vender algo que no se sostiene. Lo
 * que sí tiene respaldo es el manejo de síntomas y el bienestar, y en esos
 * términos está escrito TODO lo de aquí.
 *
 * ── Y nunca diagnostica ────────────────────────────────────────────────────
 * Ni SOP, ni endometriosis, ni anemia. Ante una señal de alerta remite a un
 * profesional, con calidez y sin alarmar. Está en la persona base y repetido
 * en cada prompt, a propósito: una instrucción que solo aparece una vez es una
 * instrucción que el modelo se salta cuando la conversación se alarga.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 0 · La persona
// ═══════════════════════════════════════════════════════════════════════════

/**
 * El marco que heredan los demás prompts.
 *
 * Va como `system` cuando la integración lo permite; si no, se concatena
 * delante del prompt específico.
 */
export const PERSONA_CICLO = `
Eres la o el especialista clínico de ZENCRUS: experta en fisiología del ciclo menstrual,
nutrición deportiva y entrenamiento orientado a mujeres. Combinas endocrinología
reproductiva básica con recomendaciones prácticas de alimentación y ejercicio.

Reglas que sigues siempre:
- Hablas en español neutro, tono cálido, cercano y profesional (nunca clínico-frío
  ni condescendiente).
- Basas tus recomendaciones en la fase del ciclo, los síntomas y el historial que te
  entrega la app — nunca inventas datos que no te dieron.
- Eres honesta sobre el nivel de evidencia: para ejercicio, la ciencia actual muestra
  que el efecto de la fase del ciclo sobre el rendimiento físico es pequeño e
  inconsistente entre estudios; tus recomendaciones de entrenamiento se apoyan sobre
  todo en manejo de síntomas y bienestar, no en promesas de "rendimiento máximo
  garantizado".
- Nunca diagnosticas condiciones médicas (SOP, endometriosis, anemia, etc.). Si detectas
  una señal de alerta (dolor incapacitante, sangrado muy abundante, ciclos que cambian
  de forma abrupta, ausencia de periodo por más de 3 ciclos sin explicación), lo señalas
  con calidez y sugieres consultar a un profesional de salud, sin alarmar.
- Si la usuaria usa anticonceptivos hormonales, lo tienes en cuenta: su ciclo no refleja
  fluctuaciones hormonales naturales, así que ajustas el tono de las recomendaciones de
  "fase hormonal" hacia bienestar general en vez de ventanas hormonales específicas.
- Respuestas breves y accionables (2-4 puntos concretos), nunca un ensayo.
`.trim()

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Síntomas → qué comer y cómo moverse
// ═══════════════════════════════════════════════════════════════════════════

export interface FichaSintoma {
  /** La clave con la que lo guarda la app. */
  id: string
  etiqueta: string
  /** Qué pasa en el cuerpo, en una frase que se pueda leer sin estudiar nada. */
  fisiologia: string
  nutricion: string
  /** `null` cuando no hay recomendación de movimiento con respaldo. */
  entrenamiento: string | null
}

/**
 * Las diez fichas.
 *
 * `entrenamiento` es `null` en dos de ellas y eso es deliberado: para el acné
 * premenstrual y para la libido no hay una recomendación de movimiento con
 * respaldo, y rellenar el hueco con un consejo genérico —«¡muévete!»— es lo
 * que hace que se deje de creer también los ocho que sí valen.
 */
export const SINTOMAS: FichaSintoma[] = [
  {
    id: 'colicos',
    etiqueta: 'Cólicos / dolor menstrual',
    fisiologia: 'El útero libera prostaglandinas para desprender el endometrio; en exceso generan inflamación y contracciones más dolorosas.',
    nutricion: 'Omega-3 (salmón, chía, linaza) y alimentos antiinflamatorios; magnesio (semillas de calabaza, plátano, chocolate oscuro); reducir ultraprocesados y exceso de sal.',
    entrenamiento: 'Movimiento suave: caminata, estiramientos, yoga con torsiones suaves y posturas de cadera abierta; el calor local más movimiento leve mejora el flujo sanguíneo pélvico.',
  },
  {
    id: 'fatiga',
    etiqueta: 'Fatiga',
    fisiologia: 'Estrógeno y hierro están en su punto más bajo durante el sangrado; el cuerpo gasta energía extra reponiendo lo perdido.',
    nutricion: 'Hierro (carnes rojas magras, legumbres, espinaca) con vitamina C para mejorar su absorción (cítricos, pimiento); carbohidratos complejos para energía sostenida.',
    entrenamiento: 'Bajar el volumen e intensidad sin culpa; sesiones cortas o de recuperación activa; escuchar la señal de energía baja como información, no como fracaso.',
  },
  {
    id: 'cabeza',
    etiqueta: 'Dolor de cabeza / migraña',
    fisiologia: 'Suele coincidir con la caída brusca de estrógeno, justo antes o al inicio del sangrado.',
    nutricion: 'Buena hidratación, magnesio, evitar ayunos largos y estabilizar el azúcar en sangre con comidas regulares.',
    entrenamiento: 'Evitar entrenamientos de muy alta intensidad ese día; priorizar descanso, luz baja y movimiento ligero si el cuerpo lo permite.',
  },
  {
    id: 'hinchazon',
    etiqueta: 'Inflamación / hinchazón abdominal',
    fisiologia: 'La progesterona alta de la fase lútea enlentece la digestión y favorece la retención de líquidos.',
    nutricion: 'Reducir sodio y ultraprocesados; aumentar fibra de forma progresiva para no empeorar la hinchazón de golpe; té de jengibre o hinojo como apoyo digestivo.',
    entrenamiento: 'Ejercicio de bajo impacto que active la circulación (caminar, pilates); evitar comparar el abdomen hinchado con otros días — es fisiológico, no pérdida de progreso.',
  },
  {
    id: 'antojos',
    etiqueta: 'Antojos (dulce, salado, carbohidratos)',
    fisiologia: 'La progesterona eleva ligeramente el metabolismo basal y el gasto energético en fase lútea, así que el apetito sube de verdad, no es solo antojo emocional.',
    nutricion: 'Anticiparse con snacks nutritivos (fruta con mantequilla de maní, yogur con avena) en vez de restringir; el chocolate oscuro de 70 % o más cubre el antojo de dulce con menos azúcar y algo de magnesio.',
    entrenamiento: 'No es momento de iniciar un déficit calórico agresivo; mantener constancia con entrenamientos moderados regula el apetito mejor que restringir comida.',
  },
  {
    id: 'animo',
    etiqueta: 'Cambios de ánimo / irritabilidad',
    fisiologia: 'La caída de progesterona y estrógeno al final de la fase lútea afecta a la serotonina.',
    nutricion: 'Triptófano y carbohidratos complejos (avena, plátano, legumbres) apoyan la producción de serotonina; la vitamina B6 (garbanzos, pollo) se asocia a menor irritabilidad premenstrual.',
    entrenamiento: 'El ejercicio aeróbico moderado (caminar rápido, bici, baile) es de lo más efectivo para regular el ánimo — más que la intensidad, importa la constancia.',
  },
  {
    id: 'acne',
    etiqueta: 'Piel / acné premenstrual',
    fisiologia: 'El aumento relativo de andrógenos en la fase lútea tardía estimula la producción de sebo.',
    nutricion: 'Zinc (semillas de calabaza, legumbres) y omega-3; cuidar los picos de azúcar, que pueden agravar la inflamación de la piel.',
    entrenamiento: null,
  },
  {
    id: 'insomnio',
    etiqueta: 'Insomnio / mal descanso',
    fisiologia: 'La caída de progesterona —que tiene un efecto calmante leve— antes del periodo puede afectar a la calidad del sueño.',
    nutricion: 'Evitar cafeína después del mediodía esos días; magnesio antes de dormir; cenas más ligeras y tempranas.',
    entrenamiento: 'Evitar entrenar muy intenso cerca de la hora de dormir esos días; priorizar rutinas de bajada de revoluciones (estiramientos, respiración).',
  },
  {
    id: 'retencion',
    etiqueta: 'Retención de líquidos',
    fisiologia: 'Progesterona y aldosterona favorecen que el cuerpo retenga más sodio y agua en fase lútea.',
    nutricion: 'Reducir el sodio de ultraprocesados —no el sodio natural de la comida—; aumentar potasio (plátano, palta, papa); mantener buena hidratación, que aunque suene contraintuitivo ayuda a des-retener.',
    entrenamiento: 'Movimiento suave y regular ayuda más que el reposo total a drenar la retención.',
  },
  {
    id: 'libido',
    etiqueta: 'Cambios en el deseo sexual',
    fisiologia: 'La libido suele acompañar al pico de estrógeno y testosterona de la ovulación, y bajar en fase lútea y menstrual.',
    nutricion: 'No hay una recomendación nutricional específica con evidencia sólida; mantener buena energía general (hierro, sueño, hidratación) ayuda de forma indirecta.',
    entrenamiento: null,
  },
]

/** Búsqueda por clave, para no recorrer la lista en cada pantalla. */
export const SINTOMA_POR_ID = new Map(SINTOMAS.map(s => [s.id, s]))

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Las cuatro fases
// ═══════════════════════════════════════════════════════════════════════════

export type FaseCiclo = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea'

export interface FichaFase {
  etiqueta: string
  /** Días aproximados. Orientativo: el motor calcula los reales de SU ciclo. */
  rango: string
  hormonas: string
  favorece: string
  comer: string
  entrenar: string
}

export const FASES: Record<FaseCiclo, FichaFase> = {
  menstrual: {
    etiqueta: 'Menstrual',
    rango: 'día 1 al 5 aprox.',
    hormonas: 'Estrógeno y progesterona en su punto más bajo del ciclo.',
    favorece: 'Bajar el ritmo sin culpa, reponer hierro y tomarse la energía baja como información válida.',
    comer: 'Hierro con vitamina C (lentejas con pimiento, espinaca con cítricos), omega-3 antiinflamatorio, buena hidratación, comidas calientes y reconfortantes.',
    entrenar: 'Caminatas, yoga, movilidad, pilates suave; si el cuerpo lo pide, fuerza ligera está bien — la clave es que sea elección, no exigencia.',
  },
  folicular: {
    etiqueta: 'Folicular',
    rango: 'día 6 al 13 aprox., justo después del sangrado',
    hormonas: 'El estrógeno sube de forma sostenida; suele acompañarse de más energía, mejor ánimo y mejor tolerancia al esfuerzo percibido.',
    favorece: 'Construir hábito, probar cosas nuevas y progresar cargas de forma gradual.',
    comer: 'Proteína magra y carbohidratos complejos (quinoa, avena, arroz integral) para sostener el mayor gasto; vegetales crucíferos y fermentados, que apoyan el metabolismo del estrógeno.',
    entrenar: 'Buen momento para fuerza progresiva y cardio de mayor intensidad, aprovechando que la energía percibida suele ser más alta — según cómo se sienta cada usuaria, no como regla fija.',
  },
  ovulatoria: {
    etiqueta: 'Ovulatoria',
    rango: 'alrededor del día 14, ventana corta de 2-3 días',
    hormonas: 'Pico de estrógeno y un pequeño pico de testosterona; suele coincidir con el punto más alto de energía percibida del ciclo.',
    favorece: 'Retos de alta intensidad si el cuerpo acompaña, aunque la ventana es corta y muy variable entre personas.',
    comer: 'Mantener proteína y carbohidratos complejos; buen día para comidas sociales o más variadas, sin necesidad de restricciones.',
    entrenar: 'Alta intensidad (HIIT, cargas más pesadas) si la energía acompaña — sin forzarlo si no es así, porque la variabilidad individual es alta.',
  },
  lutea: {
    etiqueta: 'Lútea',
    rango: 'día 15 hasta el inicio del siguiente sangrado, unos 14 días',
    hormonas: 'La progesterona sube y luego cae junto al estrógeno al final de la fase; el metabolismo basal se eleva un poco (más apetito real) y pueden aparecer síntomas premenstruales.',
    favorece: 'Constancia y manejo de síntomas por encima de la intensidad; es normal necesitar más comida y más descanso hacia el final.',
    comer: 'Carbohidratos complejos y fibra para estabilizar el azúcar en sangre y controlar antojos; magnesio y vitamina B6 para síntomas premenstruales; anticiparse con snacks nutritivos en vez de restringir.',
    entrenar: 'Bajar gradualmente la intensidad hacia el final; el cardio moderado (caminar rápido, bici, baile) es especialmente útil para el ánimo; fuerza con cargas moderadas está bien si el cuerpo responde.',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Los prompts
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pega la persona delante de un prompt.
 *
 * Se usa cuando la integración no separa `system` de `user`. Cuando sí lo
 * hace, `PERSONA_CICLO` va como system y aquí se pasa solo el específico.
 */
export const conPersona = (prompt: string): string =>
  `${PERSONA_CICLO}\n\n${prompt.trim()}`

export interface DatosPrediccion {
  fechasInicio: string[]
  duracionesCiclo: number[]
  duracionesSangrado: number[]
  anticonceptivo: string | null
}

export function promptPrediccion(d: DatosPrediccion): string {
  return `
Contexto: eres el módulo de predicción de ZENCRUS.

Datos de la usuaria:
- Fechas de inicio de los últimos ciclos: ${lista(d.fechasInicio)}
- Duración de cada ciclo (días): ${lista(d.duracionesCiclo)}
- Duración del sangrado (días) de cada ciclo: ${lista(d.duracionesSangrado)}
- ¿Usa anticonceptivo hormonal?: ${d.anticonceptivo ?? 'no'}

Tarea:
1. Calcula la duración típica de ciclo (mediana) y la fecha estimada del próximo periodo.
2. Calcula la ventana fértil estimada (día de ovulación ≈ próximo inicio − 14 días,
   ventana = −5 a +1 días de ese punto).
3. Clasifica la regularidad del ciclo según la desviación estándar de las duraciones
   (Muy regular / Regular / Algo irregular / Irregular) y explica en una frase qué
   significa ese nivel para la confianza de la predicción.
4. Si hay menos de 2 ciclos registrados, dilo claramente y pide más registros en vez
   de inventar una fecha.
5. Si la variación entre ciclos es mayor a 10 días respecto al promedio histórico,
   agrega una nota breve y cálida (sin diagnosticar) sobre posibles causas comunes
   (estrés, viajes, cambios de peso, entrenamiento intenso, anticoncepción).

Devuelve: fecha estimada del próximo periodo (o rango si la regularidad es baja),
ventana fértil estimada, nivel de regularidad, y una frase de una línea que resuma
la confianza de la predicción para mostrar en la tarjeta de la app.
`.trim()
}

export interface DatosEstadisticas {
  rangoMeses: number
  duracionesCiclo: number[]
  duracionesSangrado: number[]
  /** Filas «síntoma · fase · veces». */
  sintomasPorFase: string
  /** Filas «fase · energía media · ánimo medio · nº de días». */
  energiaAnimoPorFase: string
}

export function promptEstadisticas(d: DatosEstadisticas): string {
  return `
Contexto: eres el módulo de estadísticas e insights de ZENCRUS.

Datos de la usuaria (últimos ${d.rangoMeses} meses):
- Duraciones de ciclo: ${lista(d.duracionesCiclo)}
- Duraciones de sangrado: ${lista(d.duracionesSangrado)}
- Síntomas registrados por día con su fase correspondiente:
${sangrar(d.sintomasPorFase)}
- Energía y ánimo diarios con su fase correspondiente:
${sangrar(d.energiaAnimoPorFase)}

Tarea:
1. Calcula duración promedio de ciclo, de periodo, y clasifica la regularidad.
2. Ordena los síntomas registrados de más a menos frecuente (top 4).
3. Calcula el promedio de energía y ánimo para cada una de las 4 fases
   (Menstrual, Folicular, Ovulatoria, Lútea).
4. Detecta el patrón más consistente y útil de este mes (repetición de un síntoma
   en una fase específica, caída de energía en un momento del ciclo, correlación
   entre ánimo y fase, etc.).
5. Redacta ese patrón en 2-3 frases cálidas y claras: qué notaste, por qué pasa
   fisiológicamente en términos simples, y una recomendación concreta de nutrición
   o entrenamiento para esa fase.

Si una fase tiene menos de 6 días registrados, NO la uses para afirmar un patrón:
dilo y pide más registros de esa fase.

Devuelve los números para las tarjetas de estadísticas y, por separado, el texto final
de la tarjeta de insight (máximo 3 frases, tono cercano, sin tecnicismos).
`.trim()
}

export interface DatosSintomas {
  sintomas: string[]
  intensidades: Record<string, number>
  fase: FaseCiclo
  diaDeCiclo: number
}

export function promptSintomas(d: DatosSintomas): string {
  return `
Contexto: eres el módulo de recomendaciones de ZENCRUS. La usuaria acaba de registrar
uno o más síntomas en su registro diario.

Datos de la usuaria:
- Síntomas registrados hoy: ${lista(d.sintomas)}
- Intensidad de cada uno (1 a 5): ${lista(
    Object.entries(d.intensidades).map(([k, v]) => `${k}: ${v}`))}
- Fase actual del ciclo: ${FASES[d.fase].etiqueta}
- Día del ciclo: ${d.diaDeCiclo}

Referencia clínica de la app para los síntomas registrados:
${fichasDe(d.sintomas)}

Tarea:
1. Para cada síntoma registrado, da una explicación fisiológica de 1 frase, simple y
   sin tecnicismos, de por qué puede estar pasando en esta fase.
2. Da 1-2 recomendaciones de nutrición concretas (alimentos o hábitos específicos,
   no genéricos como "come sano").
3. Da 1 recomendación de entrenamiento o movimiento para hoy, ajustada a la
   intensidad del síntoma: si la intensidad es alta, prioriza descanso activo.
4. Si el síntoma reportado suena a señal de alerta (dolor incapacitante, sangrado muy
   abundante que empapa protección cada hora, dolor de cabeza súbito y muy intenso),
   dilo con calidez y sugiere consultar a un profesional de salud — sin diagnosticar.
5. No repitas los mismos 3 alimentos para todo: varía las sugerencias dentro de lo
   fisiológicamente razonable.

Devuelve una respuesta breve (máximo 4-5 líneas totales), en tono cercano, lista para
mostrarse directamente en la tarjeta de recomendación del día.
`.trim()
}

export interface DatosDiarios {
  fase: FaseCiclo
  diaDeCiclo: number
  sintomas: string[]
  energia: number | null
  animo: string | null
  anticonceptivo: string | null
  antojos: string[]
}

export function promptDiario(d: DatosDiarios): string {
  const f = FASES[d.fase]
  return `
Contexto: eres el módulo de recomendación diaria de ZENCRUS.

Datos de la usuaria hoy:
- Fase actual del ciclo: ${f.etiqueta} (${f.rango})
- Día del ciclo: ${d.diaDeCiclo}
- Síntomas registrados hoy: ${lista(d.sintomas)}
- Energía registrada hoy (1 a 5): ${d.energia ?? 'sin registrar'}
- Ánimo registrado hoy: ${d.animo ?? 'sin registrar'}
- ¿Usa anticonceptivo hormonal?: ${d.anticonceptivo ?? 'no'}
- Antojos registrados: ${lista(d.antojos)}

Qué favorece esta fase, según la guía de la app:
- Hormonas: ${f.hormonas}
- Comer: ${f.comer}
- Entrenar: ${f.entrenar}

Tarea:
1. Si usa anticonceptivo hormonal, ajusta el enfoque hacia bienestar general y manejo
   de síntomas en vez de "ventana hormonal", y dilo de forma breve y natural.
2. Da 1 recomendación de nutrición para hoy, priorizando primero los antojos y
   síntomas registrados hoy, y en segundo lugar el patrón general de la fase.
3. Da 1 recomendación de entrenamiento o movimiento para hoy, ajustada a la energía y
   el ánimo que registró — nunca le exijas alta intensidad si registró energía baja.
4. Sé honesta si la recomendación de entrenamiento es más sobre bienestar que sobre
   rendimiento: no prometas "quemarás más grasa" ni "rendirás al máximo" solo por la
   fase, porque la evidencia de eso es débil.
5. Cierra con una frase breve de ánimo, sin ser cursi ni condescendiente.

Devuelve máximo 4 líneas: 1 de nutrición, 1 de entrenamiento, 1 de cierre.
`.trim()
}

// ═══════════════════════════════════════════════════════════════════════════
// Ayudas de formato
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Una lista para el prompt, o «ninguno» si está vacía.
 *
 * Un `[]` impreso tal cual invita al modelo a rellenar el hueco con lo que le
 * parezca; «ninguno» es un dato y se respeta.
 */
const lista = (xs: (string | number)[]): string =>
  xs.length ? xs.join(', ') : 'ninguno'

const sangrar = (texto: string): string =>
  texto.trim().split('\n').map(l => `    ${l}`).join('\n')

const fichasDe = (ids: string[]): string => {
  const fichas = ids
    .map(id => SINTOMA_POR_ID.get(id))
    .filter((f): f is FichaSintoma => !!f)
  if (!fichas.length) return '    (ninguno de los registrados está en la tabla)'
  return fichas.map(f => [
    `    · ${f.etiqueta}`,
    `      Fisiología: ${f.fisiologia}`,
    `      Nutrición: ${f.nutricion}`,
    `      Movimiento: ${f.entrenamiento ?? 'sin recomendación con respaldo suficiente'}`,
  ].join('\n')).join('\n')
}

/**
 * La nota de evidencia, para pie de pantalla.
 *
 * Se expone para que las pantallas la pinten en vez de reescribirla cada una
 * con matices distintos — que es como una app acaba prometiendo en una
 * pantalla lo que niega en otra.
 */
export const NOTA_EVIDENCIA = `
El manejo de síntomas —alimentación antiinflamatoria, hidratación, movimiento suave en
días de dolor— tiene buen respaldo práctico y fisiológico. El efecto de la fase del
ciclo sobre el rendimiento deportivo puro (fuerza máxima, hipertrofia) tiene evidencia
débil e inconsistente: las revisiones sistemáticas recientes concluyen que es prematuro
afirmar que entrenar según la fase cambie los resultados de forma relevante, y que el
sueño, el estrés y la nutrición general pesan más. Sincronizar hábitos con el ciclo
tampoco aplica igual con anticoncepción hormonal, porque entonces el ciclo no refleja
fluctuaciones hormonales naturales.
`.trim()
