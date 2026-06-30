/**
 * DeepSeek AI Client — NutriAI Fit
 * Placeholder completo listo para conectar con la API real
 *
 * Para activar: reemplazar los métodos placeholder con llamadas reales a:
 * https://api.deepseek.com/v1
 */

class DeepSeekClient {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.baseURL = 'https://api.deepseek.com/v1'
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    this.isConnected = Boolean(apiKey && apiKey !== 'your_deepseek_api_key')
  }

  /**
   * Llamada base a la API (placeholder/real)
   */
  async _call(endpoint, payload) {
    if (!this.isConnected) {
      // Modo placeholder — retorna datos simulados realistas
      return this._mockResponse(endpoint, payload)
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        ...payload,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`DeepSeek API error ${response.status}: ${error.error?.message || 'Unknown'}`)
    }

    return response.json()
  }

  /**
   * Genera un plan de alimentación personalizado
   */
  async generateDietPlan(userData) {
    const { DIET_PROMPT_TEMPLATE } = require('./prompts')

    const prompt = DIET_PROMPT_TEMPLATE
      .replace('{age}', userData.age || 30)
      .replace('{weight}', userData.weight || 70)
      .replace('{height}', userData.height || 170)
      .replace('{gender}', userData.gender || 'no especificado')
      .replace('{goal}', userData.goal || 'maintenance')
      .replace('{activityLevel}', userData.activityLevel || 'moderate')
      .replace('{restrictions}', userData.restrictions || 'Ninguna')
      .replace('{healthConditions}', userData.healthConditions || 'Ninguna')

    const result = await this._call('/chat/completions', {
      messages: [
        {
          role: 'system',
          content: 'Eres un nutricionista experto. Responde siempre en formato JSON estructurado.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4096,
    })

    return result
  }

  /**
   * Genera una rutina de entrenamiento personalizada
   */
  async generateWorkoutRoutine(userData) {
    const { WORKOUT_PROMPT_TEMPLATE } = require('./prompts')

    const prompt = WORKOUT_PROMPT_TEMPLATE
      .replace('{level}', userData.level || 'beginner')
      .replace('{goal}', userData.goal || 'strength')
      .replace('{days}', userData.daysPerWeek || 3)
      .replace('{time}', userData.sessionDuration || 60)
      .replace('{injuries}', (userData.injuries || []).join(', ') || 'Ninguna')
      .replace('{equipment}', (userData.equipment || ['bodyweight']).join(', '))

    const result = await this._call('/chat/completions', {
      messages: [
        {
          role: 'system',
          content: 'Eres un entrenador personal certificado. Responde siempre en formato JSON estructurado.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4096,
    })

    return result
  }

  /**
   * Chat conversacional con el asistente
   */
  async chat(userMessage, context = {}) {
    const systemPrompt = `Eres EuniceAI, asistente personal de nutrición y fitness de NutriAI Fit.

Características:
- Conocimiento profundo en nutrición, dietética y fitness
- Respuestas en español mexicano, amigables y motivadoras
- Basas tus respuestas en evidencia científica
- SIEMPRE incluyes el disclaimer: este asistente no sustituye al profesional de la salud
- Si el usuario comparte síntomas médicos graves, derivas urgentemente al médico

Contexto del usuario: ${JSON.stringify(context.userProfile || {})}
`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(context.messageHistory || []).map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ]

    const result = await this._call('/chat/completions', {
      messages,
      temperature: 0.8,
      max_tokens: 1024,
    })

    return result
  }

  /**
   * Respuestas simuladas (modo sin API key)
   */
  _mockResponse(endpoint, payload) {
    if (endpoint === '/chat/completions') {
      const userMsg = payload.messages?.at(-1)?.content?.toLowerCase() || ''

      let response = '¡Hola! Soy EuniceAI, tu asistente de salud y fitness. ¿En qué puedo ayudarte hoy? 💪'

      if (userMsg.includes('dieta') || userMsg.includes('comer') || userMsg.includes('comida')) {
        response = 'Para una dieta equilibrada te recomiendo: proteínas de calidad (pollo, pescado, legumbres), carbohidratos complejos (arroz integral, avena, quinoa) y grasas saludables (aguacate, nueces). ¿Tienes alguna preferencia o restricción alimentaria? 🥗\n\n⚕️ *Recuerda: este asistente es informativo. Consulta con un nutriólogo para un plan personalizado.*'
      } else if (userMsg.includes('ejercicio') || userMsg.includes('entrenar') || userMsg.includes('gym')) {
        response = 'El entrenamiento ideal combina cardio y fuerza. Para principiantes recomiendo 3 días a la semana con ejercicios compuestos: sentadillas, press de banca, peso muerto y dominadas. ¿Cuál es tu objetivo principal? 🏋️\n\n⚕️ *Consulta con un entrenador antes de comenzar si tienes lesiones previas.*'
      } else if (userMsg.includes('agua') || userMsg.includes('hidrat')) {
        response = 'La recomendación general es 35-40ml de agua por kilogramo de peso corporal al día. Si pesas 70kg, necesitas aproximadamente 2.5-3 litros diarios, más si haces ejercicio intenso. 💧'
      }

      if (payload.response_format?.type === 'json_object') {
        if (payload.messages?.[0]?.content?.includes('nutricionista')) {
          return {
            totalCalories: 2200,
            macros: { protein: 150, carbs: 240, fat: 73 },
            days: Array.from({ length: 7 }, (_, i) => ({
              day: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][i],
              meals: [
                {
                  name: 'Desayuno',
                  time: '07:30',
                  items: [
                    { name: 'Avena con leche descremada', quantity: '80g', calories: 300, protein: 12, carbs: 54, fat: 5 },
                    { name: 'Plátano', quantity: '1 pieza', calories: 90, protein: 1, carbs: 23, fat: 0 },
                    { name: 'Café negro', quantity: '240ml', calories: 5, protein: 0, carbs: 1, fat: 0 },
                  ],
                  totalCalories: 395,
                },
                {
                  name: 'Almuerzo',
                  time: '10:30',
                  items: [
                    { name: 'Manzana', quantity: '1 pieza', calories: 80, protein: 0, carbs: 21, fat: 0 },
                    { name: 'Nueces mixtas', quantity: '30g', calories: 180, protein: 4, carbs: 5, fat: 17 },
                  ],
                  totalCalories: 260,
                },
                {
                  name: 'Comida',
                  time: '14:00',
                  items: [
                    { name: 'Pechuga de pollo a la plancha', quantity: '200g', calories: 330, protein: 62, carbs: 0, fat: 7 },
                    { name: 'Arroz integral', quantity: '120g cocido', calories: 160, protein: 3, carbs: 34, fat: 1 },
                    { name: 'Ensalada verde', quantity: '200g', calories: 40, protein: 3, carbs: 7, fat: 0 },
                  ],
                  totalCalories: 530,
                },
                {
                  name: 'Merienda',
                  time: '17:00',
                  items: [
                    { name: 'Yogurt griego natural', quantity: '200g', calories: 130, protein: 17, carbs: 9, fat: 3 },
                    { name: 'Arándanos', quantity: '80g', calories: 45, protein: 1, carbs: 11, fat: 0 },
                  ],
                  totalCalories: 175,
                },
                {
                  name: 'Cena',
                  time: '20:00',
                  items: [
                    { name: 'Salmón al horno', quantity: '180g', calories: 350, protein: 36, carbs: 0, fat: 22 },
                    { name: 'Brócoli al vapor', quantity: '200g', calories: 70, protein: 6, carbs: 14, fat: 1 },
                    { name: 'Camote', quantity: '150g', calories: 130, protein: 2, carbs: 30, fat: 0 },
                  ],
                  totalCalories: 550,
                },
              ],
              totalCalories: 1910,
              macros: { protein: 148, carbs: 209, fat: 56 },
              notes: 'Beber 500ml de agua entre comidas. Tomar proteína post-entreno si hay sesión de gym.',
            })),
            recommendations: [
              'Mantén horarios regulares de comida para optimizar el metabolismo',
              'Prioriza la ingesta de proteína post-entrenamiento',
              'Incluye fibra en cada comida para mejorar la saciedad',
              'Limita alimentos procesados y azúcares refinados',
            ],
            disclaimer: 'Este plan es informativo y no sustituye la consulta con un profesional de la salud.',
          }
        }

        if (payload.messages?.[0]?.content?.includes('entrenador')) {
          return {
            name: 'Rutina de Fuerza y Resistencia',
            level: 'beginner',
            goal: 'strength',
            notes: 'Calentar 10 minutos antes de empezar. Descansar el tiempo indicado entre series.',
            days: [
              {
                day: 1,
                name: 'Día A — Pierna',
                focus: 'Cuádriceps, glúteos, isquiotibiales',
                estimatedDuration: 55,
                warmUp: ['5 min caminata en cinta', '2x15 sentadillas sin peso', 'Movilidad de cadera'],
                exercises: [
                  { name: 'Sentadilla con barra', muscleGroup: 'Cuádriceps/Glúteos', sets: [{ sets: 4, reps: '8-10', rest: 90, notes: 'Bajar hasta paralelo' }] },
                  { name: 'Peso muerto rumano', muscleGroup: 'Isquiotibiales/Glúteos', sets: [{ sets: 3, reps: '10-12', rest: 90 }] },
                  { name: 'Prensa de pierna', muscleGroup: 'Cuádriceps', sets: [{ sets: 3, reps: '12-15', rest: 60 }] },
                  { name: 'Extensión de pierna', muscleGroup: 'Cuádriceps', sets: [{ sets: 3, reps: '15', rest: 60 }] },
                  { name: 'Curl de pierna', muscleGroup: 'Isquiotibiales', sets: [{ sets: 3, reps: '12-15', rest: 60 }] },
                ],
                coolDown: ['Estiramiento de cuádriceps 2x30s', 'Estiramiento de isquiotibiales 2x30s', 'Pigeon pose 1x60s'],
              },
              {
                day: 2,
                name: 'Día B — Pecho y Tríceps',
                focus: 'Pectoral mayor, tríceps',
                estimatedDuration: 50,
                warmUp: ['Rotaciones de hombros', '2x15 flexiones de pared', 'Band pull-aparts'],
                exercises: [
                  { name: 'Press de banca plana', muscleGroup: 'Pectoral', sets: [{ sets: 4, reps: '8-10', rest: 90 }] },
                  { name: 'Press inclinado con mancuernas', muscleGroup: 'Pectoral superior', sets: [{ sets: 3, reps: '10-12', rest: 75 }] },
                  { name: 'Aperturas con mancuernas', muscleGroup: 'Pectoral', sets: [{ sets: 3, reps: '12-15', rest: 60 }] },
                  { name: 'Fondos en paralelas', muscleGroup: 'Tríceps/Pectoral', sets: [{ sets: 3, reps: 'Al fallo', rest: 90 }] },
                  { name: 'Press francés', muscleGroup: 'Tríceps', sets: [{ sets: 3, reps: '12', rest: 60 }] },
                ],
                coolDown: ['Estiramiento de pectoral en puerta 2x30s', 'Estiramiento de tríceps 2x30s'],
              },
              {
                day: 3,
                name: 'Día C — Espalda y Bíceps',
                focus: 'Dorsal ancho, romboides, bíceps',
                estimatedDuration: 55,
                warmUp: ['5 min remo en máquina', 'Band pull-aparts', 'Face pulls'],
                exercises: [
                  { name: 'Dominadas (o jalón al pecho)', muscleGroup: 'Dorsal', sets: [{ sets: 4, reps: 'Al fallo / 10-12', rest: 90 }] },
                  { name: 'Remo con barra', muscleGroup: 'Espalda media', sets: [{ sets: 4, reps: '8-10', rest: 90 }] },
                  { name: 'Remo en máquina', muscleGroup: 'Espalda media', sets: [{ sets: 3, reps: '12-15', rest: 60 }] },
                  { name: 'Curl con barra', muscleGroup: 'Bíceps', sets: [{ sets: 3, reps: '10-12', rest: 75 }] },
                  { name: 'Curl martillo', muscleGroup: 'Braquiorradial', sets: [{ sets: 3, reps: '12-15', rest: 60 }] },
                ],
                coolDown: ['Estiramiento de dorsal 2x30s', 'Estiramiento de bíceps 1x30s'],
              },
            ],
          }
        }
      }

      return {
        choices: [{ message: { content: response } }],
      }
    }

    return {}
  }
}

module.exports = { DeepSeekClient }
