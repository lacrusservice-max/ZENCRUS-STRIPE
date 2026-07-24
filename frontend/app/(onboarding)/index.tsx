import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Animated, Dimensions,
  Platform, KeyboardAvoidingView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { Colors, Spacing, Typography } from '@/constants/theme'
import { calculateTDEE, Goal, ActivityLevel, Gender } from '@/utils/tdee'
import api from '@/services/api'

const { width } = Dimensions.get('window')
const TOTAL_STEPS = 7

// ── Data ──────────────────────────────────────────────────────────────────────

const GOALS: { key: Goal; icon: string; emoji: string; label: string; desc: string; color: string }[] = [
  { key: 'lose_fat',    icon: 'trending-down', emoji: '🔥', label: 'Perder grasa',    desc: 'Definición, reducir peso y porcentaje de grasa corporal',    color: '#f97316' },
  { key: 'gain_muscle', icon: 'barbell',       emoji: '💪', label: 'Ganar músculo',   desc: 'Aumentar masa muscular, fuerza y potencia',                  color: '#60a5fa' },
  { key: 'maintain',   icon: 'shield-half',   emoji: '⚖️',  label: 'Mantenimiento',  desc: 'Mantener composición corporal y mejorar rendimiento',        color: '#a78bfa' },
]

const GENDERS: { key: Gender; label: string; icon: string; desc: string }[] = [
  { key: 'male',   label: 'Hombre', icon: 'male',   desc: 'Biológicamente masculino' },
  { key: 'female', label: 'Mujer',  icon: 'female', desc: 'Biológicamente femenino' },
  { key: 'other',  label: 'Prefiero no decir', icon: 'person', desc: '' },
]

const ACTIVITY_OPTIONS: { key: ActivityLevel; emoji: string; label: string; desc: string; detail: string }[] = [
  { key: 'sedentary',         emoji: '🪑', label: 'Sedentario',   desc: 'Trabajo de escritorio', detail: 'Sin ejercicio regular · Factor ×1.2' },
  { key: 'lightly_active',    emoji: '🚶', label: 'Ligero',       desc: '1-3 días/semana',       detail: 'Caminatas, actividad suave · Factor ×1.375' },
  { key: 'moderately_active', emoji: '🏃', label: 'Moderado',     desc: '3-5 días/semana',       detail: 'Ejercicio cardiovascular o de fuerza · Factor ×1.55' },
  { key: 'very_active',       emoji: '⚡', label: 'Muy activo',   desc: '6-7 días/semana',       detail: 'Entrenamiento de alta intensidad · Factor ×1.725' },
  { key: 'extremely_active',  emoji: '🏆', label: 'Atleta',       desc: 'Dobles sesiones',       detail: 'Competidor o trabajo físico extremo · Factor ×1.9' },
]

const TRAINING_TYPES: { value: string; emoji: string; label: string }[] = [
  { value: 'gym',          emoji: '🏋️', label: 'Gimnasio / Pesas' },
  { value: 'crossfit',     emoji: '🔥', label: 'CrossFit / HIIT' },
  { value: 'running',      emoji: '🏃', label: 'Running' },
  { value: 'cycling',      emoji: '🚴', label: 'Ciclismo' },
  { value: 'swimming',     emoji: '🏊', label: 'Natación' },
  { value: 'yoga',         emoji: '🧘', label: 'Yoga / Pilates' },
  { value: 'combat',       emoji: '🥊', label: 'Artes Marciales' },
  { value: 'calisthenics', emoji: '🤸', label: 'Calistenia' },
  { value: 'hyrox',        emoji: '🏟️', label: 'HYROX / Rucking' },
  { value: 'sports',       emoji: '⚽', label: 'Deportes de equipo' },
  { value: 'none',         emoji: '🌱', label: 'Apenas empiezo' },
]

