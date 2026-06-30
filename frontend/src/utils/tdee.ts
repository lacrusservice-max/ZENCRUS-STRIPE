// Mifflin-St Jeor equation for BMR (most accurate for general population)

export type Goal = 'lose_fat' | 'maintain' | 'gain_muscle'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active'
export type Gender = 'male' | 'female' | 'other'

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
}

const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose_fat: -500,
  maintain: 0,
  gain_muscle: 300,
}

// Macro splits (% of calories)
const MACRO_SPLIT: Record<Goal, { protein: number; carbs: number; fat: number }> = {
  lose_fat:     { protein: 0.40, carbs: 0.30, fat: 0.30 },
  maintain:     { protein: 0.30, carbs: 0.45, fat: 0.25 },
  gain_muscle:  { protein: 0.35, carbs: 0.45, fat: 0.20 },
}

export interface TDEEResult {
  bmr: number
  tdee: number
  targetCalories: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  weeklyWeightChange: number // kg per week (negative = loss)
  weeksToGoal: number | null
}

export function calculateTDEE(params: {
  weight: number       // kg
  height: number       // cm
  age: number
  gender: Gender
  activityLevel: ActivityLevel
  goal: Goal
  targetWeight: number // kg
  mealsPerDay?: number
}): TDEEResult {
  const { weight, height, age, gender, activityLevel, goal, targetWeight } = params

  // BMR
  let bmr: number
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161
  }

  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIER[activityLevel])
  const targetCalories = Math.max(1200, tdee + GOAL_ADJUSTMENT[goal])

  const split = MACRO_SPLIT[goal]
  // 1g protein = 4 kcal, 1g carbs = 4 kcal, 1g fat = 9 kcal
  const proteinG = Math.round((targetCalories * split.protein) / 4)
  const carbsG = Math.round((targetCalories * split.carbs) / 4)
  const fatG = Math.round((targetCalories * split.fat) / 9)
  // Fiber: ~14g per 1000 kcal (DRI recommendation)
  const fiberG = Math.round((targetCalories / 1000) * 14)

  // Weekly progress
  const dailyDeficitOrSurplus = targetCalories - tdee
  const weeklyWeightChange = (dailyDeficitOrSurplus * 7) / 7700 // 7700 kcal ≈ 1kg

  let weeksToGoal: number | null = null
  const weightDiff = targetWeight - weight
  if (Math.abs(weeklyWeightChange) > 0.01 && Math.sign(weightDiff) === Math.sign(weeklyWeightChange)) {
    weeksToGoal = Math.round(Math.abs(weightDiff / weeklyWeightChange))
  }

  return {
    bmr: Math.round(bmr),
    tdee,
    targetCalories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    weeklyWeightChange: Math.round(weeklyWeightChange * 100) / 100,
    weeksToGoal,
  }
}
