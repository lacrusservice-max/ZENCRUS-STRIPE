import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import {
  useMealPlanStore, DAYS, DAY_LABELS, MEAL_SLOTS,
  DayKey, MealSlotId, PlannedMeal,
} from '@/store/mealPlanStore'
import { useRecipesStore } from '@/store/recipesStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

// ── Macro Bar ─────────────────────────────────────────────────────────────────

function MacroRow({ calories, protein, carbs, fat, target = 2000 }: {
  calories: number; protein: number; carbs: number; fat: number; target?: number
}) {
  const pct = Math.min(calories / target, 1)
  const color = pct < 0.7 ? Colors.primary[500] : pct < 0.95 ? Colors.accent.green : Colors.accent.orange
  return (
    <View style={mb.wrap}>
      <View style={mb.bar}>
        <View style={[mb.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
      <View style={mb.macros}>
        <Text style={mb.cal}>{calories} kcal</Text>
        <Text style={mb.macro}>{protein}P</Text>
        <Text style={mb.macro}>{carbs}C</Text>
        <Text style={mb.macro}>{fat}G</Text>
      </View>
    </View>
  )
}
const mb = StyleSheet.create({
  wrap: { gap: Spacing[1] },
  bar: { height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  macros: { flexDirection: 'row', gap: Spacing[3] },
  cal: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.dark.text, flex: 1 },
  macro: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary },
})

// ── Add Meal Modal ─────────────────────────────────────────────────────────────

const QUICK_MEALS: PlannedMeal[] = [
  { id: 'qm1', name: 'Avena con fruta', emoji: '🥣', calories: 380, protein: 14, carbs: 60, fat: 8 },
  { id: 'qm2', name: 'Huevos revueltos', emoji: '🍳', calories: 280, protein: 20, carbs: 3, fat: 18 },
  { id: 'qm3', name: 'Pechuga con arroz', emoji: '🍗', calories: 450, protein: 42, carbs: 40, fat: 8 },
  { id: 'qm4', name: 'Ensalada César', emoji: '🥗', calories: 320, protein: 22, carbs: 18, fat: 16 },
  { id: 'qm5', name: 'Tacos de pollo', emoji: '🌮', calories: 520, protein: 36, carbs: 48, fat: 14 },
  { id: 'qm6', name: 'Salmón al horno', emoji: '🐟', calories: 380, protein: 38, carbs: 2, fat: 22 },
  { id: 'qm7', name: 'Pasta integral', emoji: '🍝', calories: 420, protein: 18, carbs: 64, fat: 10 },
  { id: 'qm8', name: 'Yogur griego', emoji: '🫙', calories: 140, protein: 17, carbs: 12, fat: 2 },
  { id: 'qm9', name: 'Manzana con mantequilla de cacahuate', emoji: '🍎', calories: 200, protein: 5, carbs: 28, fat: 8 },
  { id: 'qm10', name: 'Batido de proteína', emoji: '🥤', calories: 220, protein: 30, carbs: 15, fat: 4 },
  { id: 'qm11', name: 'Caldo de pollo', emoji: '🍲', calories: 180, protein: 16, carbs: 8, fat: 6 },
  { id: 'qm12', name: 'Pan integral con aguacate', emoji: '🥑', calories: 290, protein: 8, carbs: 32, fat: 14 },
]

function AddMealModal({ visible, day, slot, onClose }: {
  visible: boolean; day: DayKey; slot: MealSlotId; onClose: () => void
}) {
  const { setMeal } = useMealPlanStore()
  const { recipes } = useRecipesStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'quick' | 'recipes' | 'custom'>('quick')

  // Custom meal form
  const [cName, setCName]     = useState('')
  const [cCal, setCCal]       = useState('')
  const [cProt, setCProt]     = useState('')
  const [cCarbs, setCCarbs]   = useState('')
  const [cFat, setCFat]       = useState('')

  const slotLabel = MEAL_SLOTS.find(s => s.id === slot)?.label ?? slot

  const addMeal = async (meal: PlannedMeal) => {
    await setMeal(day, slot, { ...meal, id: `${meal.id}_${Date.now()}` })
    onClose()
  }

  const addCustom = async () => {
    if (!cName.trim() || !cCal) return
    await addMeal({
      id: `custom_${Date.now()}`,
      name: cName.trim(),
      emoji: '🍽️',
      calories: +cCal || 0,
      protein: +cProt || 0,
      carbs: +cCarbs || 0,
      fat: +cFat || 0,
    })
    setCName(''); setCCal(''); setCProt(''); setCCarbs(''); setCFat('')
  }

  const filteredQuick = search
    ? QUICK_MEALS.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : QUICK_MEALS

  const filteredRecipes = search
    ? recipes.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
    : recipes

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={am.container}>
          <View style={am.header}>
            <Text style={am.title}>Agregar a {slotLabel}</Text>
            <TouchableOpacity onPress={onClose}><Text style={am.close}>✕</Text></TouchableOpacity>
          </View>

          {/* Search */}
          <View style={am.searchWrap}>
            <Text style={am.searchIcon}>🔍</Text>
            <TextInput
              style={am.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar alimento..."
              placeholderTextColor={Colors.dark.textTertiary}
            />
          </View>

          {/* Source tabs */}
          <View style={am.tabs}>
            {(['quick', 'recipes', 'custom'] as const).map(t => (
              <TouchableOpacity key={t} style={[am.tab, tab === t && am.tabOn]} onPress={() => setTab(t)}>
                <Text style={[am.tabTxt, tab === t && am.tabTxtOn]}>
                  {t === 'quick' ? 'Rápido' : t === 'recipes' ? 'Recetas' : 'Personalizado'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing[4], paddingBottom: 60, gap: Spacing[2] }}>

            {tab === 'quick' && filteredQuick.map(meal => (
              <TouchableOpacity key={meal.id} style={am.mealRow} onPress={() => addMeal(meal)}>
                <Text style={am.mealEmoji}>{meal.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={am.mealName}>{meal.name}</Text>
                  <Text style={am.mealMacros}>{meal.calories} kcal · {meal.protein}P · {meal.carbs}C · {meal.fat}G</Text>
                </View>
                <Text style={am.mealAdd}>+</Text>
              </TouchableOpacity>
            ))}

            {tab === 'recipes' && filteredRecipes.map(recipe => (
              <TouchableOpacity key={recipe.id} style={am.mealRow} onPress={() => addMeal({
                id: recipe.id,
                name: recipe.title,
                emoji: recipe.emoji,
                calories: recipe.nutrition.calories,
                protein: recipe.nutrition.protein,
                carbs: recipe.nutrition.carbs,
                fat: recipe.nutrition.fat,
              })}>
                <Text style={am.mealEmoji}>{recipe.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={am.mealName}>{recipe.title}</Text>
                  <Text style={am.mealMacros}>{recipe.nutrition.calories} kcal · {recipe.nutrition.protein}P · {recipe.nutrition.carbs}C · {recipe.nutrition.fat}G</Text>
                </View>
                <Text style={am.mealAdd}>+</Text>
              </TouchableOpacity>
            ))}

            {tab === 'custom' && (
              <View style={am.customForm}>
                <Text style={am.customLabel}>Nombre del alimento</Text>
                <TextInput style={am.customInput} value={cName} onChangeText={setCName} placeholder="ej: Pollo marinado" placeholderTextColor={Colors.dark.textTertiary} />
                <View style={am.customRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={am.customLabel}>Calorías</Text>
                    <TextInput style={am.customInput} value={cCal} onChangeText={setCCal} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.dark.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={am.customLabel}>Proteína (g)</Text>
                    <TextInput style={am.customInput} value={cProt} onChangeText={setCProt} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.dark.textTertiary} />
                  </View>
                </View>
                <View style={am.customRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={am.customLabel}>Carbs (g)</Text>
                    <TextInput style={am.customInput} value={cCarbs} onChangeText={setCCarbs} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.dark.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={am.customLabel}>Grasas (g)</Text>
                    <TextInput style={am.customInput} value={cFat} onChangeText={setCFat} keyboardType="number-pad" placeholder="0" placeholderTextColor={Colors.dark.textTertiary} />
                  </View>
                </View>
                <TouchableOpacity style={am.customBtn} onPress={addCustom}>
                  <Text style={am.customBtnTxt}>Agregar alimento personalizado</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const am = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  title: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  close: { fontSize: 22, color: Colors.dark.textSecondary },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing[4], marginVertical: Spacing[3], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[3], borderWidth: 1, borderColor: Colors.dark.border },
  searchIcon: { fontSize: 16, marginRight: Spacing[2] },
  searchInput: { flex: 1, padding: Spacing[3], fontSize: Typography.fontSize.sm, color: Colors.dark.text },
  tabs: { flexDirection: 'row', marginHorizontal: Spacing[4], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: 3, gap: 3, marginBottom: Spacing[2] },
  tab: { flex: 1, paddingVertical: Spacing[2], borderRadius: BorderRadius.base, alignItems: 'center' },
  tabOn: { backgroundColor: Colors.primary[500] },
  tabTxt: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textSecondary },
  tabTxtOn: { color: '#fff' },
  mealRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[3], borderWidth: 1, borderColor: Colors.dark.border },
  mealEmoji: { fontSize: 24 },
  mealName: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  mealMacros: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  mealAdd: { fontSize: 22, fontWeight: '700', color: Colors.primary[400] },
  customForm: { gap: Spacing[3] },
  customRow: { flexDirection: 'row', gap: Spacing[3] },
  customLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textSecondary, marginBottom: Spacing[1] },
  customInput: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[3], fontSize: Typography.fontSize.sm, color: Colors.dark.text, borderWidth: 1, borderColor: Colors.dark.border },
  customBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', marginTop: Spacing[2] },
  customBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
})

// ── Meal Slot Card ─────────────────────────────────────────────────────────────

function MealSlotCard({ day, slot, onAdd }: { day: DayKey; slot: typeof MEAL_SLOTS[0]; onAdd: () => void }) {
  const { weekPlan, removeMeal, clearSlot } = useMealPlanStore()
  const meals = weekPlan[day]?.[slot.id] ?? []

  const totalCal = meals.reduce((s, m) => s + m.calories, 0)

  return (
    <View style={sc.card}>
      <View style={sc.header}>
        <Text style={sc.emoji}>{slot.emoji}</Text>
        <Text style={sc.label}>{slot.label}</Text>
        {totalCal > 0 && <Text style={sc.cal}>{totalCal} kcal</Text>}
        <TouchableOpacity style={sc.addBtn} onPress={onAdd}>
          <Text style={sc.addTxt}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {meals.map(meal => (
        <View key={meal.id} style={sc.mealItem}>
          <Text style={sc.mealEmoji}>{meal.emoji ?? '🍽️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={sc.mealName}>{meal.name}</Text>
            <Text style={sc.mealMacros}>{meal.calories} kcal · {meal.protein}g P</Text>
          </View>
          <TouchableOpacity onPress={() => removeMeal(day, slot.id, meal.id)}>
            <Text style={sc.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      {meals.length === 0 && (
        <Text style={sc.empty}>Sin alimentos — toca + Agregar</Text>
      )}
    </View>
  )
}

const sc = StyleSheet.create({
  card: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border, marginBottom: Spacing[3] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[2] },
  emoji: { fontSize: 18 },
  label: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  cal: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary },
  addBtn: { backgroundColor: Colors.primary[500] + '20', borderRadius: BorderRadius.base, paddingHorizontal: Spacing[3], paddingVertical: 4, borderWidth: 1, borderColor: Colors.primary[500] + '50' },
  addTxt: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.primary[400] },
  mealItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], paddingVertical: Spacing[2], borderTopWidth: 1, borderTopColor: Colors.dark.border },
  mealEmoji: { fontSize: 18 },
  mealName: { fontSize: Typography.fontSize.xs, fontWeight: '600', color: Colors.dark.text },
  mealMacros: { fontSize: 10, color: Colors.dark.textTertiary },
  remove: { fontSize: 14, color: Colors.dark.textTertiary, padding: 4 },
  empty: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, fontStyle: 'italic', paddingTop: Spacing[1] },
})

// ── Copy Day Modal ─────────────────────────────────────────────────────────────

function CopyDayModal({ visible, currentDay, onClose }: {
  visible: boolean; currentDay: DayKey; onClose: () => void
}) {
  const { copyDay, weekPlan } = useMealPlanStore()
  const otherDays = DAYS.filter(d => d !== currentDay)

  const handleCopy = async (from: DayKey) => {
    const dayHasMeals = Object.values(weekPlan[from] ?? {}).some(m => (m ?? []).length > 0)
    if (!dayHasMeals) {
      Alert.alert('Día vacío', `${DAY_LABELS[from]} no tiene comidas planeadas.`)
      return
    }
    await copyDay(from, currentDay)
    Alert.alert('Copiado', `Plan de ${DAY_LABELS[from]} copiado a ${DAY_LABELS[currentDay]}`)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cd.overlay} onPress={onClose} activeOpacity={1}>
        <View style={cd.sheet}>
          <Text style={cd.title}>Copiar plan de...</Text>
          {otherDays.map(d => {
            const count = Object.values(weekPlan[d] ?? {}).reduce((s, m) => s + (m ?? []).length, 0)
            return (
              <TouchableOpacity key={d} style={cd.dayRow} onPress={() => handleCopy(d)}>
                <Text style={cd.dayName}>{DAY_LABELS[d]}</Text>
                <Text style={cd.dayCount}>{count} alimentos</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

const cd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.dark.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing[5], paddingBottom: 40, gap: Spacing[1] },
  title: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[3] },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  dayName: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark.text },
  dayCount: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary },
})

// ── Main Screen ────────────────────────────────────────────────────────────────

const TODAY_IDX = (() => {
  const day = new Date().getDay()
  return day === 0 ? 6 : day - 1
})()

export default function MealPlannerScreen() {
  const router = useRouter()
  const { weekPlan, getDayMacros, load, activeWeek } = useMealPlanStore()

  const [selectedDay, setSelectedDay] = useState<DayKey>(DAYS[TODAY_IDX])
  const [addModal, setAddModal] = useState<{ day: DayKey; slot: MealSlotId } | null>(null)
  const [copyModal, setCopyModal] = useState(false)

  useEffect(() => { load() }, [])

  const dayMacros = getDayMacros(selectedDay)

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Plan semanal</Text>
          <Text style={s.week}>{activeWeek}</Text>
        </View>
        <TouchableOpacity style={s.groceryBtn} onPress={() => router.push('/grocery')}>
          <Text style={s.groceryTxt}>🛒 Lista</Text>
        </TouchableOpacity>
      </View>

      {/* Day selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayScroll}>
        {DAYS.map((d, i) => {
          const macros = getDayMacros(d)
          const hasMeals = macros.calories > 0
          const isToday = i === TODAY_IDX
          return (
            <TouchableOpacity
              key={d}
              style={[s.dayChip, selectedDay === d && s.dayChipOn, isToday && s.dayChipToday]}
              onPress={() => setSelectedDay(d)}
            >
              <Text style={[s.dayChipTxt, selectedDay === d && s.dayChipTxtOn]}>
                {DAY_LABELS[d].slice(0, 3)}
              </Text>
              {hasMeals && (
                <Text style={[s.dayChipCal, selectedDay === d && { color: '#fff' }]}>{macros.calories}</Text>
              )}
              {isToday && <View style={s.todayDot} />}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Day macros summary */}
        <View style={s.dayMacros}>
          <Text style={s.dayTitle}>{DAY_LABELS[selectedDay]}</Text>
          <MacroRow
            calories={dayMacros.calories}
            protein={dayMacros.protein}
            carbs={dayMacros.carbs}
            fat={dayMacros.fat}
          />
        </View>

        {/* Meal slots */}
        <View style={s.slots}>
          {MEAL_SLOTS.map(slot => (
            <MealSlotCard
              key={slot.id}
              day={selectedDay}
              slot={slot}
              onAdd={() => setAddModal({ day: selectedDay, slot: slot.id })}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={s.copyBtn} onPress={() => setCopyModal(true)}>
            <Text style={s.copyTxt}>📋 Copiar de otro día</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.groceryBtnFull} onPress={() => router.push('/grocery')}>
            <Text style={s.groceryBtnTxt}>🛒 Ver lista de compras</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {addModal && (
        <AddMealModal
          visible={true}
          day={addModal.day}
          slot={addModal.slot}
          onClose={() => setAddModal(null)}
        />
      )}

      <CopyDayModal
        visible={copyModal}
        currentDay={selectedDay}
        onClose={() => setCopyModal(false)}
      />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[2], gap: Spacing[3] },
  backBtn: { padding: Spacing[1] },
  backTxt: { fontSize: 28, color: Colors.dark.text, fontWeight: '300' },
  title: { fontSize: Typography.fontSize.xl, fontWeight: '900', color: Colors.dark.text },
  week: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary },
  groceryBtn: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], borderWidth: 1, borderColor: Colors.dark.border },
  groceryTxt: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.text },
  dayScroll: { paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], gap: Spacing[2] },
  dayChip: { alignItems: 'center', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderRadius: BorderRadius.lg, backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border, minWidth: 60, position: 'relative' },
  dayChipOn: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  dayChipToday: { borderColor: Colors.primary[400] + '80' },
  dayChipTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.textSecondary },
  dayChipTxtOn: { color: '#fff' },
  dayChipCal: { fontSize: 9, color: Colors.dark.textTertiary, marginTop: 2 },
  todayDot: { position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.accent.green },
  dayMacros: { marginHorizontal: Spacing[5], marginBottom: Spacing[4], gap: Spacing[2] },
  dayTitle: { fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  slots: { marginHorizontal: Spacing[5] },
  actions: { marginHorizontal: Spacing[5], gap: Spacing[3], marginTop: Spacing[2] },
  copyBtn: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  copyTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.textSecondary },
  groceryBtnFull: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center' },
  groceryBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
})