const DIET_OPTIONS: { value: string; emoji: string; label: string }[] = [
  { value: 'none',         emoji: '✅', label: 'Sin restricciones' },
  { value: 'vegetarian',   emoji: '🥦', label: 'Vegetariano' },
  { value: 'vegan',        emoji: '🌱', label: 'Vegano' },
  { value: 'gluten_free',  emoji: '🌾', label: 'Sin gluten' },
  { value: 'lactose_free', emoji: '🥛', label: 'Sin lactosa' },
  { value: 'keto',         emoji: '🥑', label: 'Cetogénico / Keto' },
  { value: 'halal',        emoji: '☪️',  label: 'Halal' },
  { value: 'kosher',       emoji: '✡️',  label: 'Kosher' },
  { value: 'allergies',    emoji: '⚠️',  label: 'Alergias alimentarias' },
]

const MEALS_OPTIONS = [2, 3, 4, 5, 6]

// ── Step header info ──────────────────────────────────────────────────────────

const STEP_META = [
  { title: '¿Cuál es tu objetivo?',       subtitle: 'ZENCRUS construirá tu plan completo con esto',           icon: 'flag' },
  { title: 'Cuéntanos sobre ti',           subtitle: 'Calculamos tu metabolismo basal con Mifflin-St Jeor',   icon: 'person' },
  { title: 'Tu cuerpo hoy',                subtitle: 'Peso, estatura y edad para calcular tu TDEE exacto',    icon: 'body' },
  { title: 'Peso objetivo',                subtitle: 'Calculamos tu ritmo de progreso semana a semana',        icon: 'analytics' },
  { title: 'Nivel de actividad',           subtitle: 'Tu gasto calórico diario se multiplica por este factor', icon: 'pulse' },
  { title: 'Tipo de entrenamiento',        subtitle: 'Personalizamos tu rutina y macros de rendimiento',       icon: 'barbell' },
  { title: 'Preferencias alimentarias',    subtitle: 'Tu plan nutricional respeta tus elecciones',             icon: 'restaurant' },
]

// ── Animated progress dot ─────────────────────────────────────────────────────

function StepDot({ active, completed }: { active: boolean; completed: boolean }) {
  const scale = useRef(new Animated.Value(1)).current
  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1.3 : 1, useNativeDriver: true }).start()
  }, [active])
  return (
    <Animated.View style={[
      sdot.dot,
      completed && sdot.completed,
      active && sdot.active,
      { transform: [{ scale }] },
    ]}>
      {completed && <Ionicons name="checkmark" size={8} color="#000" />}
    </Animated.View>
  )
}
const sdot = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  active: { backgroundColor: Colors.primary[400], width: 20, borderRadius: 4 },
  completed: { backgroundColor: Colors.primary[600], alignItems: 'center', justifyContent: 'center' },
})

// ── Chip component ────────────────────────────────────────────────────────────

function Chip({ label, emoji, selected, onPress }: { label: string; emoji?: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[chip.base, selected && chip.active]}
    >
      {emoji && <Text style={chip.emoji}>{emoji}</Text>}
      <Text style={[chip.label, selected && chip.labelActive]}>{label}</Text>
      {selected && <Ionicons name="checkmark-circle" size={14} color={Colors.primary[400]} />}
    </TouchableOpacity>
  )
}
const chip = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  active: {
    borderColor: `${Colors.primary[500]}60`,
    backgroundColor: `${Colors.primary[500]}15`,
  },
  emoji: { fontSize: 16 },
  label: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  labelActive: { color: '#fff', fontWeight: '600' },
})

// ── Number picker ─────────────────────────────────────────────────────────────

