import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme'
import { calculateTDEE, Goal, ActivityLevel, Gender } from '@/utils/tdee'
import api from '@/services/api'

const TOTAL_STEPS = 6

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingData {
  goal: Goal | null
  currentWeight: string
  targetWeight: string
  height: string
  age: string
  gender: Gender | null
  activityLevel: ActivityLevel | null
  trainingType: string[]
  trainingDaysPerWeek: number
  mealsPerDay: number
  dietaryRestrictions: string[]
}

// ── Options ───────────────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string; emoji: string }[] = [
  { value: 'sedentary',         emoji: '🪑', label: 'Sedentario',     desc: 'Escritorio, sin ejercicio regular' },
  { value: 'lightly_active',    emoji: '🚶', label: 'Ligero',         desc: '1-3 días/semana, actividad suave' },
  { value: 'moderately_active', emoji: '🏃', label: 'Moderado',       desc: '3-5 días/semana, ejercicio regular' },
  { value: 'very_active',       emoji: '⚡', label: 'Muy activo',     desc: '6-7 días/semana, entrenamiento intenso' },
  { value: 'extremely_active',  emoji: '🏆', label: 'Atleta',         desc: 'Dobles sesiones o trabajo físico extremo' },
]

const TRAINING_TYPES: { value: string; emoji: string; label: string }[] = [
  { value: 'gym',        emoji: '🏋️', label: 'Gimnasio / Pesas' },
  { value: 'hyrox',      emoji: '🏟️', label: 'HYROX' },
  { value: 'crossfit',   emoji: '🔥', label: 'CrossFit / HIIT' },
  { value: 'running',    emoji: '🏃', label: 'Running / Cardio' },
  { value: 'cycling',    emoji: '🚴', label: 'Ciclismo' },
  { value: 'swimming',   emoji: '🏊', label: 'Natación' },
  { value: 'yoga',       emoji: '🧘', label: 'Yoga / Pilates' },
  { value: 'combat',     emoji: '🥊', label: 'Artes marciales / Boxeo' },
  { value: 'sports',     emoji: '⚽', label: 'Deportes de equipo' },
  { value: 'calisthenics', emoji: '🤸', label: 'Calistenia' },
  { value: 'hiking',     emoji: '🥾', label: 'Senderismo / Outdoor' },
  { value: 'none',       emoji: '💤', label: 'Sin entrenamiento aún' },
]

const DIET_OPTIONS = [
  'Vegano', 'Vegetariano', 'Sin gluten', 'Keto',
  'Sin lactosa', 'Paleo', 'Ayuno intermitente', 'Sin mariscos', 'Sin nueces',
]

