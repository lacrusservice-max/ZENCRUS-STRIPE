// AI Coach Service — ZENCRUS
// TODO: conectar con DeepSeek API o Claude API (Anthropic SDK)
// Por ahora usa respuestas contextuales inteligentes sin API

export interface CoachContext {
  totalCalories: number
  caloriesTarget: number
  totalProtein: number
  proteinTarget: number
  waterGlasses: number
  currentStreak: number
  healthScore: number
  workedOut: boolean
  checkInDone: boolean
  mood?: number
  sleep?: number
  intention?: string
}

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// Respuestas contextuales inteligentes
const RESPONSES = {
  greeting: [
    '¡Hola! Soy tu Coach ZENCRUS. Estoy aquí para ayudarte a entender tu cuerpo y optimizar tu salud. ¿Qué necesitas hoy?',
    '¡Qué bueno verte por aquí! Analicé tu día de hoy y tengo algunas observaciones. ¿Quieres que te las comparta?',
  ],
  protein: [
    'La proteína es el macronutriente más importante para preservar músculo y controlar el hambre. Apunta a distribuirla en todas tus comidas, no solo al final del día.',
    'Para ganar músculo necesitas al menos 1.6g por kg de peso corporal. Para perder grasa, hasta 2.2g te ayuda a mantener músculo mientras comes en déficit.',
  ],
  calories: [
    'Las calorías importan, pero la calidad de lo que comes también define tu energía, tu recuperación y tu composición corporal.',
    'Un déficit de 300-500 kcal es suficiente para perder grasa sin sacrificar músculo ni energía. No necesitas morirte de hambre.',
  ],
  water: [
    'La deshidratación leve (2% del peso) reduce tu rendimiento cognitivo y físico. Un vaso de agua cada 90 min es un hábito simple y poderoso.',
    'El agua es el nutriente más subestimado. Mejora la digestión, la concentración, la recuperación muscular y el control del apetito.',
  ],
  workout: [
    'El entrenamiento perfecto es el que haces consistentemente. No te obsesiones con el plan perfecto — preocúpate por aparecer.',
    'La progresión gradual es la clave del progreso. Agrega un kg o una repetición extra cada semana y en un año serás irreconocible.',
  ],
  sleep: [
    'El sueño es cuando tu cuerpo repara el músculo, regula las hormonas y consolida los hábitos. Dormir menos de 7h anula la mitad del trabajo del gym.',
    'Si duermes mal, tu cuerpo produce más grelina (hambre) y menos leptina (saciedad). El sueño es la dieta más efectiva que existe.',
  ],
  streak: [
    'Cada día que apareces, aunque sea con lo mínimo, estás construyendo la versión de ti que serás en un año. La racha no es el objetivo, la racha es la evidencia.',
    'La disciplina no es motivación constante — es aparecer cuando NO tienes ganas. Y eso es exactamente lo que estás haciendo.',
  ],
  mood: [
    'Tu estado emocional afecta directamente tus decisiones de alimentación. El estrés eleva el cortisol y dispara antojos de carbohidratos. Reconocer eso ya es poder.',
    'El bienestar mental y la salud física son una sola cosa. No hay físico sin mente. No hay progreso sin equilibrio.',
  ],
  food_quality: [
    'No hay alimentos "malos" en el universo. Hay frecuencias y cantidades. Comer un dulce no arruina tu progreso; comerlo todos los días sí cambia tu composición.',
    'El 80% de tu alimentación siendo de alta calidad te da el 95% de los resultados. Perseguir el 100% de perfección genera ansiedad sin beneficio adicional.',
  ],
  general: [
    'Tu cuerpo es un sistema complejo. Nutrición, movimiento, descanso, mente — todo está conectado. ZENCRUS te ayuda a ver el cuadro completo.',
    'La transformación física es el efecto secundario de construir hábitos inteligentes. Foco en el proceso, los resultados aparecen solos.',
    'Cada persona tiene un metabolismo, una historia y un contexto único. Lo que funciona para uno no funciona para todos. Confía en tus datos, no en las modas.',
  ],
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function detectTopic(message: string, context: CoachContext): keyof typeof RESPONSES {
  const m = message.toLowerCase()
  if (m.includes('proteína') || m.includes('proteina') || m.includes('protein')) return 'protein'
  if (m.includes('caloria') || m.includes('caloría') || m.includes('peso') || m.includes('grasa') || m.includes('dieta')) return 'calories'
  if (m.includes('agua') || m.includes('hidrat')) return 'water'
  if (m.includes('entren') || m.includes('gym') || m.includes('rutina') || m.includes('ejercicio')) return 'workout'
  if (m.includes('dormir') || m.includes('sueño') || m.includes('descanso')) return 'sleep'
  if (m.includes('racha') || m.includes('constancia') || m.includes('disciplin') || m.includes('hábito')) return 'streak'
  if (m.includes('ánimo') || m.includes('estrés') || m.includes('estres') || m.includes('mood') || m.includes('triste') || m.includes('ansied')) return 'mood'
  if (m.includes('comida') || m.includes('alimento') || m.includes('natural') || m.includes('procesado')) return 'food_quality'
  if (m.includes('hola') || m.includes('buenos') || m.includes('hey') || m.includes('empezar')) return 'greeting'
  return 'general'
}

function buildContextualResponse(topic: keyof typeof RESPONSES, context: CoachContext): string {
  const base = pickRandom(RESPONSES[topic])
  const addons: string[] = []

  // Agregar contexto personal
  if (context.totalCalories > 0 && context.caloriesTarget > 0) {
    const pct = Math.round((context.totalCalories / context.caloriesTarget) * 100)
    if (pct < 50) addons.push(`Hoy llevas solo el ${pct}% de tus calorías — asegúrate de comer suficiente.`)
    else if (pct > 120) addons.push(`Hoy superaste tu objetivo calórico en ${context.totalCalories - context.caloriesTarget} kcal. Mañana ajustamos.`)
  }

  if (context.waterGlasses < 4 && topic === 'water') {
    addons.push(`Llevas ${context.waterGlasses} vasos hoy — todavía a tiempo de hidratarte bien.`)
  }

  if (context.currentStreak > 0 && (topic === 'streak' || topic === 'general')) {
    addons.push(`Por cierto — llevas ${context.currentStreak} días de racha. Eso ya dice mucho de ti.`)
  }

  if (!context.workedOut && topic === 'workout') {
    addons.push('Todavía no has registrado un entrenamiento hoy. ¿Qué tal una sesión corta esta tarde?')
  }

  const suffix = addons.length > 0 ? '\n\n' + addons.join(' ') : ''
  return base + suffix
}

// Simula latencia de API
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function sendMessage(
  message: string,
  history: CoachMessage[],
  context: CoachContext
): Promise<string> {
  // TODO: Reemplazar con llamada real a DeepSeek o Claude API:
  // const response = await anthropic.messages.create({
  //   model: 'claude-sonnet-4-6',
  //   max_tokens: 500,
  //   system: buildSystemPrompt(context),
  //   messages: history.map(m => ({ role: m.role, content: m.content })),
  // })
  // return response.content[0].text

  await delay(1000 + Math.random() * 800)
  const topic = detectTopic(message, context)
  return buildContextualResponse(topic, context)
}

function buildSystemPrompt(context: CoachContext): string {
  return `Eres el Coach ZENCRUS, un experto en nutrición, entrenamiento y hábitos saludables.
Tu filosofía: en ZENCRUS no creemos en dietas restrictivas, sino en alimentación inteligente y sostenible.
Tu tono: directo, motivador, científico pero accesible. Sin rodeos. Sin suavizar la verdad.
Contexto del usuario hoy:
- Calorías: ${context.totalCalories}/${context.caloriesTarget} kcal
- Proteína: ${context.totalProtein}/${context.proteinTarget}g
- Agua: ${context.waterGlasses} vasos
- Racha: ${context.currentStreak} días
- Health Score: ${context.healthScore}/100
- Entrenó hoy: ${context.workedOut ? 'Sí' : 'No'}
- Check-in: ${context.checkInDone ? 'Completado' : 'Pendiente'}
Responde en español, en máximo 3 párrafos cortos. Sé específico con su contexto.`
}

export function createMessage(role: 'user' | 'assistant', content: string): CoachMessage {
  return { id: Date.now().toString() + Math.random(), role, content, timestamp: Date.now() }
}