function NumberPicker({ value, onChange, min, max, step = 1, suffix = '' }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string
}) {
  return (
    <View style={np.row}>
      <TouchableOpacity
        onPress={() => onChange(Math.max(min, value - step))}
        style={np.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="remove" size={20} color={value <= min ? 'rgba(255,255,255,0.2)' : '#fff'} />
      </TouchableOpacity>
      <View style={np.display}>
        <Text style={np.value}>{value}</Text>
        {suffix && <Text style={np.suffix}>{suffix}</Text>}
      </View>
      <TouchableOpacity
        onPress={() => onChange(Math.min(max, value + step))}
        style={np.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="add" size={20} color={value >= max ? 'rgba(255,255,255,0.2)' : '#fff'} />
      </TouchableOpacity>
    </View>
  )
}
const np = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginVertical: 8 },
  btn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  display: { flexDirection: 'row', alignItems: 'baseline', gap: 4, minWidth: 90, justifyContent: 'center' },
  value: { fontSize: 40, fontWeight: '800', color: '#fff' },
  suffix: { fontSize: 16, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
})

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { user, setUser } = useAuthStore()

  const [step, setStep]       = useState(0)
  const [loading, setLoading] = useState(false)

  const fadeAnim  = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const headerY   = useRef(new Animated.Value(-20)).current
  const headerOp  = useRef(new Animated.Value(0)).current

  // Step data
  const [goal, setGoal]                   = useState<Goal | null>(null)
  const [gender, setGender]               = useState<Gender | null>(null)
  const [age, setAge]                     = useState(25)
  const [weight, setWeight]               = useState(70)
  const [height, setHeight]               = useState(170)
  const [targetWeight, setTargetWeight]   = useState(65)
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null)
  const [trainingTypes, setTrainingTypes] = useState<string[]>([])
  const [trainingDays, setTrainingDays]   = useState(3)
  const [dietRestrictions, setDietRestrictions] = useState<string[]>([])
  const [mealsPerDay, setMealsPerDay]     = useState(4)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerY,  { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
    // Pre-fill from existing user data
    if (user?.age) setAge(user.age)
    if (user?.weight) setWeight(user.weight)
    if (user?.height) setHeight(user.height)
    if (user?.gender) setGender(user.gender as Gender)
  }, [])

  // ── Navigation ──────────────────────────────────────────────────────────────

  const animateStep = (dir: 'forward' | 'back') => {
    const out = dir === 'forward' ? -28 : 28
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: out, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      slideAnim.setValue(-out)
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start()
    })
  }

  const validate = (): string | null => {
    switch (step) {
      case 0: return goal ? null : 'Selecciona tu objetivo principal'
      case 1: return gender ? null : 'Selecciona tu género biológico para el cálculo'
      case 2: return null
      case 3: return null
      case 4: return activityLevel ? null : 'Selecciona tu nivel de actividad actual'
      default: return null
    }
  }

  const goNext = () => {
    const err = validate()
    if (err) { Alert.alert('Falta un dato', err); return }
    if (step < TOTAL_STEPS - 1) {
      animateStep('forward')
      setStep(s => s + 1)
    } else {
      handleFinish()
    }
  }

  const goBack = () => {
    if (step === 0) return
    animateStep('back')
    setStep(s => s - 1)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleFinish = async () => {
    if (!goal || !gender || !activityLevel) {
      Alert.alert('Faltan datos', 'Por favor completa todos los pasos'); return
    }

    setLoading(true)
    try {
      const tdee = calculateTDEE({
        weight, height, age, gender, activityLevel, goal,
        targetWeight: targetWeight ?? weight,
        mealsPerDay,
      })

      const profilePayload = {
        goal,
        gender,
        weight,
        height,
        age,
        goalWeight: targetWeight,
        activityLevel,
        trainingType: trainingTypes[0] ?? 'gym',
        trainingTypes,
        trainingDays,
        dietaryRestrictions: dietRestrictions,
        mealsPerDay,
      }

      const { data } = await api.post('/onboarding/complete', profilePayload)

      // Dispara la generación de dieta + rutina en segundo plano — no bloquea la navegación
      const workoutLevel = ['sedentary', 'lightly_active'].includes(activityLevel) ? 'beginner'
        : activityLevel === 'moderately_active' ? 'intermediate' : 'advanced'
      const workoutGoal = goal === 'lose_fat' ? 'endurance' : goal === 'gain_muscle' ? 'hypertrophy' : 'functional'
      const equipment = trainingTypes.includes('calisthenics') || trainingTypes.includes('none') ? ['bodyweight'] : ['bodyweight', 'dumbbells', 'barbell']
      api.post('/diet/generate', { durationDays: 7 }).catch(() => {})
      api.post('/workout/generate', { level: workoutLevel, goal: workoutGoal, daysPerWeek: trainingDays, equipment }).catch(() => {})

      // Update local user with fresh goals
      setUser({
        ...user!,
        ...data.data,
        goals: {
          main_goal: goal,
          target_weight: targetWeight,
          calories_target: tdee.targetCalories,
          protein_g: tdee.proteinG,
          carbs_g: tdee.carbsG,
          fat_g: tdee.fatG,
          fiber_g: tdee.fiberG,
          meals_per_day: mealsPerDay,
          tdee: tdee.tdee,
          bmr: tdee.bmr,
        },
        weight, height, age, gender, activity_level: activityLevel,
        fitness_goals: trainingTypes,
        dietary_restrictions: dietRestrictions,
        profile_completed: true,
      })

      router.replace('/welcome')
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'No pudimos guardar tu perfil. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const toggleTraining = (val: string) => {
    if (val === 'none') { setTrainingTypes(['none']); return }
    setTrainingTypes(prev => {
      const filtered = prev.filter(v => v !== 'none')
      return filtered.includes(val) ? filtered.filter(v => v !== val) : [...filtered, val]
    })
  }

  const toggleDiet = (val: string) => {
    if (val === 'none') { setDietRestrictions(['none']); return }
    setDietRestrictions(prev => {
      const filtered = prev.filter(v => v !== 'none')
      return filtered.includes(val) ? filtered.filter(v => v !== val) : [...filtered, val]
    })
  }

  const meta = STEP_META[step]

  return (
    <View style={s.bg}>
      <View style={[s.blob, { top: -120, right: -80, backgroundColor: Colors.primary[500] }]} />
      <View style={[s.blob, { bottom: -60, left: -80, backgroundColor: Colors.secondary[500], opacity: 0.06 }]} />

      <SafeAreaView style={{ flex: 1 }}>

        {/* ── Header ── */}
        <Animated.View style={[s.header, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
          <TouchableOpacity
            onPress={goBack}
            style={[s.backBtn, step === 0 && { opacity: 0 }]}
            disabled={step === 0}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.65)" />
          </TouchableOpacity>

          {/* Step dots */}
          <View style={s.dots}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <StepDot key={i} active={i === step} completed={i < step} />
            ))}
          </View>

          <Text style={s.stepCount}>{step + 1}/{TOTAL_STEPS}</Text>
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* Step meta */}
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              <View style={s.stepMeta}>
                <View style={s.stepIconWrap}>
                  <Ionicons name={meta.icon as any} size={22} color={Colors.primary[400]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.stepTitle}>{meta.title}</Text>
                  <Text style={s.stepSubtitle}>{meta.subtitle}</Text>
                </View>
              </View>

              {/* ── STEP 0: Goal ── */}
              {step === 0 && (
                <View style={{ gap: 12 }}>
                  {GOALS.map(g => (
                    <TouchableOpacity
                      key={g.key}
                      onPress={() => setGoal(g.key)}
                      activeOpacity={0.8}
                      style={[s.goalCard, goal === g.key && { borderColor: g.color, backgroundColor: `${g.color}12` }]}
                    >
                      <View style={[s.goalEmoji, { backgroundColor: `${g.color}20` }]}>
                        <Text style={{ fontSize: 26 }}>{g.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.goalLabel, goal === g.key && { color: '#fff' }]}>{g.label}</Text>
                        <Text style={s.goalDesc}>{g.desc}</Text>
                      </View>
                      <View style={[s.goalRadio, goal === g.key && { borderColor: g.color }]}>
                        {goal === g.key && <View style={[s.goalRadioDot, { backgroundColor: g.color }]} />}
                      </View>
                    </TouchableOpacity>
                  ))}

                  <View style={s.sciBox}>
                    <Ionicons name="flask-outline" size={14} color={Colors.primary[400]} />
                    <Text style={s.sciText}>
                      Tu objetivo define el ajuste calórico según la fórmula de déficit/superávit energético validada por el{' '}
                      <Text style={s.sciHighlight}>American Journal of Clinical Nutrition (2006)</Text>.
                    </Text>
                  </View>
                </View>
              )}

              {/* ── STEP 1: Gender & age ── */}
              {step === 1 && (
                <View style={{ gap: 20 }}>
                  <View>
                    <Text style={s.fieldLabel}>Género biológico</Text>
                    <Text style={s.fieldNote}>La ecuación de Mifflin-St Jeor usa el sexo biológico para calcular el metabolismo basal.</Text>
                    <View style={{ gap: 10, marginTop: 12 }}>
                      {GENDERS.map(g => (
                        <TouchableOpacity
                          key={g.key}
                          onPress={() => setGender(g.key)}
                          activeOpacity={0.8}
                          style={[s.optionRow, gender === g.key && s.optionActive]}
                        >
                          <View style={[s.optionIcon, gender === g.key && { backgroundColor: `${Colors.primary[500]}30` }]}>
                            <Ionicons name={g.icon as any} size={20} color={gender === g.key ? Colors.primary[400] : 'rgba(255,255,255,0.4)'} />
                          </View>
                          <Text style={[s.optionLabel, gender === g.key && { color: '#fff' }]}>{g.label}</Text>
                          {gender === g.key && <Ionicons name="checkmark-circle" size={20} color={Colors.primary[400]} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={s.divider} />

                  <View>
                    <Text style={s.fieldLabel}>Edad</Text>
                    <NumberPicker value={age} onChange={setAge} min={12} max={100} suffix="años" />
                  </View>
                </View>
              )}

              {/* ── STEP 2: Weight & height ── */}
              {step === 2 && (
                <View style={{ gap: 24 }}>
                  <View>
                    <Text style={s.fieldLabel}>Peso actual</Text>
                    <NumberPicker value={weight} onChange={setWeight} min={30} max={300} suffix="kg" />
                  </View>

                  <View style={s.divider} />

                  <View>
                    <Text style={s.fieldLabel}>Estatura</Text>
                    <NumberPicker value={height} onChange={setHeight} min={100} max={250} suffix="cm" />
                  </View>

                  {/* Live BMR preview */}
                  {gender && (
                    <View style={s.previewBox}>
                      <Ionicons name="pulse-outline" size={16} color={Colors.primary[400]} />
                      <View>
                        <Text style={s.previewLabel}>Metabolismo basal estimado</Text>
                        <Text style={s.previewValue}>
                          {Math.round(
                            gender === 'male'
                              ? 10 * weight + 6.25 * height - 5 * age + 5
                              : 10 * weight + 6.25 * height - 5 * age - 161
                          ).toLocaleString()} kcal/día
                        </Text>
                        <Text style={s.previewNote}>Ecuación Mifflin-St Jeor (2005)</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* ── STEP 3: Target weight & meals ── */}
              {step === 3 && (
                <View style={{ gap: 24 }}>
                  {goal !== 'maintain' && (
                    <View>
                      <Text style={s.fieldLabel}>Peso objetivo</Text>
                      <Text style={s.fieldNote}>
                        {goal === 'lose_fat'
                          ? 'Recomendamos no bajar más de 0.5–1 kg por semana para preservar músculo.'
                          : 'Para ganar músculo limpio, 0.25–0.5 kg/semana es el ritmo óptimo.'}
                      </Text>
                      <NumberPicker value={targetWeight} onChange={setTargetWeight} min={30} max={300} suffix="kg" />
                      <View style={s.rateBox}>
                        <Text style={s.rateLabel}>Tiempo estimado para alcanzar tu objetivo</Text>
                        <Text style={s.rateValue}>
                          {Math.abs(weight - targetWeight) < 1
                            ? 'Ya estás cerca de tu objetivo'
                            : `≈ ${Math.ceil(Math.abs(weight - targetWeight) / (goal === 'lose_fat' ? 0.5 : 0.35))} semanas`}
                        </Text>
                      </View>
                    </View>
                  )}

                  {goal === 'maintain' && (
                    <View style={s.maintainBox}>
                      <Text style={{ fontSize: 32 }}>⚖️</Text>
                      <Text style={s.maintainText}>En modo mantenimiento, optimizamos tu rendimiento y energía sin cambio de peso. ¡Perfecto!</Text>
                    </View>
                  )}

                  <View style={s.divider} />

                  <View>
                    <Text style={s.fieldLabel}>Comidas por día</Text>
                    <Text style={s.fieldNote}>Distribuimos tus macros entre estas comidas para máxima saciedad y síntesis proteica.</Text>
                    <View style={s.mealsRow}>
                      {MEALS_OPTIONS.map(n => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setMealsPerDay(n)}
                          style={[s.mealChip, mealsPerDay === n && s.mealChipActive]}
                        >
                          <Text style={[s.mealNum, mealsPerDay === n && { color: Colors.primary[400] }]}>{n}</Text>
                          <Text style={s.mealLabel}>{n === 2 ? 'ayuno' : n <= 3 ? 'clásico' : n <= 4 ? 'óptimo' : 'frecuente'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* ── STEP 4: Activity ── */}
              {step === 4 && (
                <View style={{ gap: 10 }}>
                  {ACTIVITY_OPTIONS.map(a => (
                    <TouchableOpacity
                      key={a.key}
                      onPress={() => setActivityLevel(a.key)}
                      activeOpacity={0.8}
                      style={[s.activityCard, activityLevel === a.key && s.activityActive]}
                    >
                      <Text style={s.activityEmoji}>{a.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.activityLabel, activityLevel === a.key && { color: '#fff' }]}>{a.label}</Text>
                        <Text style={s.activityDesc}>{a.desc}</Text>
                        <Text style={s.activityDetail}>{a.detail}</Text>
                      </View>
                      {activityLevel === a.key && (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary[400]} />
                      )}
                    </TouchableOpacity>
                  ))}

                  <View style={s.sciBox}>
                    <Ionicons name="flask-outline" size={13} color={Colors.primary[400]} />
                    <Text style={s.sciText}>
                      Factores de actividad basados en{' '}
                      <Text style={s.sciHighlight}>Harris-Benedict revisado (Roza & Shizgal, 1984)</Text>{' '}
                      y validados por el{' '}
                      <Text style={s.sciHighlight}>Institute of Medicine (2002)</Text>.
                    </Text>
                  </View>
                </View>
              )}

              {/* ── STEP 5: Training type ── */}
              {step === 5 && (
                <View>
                  <Text style={s.fieldNote}>Selecciona todos los que practiques</Text>
                  <View style={s.chipGrid}>
                    {TRAINING_TYPES.map(t => (
                      <Chip
                        key={t.value}
                        label={t.label}
                        emoji={t.emoji}
                        selected={trainingTypes.includes(t.value)}
                        onPress={() => toggleTraining(t.value)}
                      />
                    ))}
                  </View>

                  {!trainingTypes.includes('none') && trainingTypes.length > 0 && (
                    <View style={{ marginTop: 20, gap: 12 }}>
                      <Text style={s.fieldLabel}>Días de entrenamiento por semana</Text>
                      <NumberPicker value={trainingDays} onChange={setTrainingDays} min={1} max={7} suffix="días" />
                    </View>
                  )}
                </View>
              )}

              {/* ── STEP 6: Diet ── */}
              {step === 6 && (
                <View>
                  <Text style={s.fieldNote}>Selecciona todas las que apliquen</Text>
                  <View style={s.chipGrid}>
                    {DIET_OPTIONS.map(d => (
                      <Chip
                        key={d.value}
                        label={d.label}
                        emoji={d.emoji}
                        selected={dietRestrictions.includes(d.value)}
                        onPress={() => toggleDiet(d.value)}
                      />
                    ))}
                  </View>

                  {/* Final summary */}
                  {goal && gender && activityLevel && (
                    <View style={s.summaryCard}>
                      <Text style={s.summaryTitle}>Tu resumen ZENCRUS</Text>
                      {[
                        { label: 'Objetivo',  value: GOALS.find(g => g.key === goal)?.label ?? '' },
                        { label: 'Género',    value: GENDERS.find(g => g.key === gender)?.label ?? '' },
                        { label: 'Cuerpo',    value: `${weight} kg · ${height} cm · ${age} años` },
                        { label: 'Actividad', value: ACTIVITY_OPTIONS.find(a => a.key === activityLevel)?.label ?? '' },
                        { label: 'Comidas',   value: `${mealsPerDay} al día` },
                      ].map(row => (
                        <View key={row.label} style={s.summaryRow}>
                          <Text style={s.summaryLabel}>{row.label}</Text>
                          <Text style={s.summaryValue}>{row.value}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

            </Animated.View>

            {/* ── CTA ── */}
            <TouchableOpacity
              style={[s.ctaBtn, loading && { opacity: 0.7 }]}
              onPress={goNext}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Text style={s.ctaText}>
                      {step === TOTAL_STEPS - 1 ? 'Ver mi plan personalizado' : 'Continuar'}
                    </Text>
                    <Ionicons
                      name={step === TOTAL_STEPS - 1 ? 'sparkles' : 'arrow-forward'}
                      size={18}
                      color="#fff"
                    />
                  </>
                )
              }
            </TouchableOpacity>

            {step < TOTAL_STEPS - 1 && (
              <TouchableOpacity style={s.skipBtn} onPress={goNext}>
                <Text style={s.skipText}>Omitir este paso</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080808' },
  blob: { position: 'absolute', width: 300, height: 300, borderRadius: 9999, opacity: 0.09 },
  scroll: { paddingHorizontal: Spacing[5], paddingBottom: 120 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[5], paddingTop: Spacing[2], paddingBottom: Spacing[3], gap: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  dots: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepCount: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },

  stepMeta: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    marginBottom: Spacing[6], marginTop: Spacing[2],
  },
  stepIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: `${Colors.primary[500]}20`,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4, lineHeight: 26 },
  stepSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },

  // Goal step
  goalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing[4],
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
  },
  goalEmoji: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  goalLabel: { fontSize: Typography.fontSize.base, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginBottom: 3 },
  goalDesc: { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 17 },
  goalRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  goalRadioDot: { width: 10, height: 10, borderRadius: 5 },

  // Gender / option rows
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing[4],
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  optionActive: { borderColor: `${Colors.primary[500]}60`, backgroundColor: `${Colors.primary[500]}10` },
  optionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  optionLabel: { flex: 1, fontSize: Typography.fontSize.base, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },

  fieldLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: 'rgba(255,255,255,0.65)', marginBottom: 6 },
  fieldNote: { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 18, marginBottom: 4 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  // BMR preview
  previewBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: `${Colors.primary[500]}12`,
    borderRadius: 14, borderWidth: 1, borderColor: `${Colors.primary[500]}30`,
    padding: Spacing[4],
  },
  previewLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 },
  previewValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  previewNote: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 },

  // Target / rate
  rateBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: Spacing[4], marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  rateLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 },
  rateValue: { fontSize: 18, fontWeight: '700', color: '#fff' },

  maintainBox: {
    alignItems: 'center', gap: 12, padding: Spacing[6],
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  maintainText: { fontSize: Typography.fontSize.base, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22 },

  // Meals
  mealsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  mealChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  mealChipActive: { borderColor: `${Colors.primary[500]}60`, backgroundColor: `${Colors.primary[500]}15` },
  mealNum: { fontSize: 20, fontWeight: '800', color: 'rgba(255,255,255,0.5)' },
  mealLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  // Activity
  activityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing[4],
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  activityActive: { borderColor: `${Colors.primary[500]}60`, backgroundColor: `${Colors.primary[500]}10` },
  activityEmoji: { fontSize: 24, width: 36, textAlign: 'center' },
  activityLabel: { fontSize: Typography.fontSize.base, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  activityDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  activityDetail: { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 },

  // Chip grid
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },

  // Science box
  sciBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: `${Colors.primary[500]}0A`,
    borderRadius: 12, padding: Spacing[4],
    borderWidth: 1, borderColor: `${Colors.primary[500]}20`,
    marginTop: 12,
  },
  sciText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 17 },
  sciHighlight: { color: Colors.primary[400], fontWeight: '600' },

  // Summary
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: Spacing[5], marginTop: Spacing[6],
  },
  summaryTitle: {
    fontSize: Typography.fontSize.sm, fontWeight: '700',
    color: Colors.primary[400], marginBottom: Spacing[4],
    textTransform: 'uppercase', letterSpacing: 1,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.35)' },
  summaryValue: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // CTA
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: Colors.primary[500],
    borderRadius: 16, paddingVertical: 18,
    shadowColor: Colors.primary[500], shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45, shadowRadius: 28, elevation: 16,
    marginTop: Spacing[6],
  },
  ctaText: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff' },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.25)', fontWeight: '500' },
})