// ── Onboarding Screen ─────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { setUser } = useAuthStore()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current

  const [data, setData] = useState<OnboardingData>({
    goal: null,
    currentWeight: '',
    targetWeight: '',
    height: '',
    age: '',
    gender: null,
    activityLevel: null,
    trainingType: [],
    trainingDaysPerWeek: 3,
    mealsPerDay: 3,
    dietaryRestrictions: [],
  })

  // Adjusted values (user can override the TDEE result)
  const baseResult = getResult(data)
  const [adjustedCalories, setAdjustedCalories] = useState<number | null>(null)
  const [adjustedProtein, setAdjustedProtein] = useState<number | null>(null)
  const [adjustedCarbs, setAdjustedCarbs] = useState<number | null>(null)
  const [adjustedFat, setAdjustedFat] = useState<number | null>(null)

  const effectiveCalories = adjustedCalories ?? baseResult?.targetCalories ?? 2000
  const effectiveProtein = adjustedProtein ?? baseResult?.proteinG ?? 150
  const effectiveCarbs = adjustedCarbs ?? baseResult?.carbsG ?? 200
  const effectiveFat = adjustedFat ?? baseResult?.fatG ?? 65

  const animateStep = () => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -20, duration: 120, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start()
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return !!data.goal
      case 1: return !!data.currentWeight && !!data.targetWeight && !!data.height &&
                     +data.currentWeight > 0 && +data.height > 0 && +data.targetWeight > 0
      case 2: return !!data.age && !!data.gender && +data.age >= 10
      case 3: return !!data.activityLevel
      case 4: return data.trainingType.length > 0
      case 5: return true
      default: return false
    }
  }

  const goNext = () => {
    if (!canProceed()) return
    animateStep()
    if (step < TOTAL_STEPS - 1) {
      // When entering step 5 (adjust), seed adjusted values from calculation
      if (step === 4 && baseResult) {
        setAdjustedCalories(baseResult.targetCalories)
        setAdjustedProtein(baseResult.proteinG)
        setAdjustedCarbs(baseResult.carbsG)
        setAdjustedFat(baseResult.fatG)
      }
      setStep(s => s + 1)
    } else {
      handleFinish()
    }
  }

  const goBack = () => { animateStep(); setStep(s => s - 1) }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const payload = {
        weight: +data.currentWeight,
        height: +data.height,
        age: +data.age,
        gender: data.gender,
        activity_level: data.activityLevel,
        fitness_goals: [data.goal],
        dietary_restrictions: data.dietaryRestrictions,
        goals: {
          main_goal: data.goal,
          target_weight: +data.targetWeight,
          calories_target: effectiveCalories,
          protein_g: effectiveProtein,
          carbs_g: effectiveCarbs,
          fat_g: effectiveFat,
          fiber_g: baseResult?.fiberG ?? 28,
          meals_per_day: data.mealsPerDay,
          training_type: data.trainingType,
          training_days_per_week: data.trainingDaysPerWeek,
          tdee: baseResult?.tdee ?? 0,
          bmr: baseResult?.bmr ?? 0,
        },
      }
      const { data: res } = await api.put('/users/profile', payload)
      if (res?.data) setUser(res.data)
      router.replace('/(tabs)')
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'No se pudo guardar el perfil. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = (key: keyof OnboardingData, value: string) => {
    const arr = (data[key] as string[])
    setData(d => ({
      ...d,
      [key]: arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value],
    }))
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Progress */}
      <View style={s.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[s.progressSeg, i <= step && s.progressSegActive]} />
        ))}
      </View>
      <Text style={s.stepCounter}>{step + 1} / {TOTAL_STEPS}</Text>

      <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: slideAnim }] }]}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 0 && <StepGoal data={data} setData={setData} />}
          {step === 1 && <StepBody data={data} setData={setData} />}
          {step === 2 && <StepPersonal data={data} setData={setData} />}
          {step === 3 && <StepActivity data={data} setData={setData} />}
          {step === 4 && <StepTraining data={data} setData={setData} toggle={toggle} />}
          {step === 5 && (
            <StepAdjust
              data={data} setData={setData} baseResult={baseResult}
              toggle={toggle}
              calories={effectiveCalories} setCalories={setAdjustedCalories}
              protein={effectiveProtein}  setProtein={setAdjustedProtein}
              carbs={effectiveCarbs}      setCarbs={setAdjustedCarbs}
              fat={effectiveFat}          setFat={setAdjustedFat}
            />
          )}
        </ScrollView>
      </Animated.View>

      {/* Nav */}
      <View style={s.nav}>
        {step > 0
          ? <TouchableOpacity style={s.backBtn} onPress={goBack}><Text style={s.backTxt}>← Atrás</Text></TouchableOpacity>
          : <View style={{ flex: 1 }} />
        }
        <TouchableOpacity
          style={[s.nextBtn, !canProceed() && s.nextBtnOff]}
          onPress={goNext}
          disabled={!canProceed() || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.nextTxt}>{step === TOTAL_STEPS - 1 ? '¡Comenzar!' : 'Continuar →'}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function getResult(data: OnboardingData) {
  if (!data.goal || !data.activityLevel || !data.gender ||
      !data.currentWeight || !data.height || !data.age) return null
  return calculateTDEE({
    weight: +data.currentWeight,
    height: +data.height,
    age: +data.age,
    gender: data.gender,
    activityLevel: data.activityLevel,
    goal: data.goal,
    targetWeight: +data.targetWeight || +data.currentWeight,
    mealsPerDay: data.mealsPerDay,
  })
}

// ── Step 0: Goal ──────────────────────────────────────────────────────────────

