/**
 * Validadores para respuestas de la IA
 * Protegen contra respuestas malformadas o peligrosas
 */

function validateDietPlanResponse(response) {
  const errors = []

  if (!response.totalCalories || typeof response.totalCalories !== 'number') {
    errors.push('totalCalories inválido')
  }

  if (response.totalCalories < 500 || response.totalCalories > 8000) {
    errors.push(`Calorías fuera de rango seguro: ${response.totalCalories}`)
  }

  if (!response.macros || typeof response.macros !== 'object') {
    errors.push('macros inválidos')
  }

  if (!Array.isArray(response.days) || response.days.length === 0) {
    errors.push('days inválidos o vacíos')
  }

  if (!response.disclaimer || !response.disclaimer.includes('profesional')) {
    errors.push('disclaimer de salud ausente o incompleto')
  }

  return { valid: errors.length === 0, errors }
}

function validateWorkoutResponse(response) {
  const errors = []

  if (!response.name || typeof response.name !== 'string') {
    errors.push('name inválido')
  }

  if (!Array.isArray(response.days) || response.days.length === 0) {
    errors.push('days inválidos o vacíos')
  }

  for (const day of response.days || []) {
    if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
      errors.push(`Día ${day.day} sin ejercicios`)
    }

    if (!Array.isArray(day.warmUp) || day.warmUp.length === 0) {
      errors.push(`Día ${day.day} sin calentamiento`)
    }
  }

  return { valid: errors.length === 0, errors }
}

function sanitizeChatResponse(response) {
  if (!response || typeof response !== 'string') {
    return 'Lo siento, no pude procesar tu mensaje. ¿Puedes intentar de nuevo?'
  }

  const dangerousPatterns = [
    /(?:toma|consume|ingiere)\s+\d+\s*(?:pastillas?|tabletas?|cápsulas?|mg)\s+de/gi,
    /dosis\s+de\s+\d+/gi,
    /sin\s+(?:médico|doctor|profesional)/gi,
  ]

  let sanitized = response
  for (const pattern of dangerousPatterns) {
    sanitized = sanitized.replace(pattern, '[información médica — consulta a tu médico]')
  }

  if (!sanitized.includes('profesional') && !sanitized.includes('médico') && !sanitized.includes('nutriólogo')) {
    if (sanitized.length > 100) {
      sanitized += '\n\n⚕️ *Recuerda: consulta siempre con un profesional de la salud.*'
    }
  }

  return sanitized
}

function detectMedicalEmergency(message) {
  const emergencyKeywords = [
    'dolor en el pecho', 'chest pain', 'no puedo respirar', 'dificultad para respirar',
    'mareo severo', 'pérdida del conocimiento', 'convulsión', 'desmayo',
    'sangrado excesivo', 'alergia severa', 'anafilaxia', 'reacción alérgica grave',
  ]

  const lowerMsg = message.toLowerCase()
  return emergencyKeywords.some(k => lowerMsg.includes(k))
}

const EMERGENCY_RESPONSE = `🚨 **ATENCIÓN MÉDICA URGENTE**

Lo que describes puede ser una emergencia médica. Por favor:

1. **Llama al 911** inmediatamente
2. **No te quedes solo/a**
3. **Si es posible, siéntate o acuéstate** en un lugar seguro

No soy un médico y no puedo ayudarte en emergencias. Tu salud y seguridad son lo más importante.

📞 **911** — Emergencias México
📞 **800-911-2000** — Cruz Roja
`

module.exports = {
  validateDietPlanResponse,
  validateWorkoutResponse,
  sanitizeChatResponse,
  detectMedicalEmergency,
  EMERGENCY_RESPONSE,
}