function StepGoal({ data, setData }: any) {
  const opts = [
    { value: 'lose_fat',    emoji: '🔥', title: 'Bajar grasa',    desc: 'Déficit calórico, preservar músculo' },
    { value: 'maintain',    emoji: '⚖️', title: 'Mantener peso',  desc: 'Calorías de mantenimiento, salud óptima' },
    { value: 'gain_muscle', emoji: '💪', title: 'Ganar músculo',  desc: 'Superávit limpio, máxima fuerza y masa' },
  ]
  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>¿Cuál es tu objetivo?</Text>
      <Text style={s.stepSub}>Tu plan completo se construye alrededor de esta meta</Text>
      {opts.map(o => (
        <OptionCard key={o.value} selected={data.goal === o.value} onPress={() => setData((d: any) => ({ ...d, goal: o.value }))}>
          <Text style={s.optEmoji}>{o.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.optTitle, data.goal === o.value && s.optTitleOn]}>{o.title}</Text>
            <Text style={s.optDesc}>{o.desc}</Text>
          </View>
          {data.goal === o.value && <Text style={s.check}>✓</Text>}
        </OptionCard>
      ))}
    </View>
  )
}

// ── Step 1: Body ──────────────────────────────────────────────────────────────

function StepBody({ data, setData }: any) {
  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>Tu cuerpo</Text>
      <Text style={s.stepSub}>Base del cálculo metabólico personalizado</Text>
      <NumField label="Peso actual (kg)" value={data.currentWeight} onChange={v => setData((d: any) => ({ ...d, currentWeight: v }))} placeholder="75" />
      <NumField label="Peso objetivo (kg)" value={data.targetWeight} onChange={v => setData((d: any) => ({ ...d, targetWeight: v }))} placeholder="68" />
      <NumField label="Altura (cm)" value={data.height} onChange={v => setData((d: any) => ({ ...d, height: v }))} placeholder="175" />
    </View>
  )
}

// ── Step 2: Personal ──────────────────────────────────────────────────────────

function StepPersonal({ data, setData }: any) {
  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>Datos personales</Text>
      <Text style={s.stepSub}>Para el cálculo exacto de tu metabolismo basal</Text>
      <NumField label="Edad" value={data.age} onChange={v => setData((d: any) => ({ ...d, age: v }))} placeholder="28" decimal={false} />
      <Text style={s.fieldLabel}>Sexo biológico</Text>
      <View style={s.row}>
        {(['male', 'female'] as Gender[]).map(g => (
          <TouchableOpacity key={g} style={[s.genderBtn, data.gender === g && s.genderBtnOn]} onPress={() => setData((d: any) => ({ ...d, gender: g }))}>
            <Text style={{ fontSize: 32 }}>{g === 'male' ? '♂️' : '♀️'}</Text>
            <Text style={[s.genderLabel, data.gender === g && { color: Colors.primary[400] }]}>{g === 'male' ? 'Hombre' : 'Mujer'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ── Step 3: Activity ──────────────────────────────────────────────────────────

function StepActivity({ data, setData }: any) {
  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>Nivel de actividad</Text>
      <Text style={s.stepSub}>Refleja tu estilo de vida general, no solo el gimnasio</Text>
      {ACTIVITY_OPTIONS.map(o => (
        <OptionCard key={o.value} selected={data.activityLevel === o.value} onPress={() => setData((d: any) => ({ ...d, activityLevel: o.value }))}>
          <Text style={s.optEmoji}>{o.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.optTitle, data.activityLevel === o.value && s.optTitleOn]}>{o.label}</Text>
            <Text style={s.optDesc}>{o.desc}</Text>
          </View>
          {data.activityLevel === o.value && <Text style={s.check}>✓</Text>}
        </OptionCard>
      ))}
    </View>
  )
}

// ── Step 4: Training Type ─────────────────────────────────────────────────────

function StepTraining({ data, setData, toggle }: any) {
  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>¿Cómo entrenas?</Text>
      <Text style={s.stepSub}>Selecciona uno o varios tipos de entrenamiento</Text>

      <View style={s.trainingGrid}>
        {TRAINING_TYPES.map(t => {
          const on = data.trainingType.includes(t.value)
          return (
            <TouchableOpacity key={t.value} style={[s.trainingCard, on && s.trainingCardOn]} onPress={() => toggle('trainingType', t.value)}>
              <Text style={s.trainingEmoji}>{t.emoji}</Text>
              <Text style={[s.trainingLabel, on && s.trainingLabelOn]}>{t.label}</Text>
              {on && <View style={s.trainingCheck}><Text style={{ color: Colors.primary[500], fontSize: 12, fontWeight: '700' }}>✓</Text></View>}
            </TouchableOpacity>
          )
        })}
      </View>

      <Text style={[s.fieldLabel, { marginTop: Spacing[5] }]}>Días de entrenamiento a la semana: <Text style={{ color: Colors.primary[400] }}>{data.trainingDaysPerWeek}</Text></Text>
      <View style={s.row}>
        {[1, 2, 3, 4, 5, 6, 7].map(n => (
          <TouchableOpacity key={n} style={[s.dayBtn, data.trainingDaysPerWeek === n && s.dayBtnOn]} onPress={() => setData((d: any) => ({ ...d, trainingDaysPerWeek: n }))}>
            <Text style={[s.dayBtnTxt, data.trainingDaysPerWeek === n && { color: Colors.primary[400] }]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ── Step 5: Adjust + Preferences ─────────────────────────────────────────────

function StepAdjust({ data, setData, baseResult, toggle, calories, setCalories, protein, setProtein, carbs, setCarbs, fat, setFat }: any) {
  const calFromMacros = protein * 4 + carbs * 4 + fat * 9

  return (
    <View style={s.step}>
      <Text style={s.stepTitle}>Tu plan nutricional</Text>
      <Text style={s.stepSub}>Calculado según tus datos. Ajusta cualquier valor — son tuyos.</Text>

      {/* Calories */}
      <View style={s.adjustCard}>
        <View style={s.adjustHeader}>
          <Text style={s.adjustLabel}>🎯 Calorías diarias</Text>
          <Text style={s.adjustHint}>Auto-calculado · editable</Text>
        </View>
        <View style={s.adjustRow}>
          <TouchableOpacity style={s.adjBtn} onPress={() => setCalories(Math.max(1200, calories - 50))}>
            <Text style={s.adjBtnTxt}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={s.adjInput}
            value={String(calories)}
            onChangeText={v => { const n = parseInt(v); if (!isNaN(n)) setCalories(n) }}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={s.adjBtn} onPress={() => setCalories(calories + 50)}>
            <Text style={s.adjBtnTxt}>+</Text>
          </TouchableOpacity>
          <Text style={s.adjUnit}>kcal</Text>
        </View>
        {baseResult && (
          <Text style={s.adjustNote}>
            Tu TDEE: {baseResult.tdee} kcal · {data.goal === 'lose_fat' ? 'Déficit de 500' : data.goal === 'gain_muscle' ? 'Superávit de 300' : 'Mantenimiento'}
          </Text>
        )}
      </View>

      {/* Macros */}
      <View style={s.adjustCard}>
        <Text style={s.adjustLabel}>⚖️ Macronutrientes</Text>
        <Text style={[s.adjustNote, { marginBottom: Spacing[3] }]}>Calorías de macros: {calFromMacros} kcal</Text>

        <MacroAdjustRow label="Proteína" value={protein} color={Colors.primary[500]}
          onDec={() => setProtein(Math.max(50, protein - 5))}
          onInc={() => setProtein(protein + 5)}
          onChange={v => { const n = parseInt(v); if (!isNaN(n)) setProtein(n) }}
          kcal={protein * 4} />
        <MacroAdjustRow label="Carbohidratos" value={carbs} color={Colors.secondary[500]}
          onDec={() => setCarbs(Math.max(20, carbs - 5))}
          onInc={() => setCarbs(carbs + 5)}
          onChange={v => { const n = parseInt(v); if (!isNaN(n)) setCarbs(n) }}
          kcal={carbs * 4} />
        <MacroAdjustRow label="Grasas" value={fat} color={Colors.accent.orange}
          onDec={() => setFat(Math.max(20, fat - 5))}
          onInc={() => setFat(fat + 5)}
          onChange={v => { const n = parseInt(v); if (!isNaN(n)) setFat(n) }}
          kcal={fat * 9} />

        {baseResult && (
          <TouchableOpacity style={s.resetBtn} onPress={() => { setCalories(baseResult.targetCalories); setProtein(baseResult.proteinG); setCarbs(baseResult.carbsG); setFat(baseResult.fatG) }}>
            <Text style={s.resetBtnTxt}>↺ Restaurar valores calculados</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Meals per day */}
      <View style={s.adjustCard}>
        <Text style={s.adjustLabel}>🍽️ Comidas al día: <Text style={{ color: Colors.primary[400] }}>{data.mealsPerDay}</Text></Text>
        <View style={[s.row, { marginTop: Spacing[3] }]}>
          {[3, 4, 5, 6].map(n => (
            <TouchableOpacity key={n} style={[s.dayBtn, data.mealsPerDay === n && s.dayBtnOn]} onPress={() => setData((d: any) => ({ ...d, mealsPerDay: n }))}>
              <Text style={[s.dayBtnTxt, data.mealsPerDay === n && { color: Colors.primary[400] }]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Dietary preferences */}
      <View style={s.adjustCard}>
        <Text style={s.adjustLabel}>🥗 Preferencias alimenticias</Text>
        <View style={[s.chipsRow, { marginTop: Spacing[3] }]}>
          {DIET_OPTIONS.map(opt => {
            const on = data.dietaryRestrictions.includes(opt)
            return (
              <TouchableOpacity key={opt} style={[s.chip, on && s.chipOn]} onPress={() => toggle('dietaryRestrictions', opt)}>
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{opt}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {baseResult?.weeksToGoal && (
        <View style={s.etaCard}>
          <Text style={s.etaEmoji}>🗓️</Text>
          <Text style={s.etaTxt}>A este ritmo alcanzas tu objetivo en aproximadamente <Text style={{ color: Colors.primary[400], fontWeight: '700' }}>{baseResult.weeksToGoal} semanas</Text></Text>
        </View>
      )}
    </View>
  )
}

function MacroAdjustRow({ label, value, color, onDec, onInc, onChange, kcal }: any) {
  return (
    <View style={mar.row}>
      <Text style={[mar.label, { color }]}>{label}</Text>
      <View style={mar.controls}>
        <TouchableOpacity style={s.adjBtn} onPress={onDec}><Text style={s.adjBtnTxt}>−</Text></TouchableOpacity>
        <TextInput style={[s.adjInput, { borderColor: color + '60' }]} value={String(value)} onChangeText={onChange} keyboardType="number-pad" />
        <TouchableOpacity style={s.adjBtn} onPress={onInc}><Text style={s.adjBtnTxt}>+</Text></TouchableOpacity>
        <Text style={mar.unit}>g · {kcal}kcal</Text>
      </View>
    </View>
  )
}

const mar = StyleSheet.create({
  row: { marginBottom: Spacing[3] },
  label: { fontSize: Typography.fontSize.sm, fontWeight: '700', marginBottom: Spacing[2] },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  unit: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, minWidth: 60 },
})

// ── Reusable components ───────────────────────────────────────────────────────

function OptionCard({ selected, onPress, children }: any) {
  return (
    <TouchableOpacity style={[s.optCard, selected && s.optCardOn]} onPress={onPress}>
      {children}
    </TouchableOpacity>
  )
}

function NumField({ label, value, onChange, placeholder, decimal = true }: any) {
  return (
    <>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.numInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholderTextColor={Colors.neutral[600]}
      />
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.dark.background },
  progressRow:    { flexDirection: 'row', paddingHorizontal: Spacing[5], paddingTop: Spacing[4], gap: 6 },
  progressSeg:    { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.dark.border },
  progressSegActive: { backgroundColor: Colors.primary[500] },
  stepCounter:    { textAlign: 'center', fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, marginTop: Spacing[2] },
  scroll:         { paddingHorizontal: Spacing[5], paddingBottom: Spacing[10] },
  step:           { paddingTop: Spacing[5] },
  stepTitle:      { fontSize: Typography.fontSize['3xl'], fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[1] },
  stepSub:        { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, marginBottom: Spacing[5], lineHeight: 20 },

  // Option cards
  optCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[3], borderWidth: 1.5, borderColor: Colors.dark.border, gap: Spacing[3] },
  optCardOn:      { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] + '30' },
  optEmoji:       { fontSize: 28 },
  optTitle:       { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text, marginBottom: 2 },
  optTitleOn:     { color: Colors.primary[400] },
  optDesc:        { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, lineHeight: 16 },
  check:          { fontSize: 18, color: Colors.primary[500], fontWeight: '800' },

  // Inputs
  fieldLabel:     { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textSecondary, marginBottom: Spacing[2], textTransform: 'uppercase', letterSpacing: 0.8 },
  numInput:       { backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.xl, color: Colors.dark.text, marginBottom: Spacing[4], textAlign: 'center', fontWeight: '700' },

  // Gender
  row:            { flexDirection: 'row', gap: Spacing[3] },
  genderBtn:      { flex: 1, alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[5], borderWidth: 1.5, borderColor: Colors.dark.border, gap: Spacing[2] },
  genderBtnOn:    { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] + '30' },
  genderLabel:    { fontSize: Typography.fontSize.base, fontWeight: '600', color: Colors.dark.textSecondary },

  // Training grid
  trainingGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  trainingCard:   { width: '47%', backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[3], borderWidth: 1.5, borderColor: Colors.dark.border, alignItems: 'center', gap: Spacing[1] },
  trainingCardOn: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] + '30' },
  trainingEmoji:  { fontSize: 26 },
  trainingLabel:  { fontSize: 11, color: Colors.dark.textSecondary, textAlign: 'center', fontWeight: '600' },
  trainingLabelOn:{ color: Colors.primary[400] },
  trainingCheck:  { position: 'absolute', top: 4, right: 6 },

  // Days
  dayBtn:         { flex: 1, alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, paddingVertical: Spacing[3], borderWidth: 1.5, borderColor: Colors.dark.border },
  dayBtnOn:       { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] + '30' },
  dayBtnTxt:      { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.textSecondary },

  // Adjust cards
  adjustCard:     { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], marginBottom: Spacing[3], borderWidth: 1, borderColor: Colors.dark.border },
  adjustHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },
  adjustLabel:    { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  adjustHint:     { fontSize: Typography.fontSize.xs, color: Colors.primary[400] },
  adjustRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  adjustNote:     { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, marginTop: Spacing[2] },
  adjBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.border, alignItems: 'center', justifyContent: 'center' },
  adjBtnTxt:      { fontSize: 20, color: Colors.dark.text, fontWeight: '700', lineHeight: 24 },
  adjInput:       { flex: 1, backgroundColor: Colors.dark.background, borderWidth: 1.5, borderColor: Colors.dark.border, borderRadius: BorderRadius.base, padding: Spacing[3], fontSize: Typography.fontSize.xl, color: Colors.dark.text, textAlign: 'center', fontWeight: '700' },
  adjUnit:        { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '600', minWidth: 40 },
  resetBtn:       { marginTop: Spacing[3], alignItems: 'center', padding: Spacing[3], borderRadius: BorderRadius.base, backgroundColor: Colors.dark.background },
  resetBtnTxt:    { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '600' },

  // Chips
  chipsRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  chip:           { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, backgroundColor: Colors.dark.background, borderWidth: 1, borderColor: Colors.dark.border },
  chipOn:         { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] + '40' },
  chipTxt:        { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '500' },
  chipTxtOn:      { color: Colors.primary[400] },

  // ETA
  etaCard:        { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Colors.accent.green + '15', borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.accent.green + '40', marginTop: Spacing[2] },
  etaEmoji:       { fontSize: 24 },
  etaTxt:         { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, lineHeight: 20 },

  // Nav
  nav:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[4], gap: Spacing[3], borderTopWidth: 1, borderTopColor: Colors.dark.border },
  backBtn:        { flex: 1, padding: Spacing[4], alignItems: 'center' },
  backTxt:        { fontSize: Typography.fontSize.base, color: Colors.dark.textSecondary, fontWeight: '500' },
  nextBtn:        { flex: 2, backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center' },
  nextBtnOff:     { backgroundColor: Colors.dark.border },
  nextTxt:        { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})
