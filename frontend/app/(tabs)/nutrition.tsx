import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform,
  FlatList, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/store/authStore'
import { useNutritionStore, FoodEntry, MealSlot } from '@/store/nutritionStore'
import { Colors, Glass, Typography, Spacing, BorderRadius } from '@/constants/theme'
import {
  lookupBarcode,
  classifyFoodByName,
  HEALTH_LEVEL_COLORS,
  HEALTH_LEVEL_LABELS,
  ScannedFood,
} from '@/services/barcodeService'
import { analyzePhotoMacros, PhotoMacros } from '@/services/foodPhotoService'

// ── Simple food database (local, expandable) ─────────────────────────────────
const FOOD_DB: Omit<FoodEntry, 'id' | 'timestamp'>[] = [
  { name: 'Pechuga de pollo (100g)',   calories: 165, protein: 31, carbs: 0,  fat: 3.6, fiber: 0,  amount: 100, unit: 'g' },
  { name: 'Arroz blanco cocido (100g)',calories: 130, protein: 2.7,carbs: 28, fat: 0.3, fiber: 0.4,amount: 100, unit: 'g' },
  { name: 'Huevo entero',              calories: 70,  protein: 6,  carbs: 0.6,fat: 5,   fiber: 0,  amount: 1,   unit: 'pza' },
  { name: 'Clara de huevo',            calories: 17,  protein: 3.6,carbs: 0.2,fat: 0.1, fiber: 0,  amount: 1,   unit: 'pza' },
  { name: 'Avena (100g)',              calories: 389, protein: 17, carbs: 66, fat: 7,   fiber: 10, amount: 100, unit: 'g' },
  { name: 'Plátano mediano',           calories: 89,  protein: 1.1,carbs: 23, fat: 0.3, fiber: 2.6,amount: 1,   unit: 'pza' },
  { name: 'Manzana mediana',           calories: 52,  protein: 0.3,carbs: 14, fat: 0.2, fiber: 2.4,amount: 1,   unit: 'pza' },
  { name: 'Leche entera (250ml)',      calories: 149, protein: 8,  carbs: 12, fat: 8,   fiber: 0,  amount: 250, unit: 'ml' },
  { name: 'Yogur griego (150g)',       calories: 132, protein: 12, carbs: 7,  fat: 5,   fiber: 0,  amount: 150, unit: 'g' },
  { name: 'Aguacate ½',               calories: 120, protein: 1.5,carbs: 6,  fat: 11,  fiber: 5,  amount: 80,  unit: 'g' },
  { name: 'Almendras (30g)',           calories: 174, protein: 6,  carbs: 6,  fat: 15,  fiber: 3.5,amount: 30,  unit: 'g' },
  { name: 'Pan integral (1 rebanada)', calories: 69,  protein: 3.6,carbs: 12, fat: 1,   fiber: 1.9,amount: 40,  unit: 'g' },
  { name: 'Pasta cocida (100g)',       calories: 158, protein: 5.8,carbs: 31, fat: 0.9, fiber: 1.8,amount: 100, unit: 'g' },
  { name: 'Salmón (100g)',             calories: 208, protein: 20, carbs: 0,  fat: 13,  fiber: 0,  amount: 100, unit: 'g' },
  { name: 'Atún en agua (100g)',       calories: 84,  protein: 20, carbs: 0,  fat: 0.5, fiber: 0,  amount: 100, unit: 'g' },
  { name: 'Papa cocida (100g)',        calories: 86,  protein: 1.7,carbs: 20, fat: 0.1, fiber: 1.8,amount: 100, unit: 'g' },
  { name: 'Camote cocido (100g)',      calories: 90,  protein: 2,  carbs: 21, fat: 0.1, fiber: 3,  amount: 100, unit: 'g' },
  { name: 'Brócoli (100g)',            calories: 34,  protein: 2.8,carbs: 7,  fat: 0.4, fiber: 2.6,amount: 100, unit: 'g' },
  { name: 'Espinacas (100g)',          calories: 23,  protein: 2.9,carbs: 3.6,fat: 0.4, fiber: 2.2,amount: 100, unit: 'g' },
  { name: 'Proteína whey (30g)',       calories: 120, protein: 25, carbs: 3,  fat: 1.5, fiber: 0,  amount: 30,  unit: 'g' },
  { name: 'Tortilla de maíz',         calories: 52,  protein: 1.4,carbs: 11, fat: 0.7, fiber: 1.2,amount: 30,  unit: 'g' },
  { name: 'Queso panela (50g)',        calories: 79,  protein: 7.4,carbs: 2,  fat: 4.5, fiber: 0,  amount: 50,  unit: 'g' },
  { name: 'Frijoles negros (100g)',    calories: 132, protein: 8.9,carbs: 24, fat: 0.5, fiber: 8.7,amount: 100, unit: 'g' },
  { name: 'Aceite de oliva (1 cda)',   calories: 119, protein: 0,  carbs: 0,  fat: 14,  fiber: 0,  amount: 14,  unit: 'g' },
  { name: 'Mantequilla de maní (2cdas)', calories: 188, protein: 8, carbs: 6, fat: 16, fiber: 1.9, amount: 32, unit: 'g' },
]

// ── Add Food Modal ────────────────────────────────────────────────────────────

interface AddFoodModalProps {
  visible: boolean
  mealId: string
  mealLabel: string
  onClose: () => void
  onAdd: (mealId: string, entry: FoodEntry) => void
}

// ── Barcode scanner tab (uses barcodeService mock, expo-camera to be wired later)

const DEMO_BARCODES = ['7502005556657', '7501000140131', '0048001348093', '7500478002069', '7500231134090']

function BarcodeScannerTab({ mealId, onAdd, onClose }: {
  mealId: string
  onAdd: (mealId: string, entry: FoodEntry) => void
  onClose: () => void
}) {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScannedFood | null>(null)
  const [manualBarcode, setManualBarcode] = useState('')

  const simulateScan = async (barcode?: string) => {
    const code = barcode ?? DEMO_BARCODES[Math.floor(Math.random() * DEMO_BARCODES.length)]
    setScanning(true)
    setResult(null)
    const found = await lookupBarcode(code)
    setScanning(false)
    setResult(found)
  }

  const addScanned = () => {
    if (!result) return
    onAdd(mealId, {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name: result.name,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      fiber: result.fiber ?? 0,
      amount: result.amount,
      unit: result.unit,
    })
    onClose()
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Camera placeholder */}
      <View style={sc2.camBox}>
        <View style={sc2.camInner}>
          <Text style={sc2.camIcon}>📷</Text>
          <Text style={sc2.camTitle}>Escáner de código de barras</Text>
          <Text style={sc2.camSub}>Cámara real: expo-camera (próximo paso){'\n'}Por ahora usa el botón de demostración</Text>
        </View>
        {/* Scanner corners */}
        <View style={[sc2.corner, sc2.tl]} />
        <View style={[sc2.corner, sc2.tr]} />
        <View style={[sc2.corner, sc2.bl]} />
        <View style={[sc2.corner, sc2.br]} />
      </View>

      {/* Manual barcode input */}
      <View style={sc2.manualRow}>
        <TextInput
          style={sc2.manualInput}
          value={manualBarcode}
          onChangeText={setManualBarcode}
          placeholder="Ingresar código de barras..."
          placeholderTextColor={Colors.neutral[500]}
          keyboardType="number-pad"
        />
        <TouchableOpacity
          style={sc2.manualBtn}
          onPress={() => simulateScan(manualBarcode || undefined)}
          disabled={scanning}
        >
          <Text style={sc2.manualBtnTxt}>Buscar</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={sc2.demoBtn} onPress={() => simulateScan()} disabled={scanning}>
        {scanning
          ? <ActivityIndicator color="#fff" />
          : <Text style={sc2.demoBtnTxt}>⚡ Simular escaneo (demo)</Text>
        }
      </TouchableOpacity>

      {/* Result card */}
      {result && (
        <View style={sc2.resultCard}>
          <View style={sc2.resultHeader}>
            <View style={{ flex: 1 }}>
              <Text style={sc2.resultName}>{result.name}</Text>
              {result.brand && <Text style={sc2.resultBrand}>{result.brand}</Text>}
            </View>
            <View style={[sc2.semaforo, { backgroundColor: HEALTH_LEVEL_COLORS[result.healthLevel] + '20', borderColor: HEALTH_LEVEL_COLORS[result.healthLevel] }]}>
              <Text style={[sc2.semaforoTxt, { color: HEALTH_LEVEL_COLORS[result.healthLevel] }]}>
                {HEALTH_LEVEL_LABELS[result.healthLevel]}
              </Text>
            </View>
          </View>
          <Text style={sc2.resultMacros}>
            {result.calories} kcal · P:{result.protein}g · C:{result.carbs}g · G:{result.fat}g{result.fiber ? ` · F:${result.fiber}g` : ''}
          </Text>
          <Text style={sc2.resultPortion}>{result.amount} {result.unit} por porción</Text>

          <TouchableOpacity style={sc2.addBtn} onPress={addScanned}>
            <Text style={sc2.addBtnTxt}>+ Agregar a comida</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const sc2 = StyleSheet.create({
  camBox: { height: 180, marginHorizontal: Spacing[4], marginTop: Spacing[3], backgroundColor: '#000', borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  camInner: { alignItems: 'center', gap: Spacing[2] },
  camIcon: { fontSize: 40 },
  camTitle: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: '#fff' },
  camSub: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 18 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: Colors.primary[400], borderWidth: 2.5 },
  tl: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0 },
  manualRow: { flexDirection: 'row', gap: Spacing[2], padding: Spacing[4], paddingBottom: 0 },
  manualInput: { flex: 1, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: BorderRadius.md, padding: Spacing[3], color: Colors.dark.text, fontSize: Typography.fontSize.sm },
  manualBtn: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.primary[500], borderRadius: BorderRadius.md, paddingHorizontal: Spacing[4], justifyContent: 'center' },
  manualBtnTxt: { color: Colors.primary[400], fontWeight: '700', fontSize: Typography.fontSize.sm },
  demoBtn: { marginHorizontal: Spacing[4], marginTop: Spacing[3], backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, padding: Spacing[3], alignItems: 'center' },
  demoBtnTxt: { color: '#fff', fontWeight: '800', fontSize: Typography.fontSize.sm },
  resultCard: { marginHorizontal: Spacing[4], marginTop: Spacing[3], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing[3], marginBottom: Spacing[2] },
  resultName: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  resultBrand: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  semaforo: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderWidth: 1 },
  semaforoTxt: { fontSize: Typography.fontSize.xs, fontWeight: '800' },
  resultMacros: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, marginBottom: Spacing[1] },
  resultPortion: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, marginBottom: Spacing[3] },
  addBtn: { backgroundColor: Colors.accent.green, borderRadius: BorderRadius.md, padding: Spacing[3], alignItems: 'center' },
  addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: Typography.fontSize.sm },
})

// ── Food Photo Tab ────────────────────────────────────────────────────────────

const DEMO_PHOTO_FOODS = [
  'Pollo a la plancha con arroz',
  'Tacos de carnitas',
  'Ensalada César',
  'Pizza de pepperoni',
  'Bowl de avena con frutas',
]

function FoodPhotoTab({ mealId, onAdd, onClose }: {
  mealId: string
  onAdd: (mealId: string, entry: FoodEntry) => void
  onClose: () => void
}) {
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<PhotoMacros | null>(null)
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null)

  const simulateAnalysis = async (foodHint?: string) => {
    setAnalyzing(true)
    setResult(null)
    const photoResult = await analyzePhotoMacros(foodHint ? `demo:${foodHint}` : 'demo:random')
    setAnalyzing(false)
    setResult(photoResult)
  }

  const HEALTH_LEVEL_COLORS_LOCAL: Record<string, string> = {
    excellent: Colors.accent.green,
    good: '#4CAF50',
    moderate: Colors.accent.yellow,
    poor: Colors.accent.orange,
    bad: '#FF375F',
  }

  const addResult = () => {
    if (!result) return
    onAdd(mealId, {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name: result.foodName,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      fiber: result.fiber ?? 0,
      amount: 1,
      unit: result.servingSize,
    })
    onClose()
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing[4], paddingBottom: 60 }}>
      {/* Camera placeholder */}
      <View style={fp.camBox}>
        <Text style={fp.camIcon}>🍽️</Text>
        <Text style={fp.camTitle}>Análisis de foto con IA</Text>
        <Text style={fp.camSub}>
          {'Próximamente: apunta la cámara a tu plato\ny la IA detectará los macros automáticamente'}
        </Text>
      </View>

      {/* Demo buttons */}
      <Text style={fp.demoLabel}>Simular análisis de foto (demo):</Text>
      <View style={fp.demoGrid}>
        {DEMO_PHOTO_FOODS.map(food => (
          <TouchableOpacity
            key={food}
            style={[fp.demoChip, selectedDemo === food && fp.demoChipOn]}
            onPress={() => { setSelectedDemo(food); simulateAnalysis(food) }}
            disabled={analyzing}
          >
            <Text style={[fp.demoChipTxt, selectedDemo === food && fp.demoChipTxtOn]}>{food}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={fp.analyzeBtn} onPress={() => simulateAnalysis()} disabled={analyzing}>
        {analyzing
          ? <><ActivityIndicator color="#fff" size="small" /><Text style={fp.analyzeBtnTxt}> Analizando...</Text></>
          : <Text style={fp.analyzeBtnTxt}>📸 Tomar foto y analizar</Text>
        }
      </TouchableOpacity>

      {result && (
        <View style={fp.result}>
          <View style={fp.resultHeader}>
            <Text style={fp.resultName}>{result.foodName}</Text>
            <View style={[fp.confidenceBadge, { backgroundColor: HEALTH_LEVEL_COLORS_LOCAL[result.healthLevel] + '20' }]}>
              <Text style={[fp.confidenceTxt, { color: HEALTH_LEVEL_COLORS_LOCAL[result.healthLevel] }]}>
                {Math.round(result.confidence * 100)}% confianza
              </Text>
            </View>
          </View>
          <Text style={fp.serving}>{result.servingSize}</Text>
          <View style={fp.macroGrid}>
            {[
              { label: 'Calorías', val: `${result.calories}`, unit: 'kcal', color: Colors.primary[400] },
              { label: 'Proteína', val: `${result.protein}g`, unit: '', color: Colors.accent.green },
              { label: 'Carbos', val: `${result.carbs}g`, unit: '', color: Colors.accent.yellow },
              { label: 'Grasas', val: `${result.fat}g`, unit: '', color: Colors.accent.orange },
            ].map(({ label, val, color }) => (
              <View key={label} style={fp.macroCell}>
                <Text style={[fp.macroCellVal, { color }]}>{val}</Text>
                <Text style={fp.macroCellLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {result.tips.length > 0 && (
            <View style={fp.tips}>
              {result.tips.slice(0, 2).map((tip, i) => (
                <Text key={i} style={fp.tipTxt}>💡 {tip}</Text>
              ))}
            </View>
          )}
          <TouchableOpacity style={fp.addBtn} onPress={addResult}>
            <Text style={fp.addBtnTxt}>+ Agregar a comida</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const fp = StyleSheet.create({
  camBox: { height: 160, backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.dark.border, marginBottom: Spacing[4], gap: Spacing[2] },
  camIcon: { fontSize: 40 },
  camTitle: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  camSub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 18 },
  demoLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '700', marginBottom: Spacing[2] },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginBottom: Spacing[3] },
  demoChip: { paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.dark.border },
  demoChipOn: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[900] + '40' },
  demoChipTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary },
  demoChipTxtOn: { color: Colors.primary[400] },
  analyzeBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: Spacing[2], marginBottom: Spacing[4] },
  analyzeBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  result: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[4], borderWidth: 1, borderColor: Colors.dark.border, gap: Spacing[3] },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing[2] },
  resultName: { flex: 1, fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  confidenceBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing[2], paddingVertical: 3 },
  confidenceTxt: { fontSize: 10, fontWeight: '700' },
  serving: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary },
  macroGrid: { flexDirection: 'row', gap: Spacing[2] },
  macroCell: { flex: 1, alignItems: 'center', backgroundColor: Colors.dark.background, borderRadius: BorderRadius.md, padding: Spacing[3] },
  macroCellVal: { fontSize: Typography.fontSize.base, fontWeight: '900' },
  macroCellLabel: { fontSize: 10, color: Colors.dark.textTertiary, marginTop: 2 },
  tips: { gap: Spacing[1] },
  tipTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, lineHeight: 18 },
  addBtn: { backgroundColor: Colors.accent.green, borderRadius: BorderRadius.md, padding: Spacing[3], alignItems: 'center' },
  addBtnTxt: { color: '#fff', fontWeight: '800', fontSize: Typography.fontSize.sm },
})

// ── Add Food Modal ─────────────────────────────────────────────────────────────

interface AddFoodModalProps {
  visible: boolean
  mealId: string
  mealLabel: string
  onClose: () => void
  onAdd: (mealId: string, entry: FoodEntry) => void
}

function AddFoodModal({ visible, mealId, mealLabel, onClose, onAdd }: AddFoodModalProps) {
  const [tab, setTab] = useState<'search' | 'scanner' | 'foto' | 'manual'>('search')
  const [query, setQuery] = useState('')
  // Manual form
  const [name, setName]     = useState('')
  const [cal, setCal]       = useState('')
  const [prot, setProt]     = useState('')
  const [carbs, setCarbs]   = useState('')
  const [fat, setFat]       = useState('')
  const [fiber, setFiber]   = useState('')
  const [amount, setAmount] = useState('100')
  const [unit, setUnit]     = useState('g')
  const [multiplier, setMultiplier] = useState('1')

  const filtered = query.length > 1
    ? FOOD_DB.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    : FOOD_DB.slice(0, 12)

  const addFromDB = (food: typeof FOOD_DB[0]) => {
    const ml = parseFloat(multiplier) || 1
    onAdd(mealId, {
      ...food,
      id: Date.now().toString(),
      timestamp: Date.now(),
      calories: Math.round(food.calories * ml),
      protein: Math.round(food.protein * ml * 10) / 10,
      carbs:   Math.round(food.carbs * ml * 10) / 10,
      fat:     Math.round(food.fat * ml * 10) / 10,
      fiber:   Math.round(food.fiber * ml * 10) / 10,
      amount:  Math.round(food.amount * ml),
    })
    setQuery(''); setMultiplier('1'); onClose()
  }

  const addManual = () => {
    if (!name || !cal) { Alert.alert('Campos requeridos', 'Nombre y calorías son obligatorios'); return }
    onAdd(mealId, {
      id: Date.now().toString(),
      timestamp: Date.now(),
      name, calories: +cal, protein: +prot || 0, carbs: +carbs || 0,
      fat: +fat || 0, fiber: +fiber || 0, amount: +amount || 1, unit,
    })
    setName(''); setCal(''); setProt(''); setCarbs(''); setFat(''); setFiber(''); setAmount('100')
    onClose()
  }

  const reset = () => { setQuery(''); setMultiplier('1'); setTab('search') }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={m.container}>
          <View style={m.header}>
            <Text style={m.title}>Agregar a {mealLabel}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose() }}>
              <Text style={m.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={m.tabsScroll}>
            <TouchableOpacity style={[m.tab, tab === 'search' && m.tabOn]} onPress={() => setTab('search')}>
              <Text style={[m.tabTxt, tab === 'search' && m.tabTxtOn]}>🔍 Buscar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.tab, tab === 'scanner' && m.tabOn]} onPress={() => setTab('scanner')}>
              <Text style={[m.tabTxt, tab === 'scanner' && m.tabTxtOn]}>📷 Escanear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.tab, tab === 'foto' && m.tabOn]} onPress={() => setTab('foto')}>
              <Text style={[m.tabTxt, tab === 'foto' && m.tabTxtOn]}>🍽️ Foto IA</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[m.tab, tab === 'manual' && m.tabOn]} onPress={() => setTab('manual')}>
              <Text style={[m.tabTxt, tab === 'manual' && m.tabTxtOn]}>✏️ Manual</Text>
            </TouchableOpacity>
          </ScrollView>

          {tab === 'search' && (
            <View style={{ flex: 1 }}>
              <TextInput
                style={m.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar alimento..."
                placeholderTextColor={Colors.neutral[500]}
                autoFocus
              />
              <View style={m.multRow}>
                <Text style={m.multLabel}>Multiplicador de porción:</Text>
                <TextInput
                  style={m.multInput}
                  value={multiplier}
                  onChangeText={setMultiplier}
                  keyboardType="decimal-pad"
                  placeholder="1"
                />
                <Text style={m.multHint}>× base</Text>
              </View>
              <FlatList
                data={filtered}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item }) => {
                  const ml = parseFloat(multiplier) || 1
                  const level = classifyFoodByName(item.name)
                  return (
                    <TouchableOpacity style={m.foodRow} onPress={() => addFromDB(item)}>
                      <View style={[m.semaforoDot, { backgroundColor: HEALTH_LEVEL_COLORS[level] }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={m.foodName}>{item.name}</Text>
                        <Text style={m.foodMacros}>
                          {Math.round(item.calories * ml)} kcal · P:{Math.round(item.protein * ml)}g · C:{Math.round(item.carbs * ml)}g · G:{Math.round(item.fat * ml)}g
                        </Text>
                      </View>
                      <Text style={m.addIcon}>+</Text>
                    </TouchableOpacity>
                  )
                }}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          )}

          {tab === 'scanner' && (
            <ScrollView keyboardShouldPersistTaps="handled">
              <BarcodeScannerTab mealId={mealId} onAdd={onAdd} onClose={onClose} />
            </ScrollView>
          )}

          {tab === 'foto' && (
            <FoodPhotoTab mealId={mealId} onAdd={onAdd} onClose={onClose} />
          )}

          {tab === 'manual' && (
            <ScrollView contentContainerStyle={{ padding: Spacing[5] }} keyboardShouldPersistTaps="handled">
              <Text style={m.fieldLabel}>Nombre del alimento *</Text>
              <TextInput style={m.input} value={name} onChangeText={setName} placeholder="Ej. Tacos de canasta" placeholderTextColor={Colors.neutral[600]} />

              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>Calorías *</Text>
                  <TextInput style={m.input} value={cal} onChangeText={setCal} keyboardType="number-pad" placeholder="300" placeholderTextColor={Colors.neutral[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>Cantidad</Text>
                  <TextInput style={m.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="100" placeholderTextColor={Colors.neutral[600]} />
                </View>
              </View>

              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>Proteína (g)</Text>
                  <TextInput style={m.input} value={prot} onChangeText={setProt} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.neutral[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>Carbos (g)</Text>
                  <TextInput style={m.input} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.neutral[600]} />
                </View>
              </View>

              <View style={m.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>Grasas (g)</Text>
                  <TextInput style={m.input} value={fat} onChangeText={setFat} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.neutral[600]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={m.fieldLabel}>Fibra (g)</Text>
                  <TextInput style={m.input} value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={Colors.neutral[600]} />
                </View>
              </View>

              <TouchableOpacity style={m.addBtn} onPress={addManual}>
                <Text style={m.addBtnTxt}>Agregar alimento</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  title: { fontSize: Typography.fontSize.xl, fontWeight: '700', color: Colors.dark.text },
  closeBtn: { fontSize: 22, color: Colors.dark.textSecondary, padding: Spacing[2] },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  tabsScroll: { borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  tab: { paddingVertical: Spacing[3], paddingHorizontal: Spacing[4], alignItems: 'center' },
  tabOn: { borderBottomWidth: 2, borderBottomColor: Colors.primary[500] },
  tabTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '600' },
  tabTxtOn: { color: Colors.primary[400] },
  searchInput: { margin: Spacing[4], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.base, color: Colors.dark.text, borderWidth: 1, borderColor: Colors.dark.border },
  multRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4], marginBottom: Spacing[2], gap: Spacing[2] },
  multLabel: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, flex: 1 },
  multInput: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border, borderRadius: BorderRadius.base, padding: Spacing[2], width: 60, textAlign: 'center', color: Colors.dark.text, fontSize: Typography.fontSize.sm },
  multHint: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  foodName: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark.text },
  foodMacros: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  addIcon: { fontSize: 24, color: Colors.primary[500], fontWeight: '700', paddingLeft: Spacing[3] },
  semaforoDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing[2] },
  row2: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[3] },
  fieldLabel: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textSecondary, marginBottom: Spacing[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.dark.surface, borderWidth: 1.5, borderColor: Colors.dark.border, borderRadius: BorderRadius.md, padding: Spacing[3], fontSize: Typography.fontSize.base, color: Colors.dark.text },
  addBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center', marginTop: Spacing[4] },
  addBtnTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff' },
})

// ── Meal Section ──────────────────────────────────────────────────────────────

function MealSection({ meal, onAddPress, onRemove }: {
  meal: MealSlot
  onAddPress: () => void
  onRemove: (entryId: string) => void
}) {
  const [open, setOpen] = useState(true)
  const total = meal.entries.reduce((s, e) => s + e.calories, 0)
  const totalP = meal.entries.reduce((s, e) => s + e.protein, 0)
  const totalC = meal.entries.reduce((s, e) => s + e.carbs, 0)
  const totalF = meal.entries.reduce((s, e) => s + e.fat, 0)

  return (
    <View style={ms.wrap}>
      <TouchableOpacity style={ms.header} onPress={() => setOpen(v => !v)}>
        <Text style={ms.emoji}>{meal.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={ms.label}>{meal.label}</Text>
          {total > 0 && (
            <Text style={ms.sub}>{Math.round(total)} kcal · P:{Math.round(totalP)}g C:{Math.round(totalC)}g G:{Math.round(totalF)}g</Text>
          )}
        </View>
        <TouchableOpacity style={ms.addBtn} onPress={onAddPress}>
          <Text style={ms.addBtnTxt}>+ Agregar</Text>
        </TouchableOpacity>
        <Text style={[ms.chevron, open && { transform: [{ rotate: '90deg' }] }]}>›</Text>
      </TouchableOpacity>

      {open && (
        <View style={ms.entries}>
          {meal.entries.length === 0 ? (
            <TouchableOpacity style={ms.emptyRow} onPress={onAddPress}>
              <Text style={ms.emptyTxt}>Toca "Agregar" para registrar alimentos</Text>
            </TouchableOpacity>
          ) : (
            meal.entries.map(entry => {
              const level = classifyFoodByName(entry.name)
              return (
                <View key={entry.id} style={ms.entryRow}>
                  <View style={[ms.semaforoDot, { backgroundColor: HEALTH_LEVEL_COLORS[level] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={ms.entryName}>{entry.name}</Text>
                    <Text style={ms.entryMacros}>{entry.amount}{entry.unit} · {entry.calories} kcal · P:{entry.protein}g C:{entry.carbs}g G:{entry.fat}g</Text>
                  </View>
                  <TouchableOpacity onPress={() => onRemove(entry.id)} style={ms.removeBtn}>
                    <Text style={ms.removeTxt}>✕</Text>
                  </TouchableOpacity>
                </View>
              )
            })
          )}
        </View>
      )}
    </View>
  )
}

const ms = StyleSheet.create({
  wrap: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing[3], overflow: 'hidden', borderWidth: 1, borderColor: Colors.dark.border },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing[4], gap: Spacing[3] },
  emoji: { fontSize: 22 },
  label: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  sub: { fontSize: Typography.fontSize.xs, color: Colors.primary[400], marginTop: 2 },
  addBtn: { backgroundColor: Colors.primary[900] + '60', borderRadius: BorderRadius.base, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderWidth: 1, borderColor: Colors.primary[500] + '60' },
  addBtnTxt: { fontSize: Typography.fontSize.xs, color: Colors.primary[400], fontWeight: '700' },
  chevron: { fontSize: 20, color: Colors.dark.textTertiary, marginLeft: Spacing[1] },
  entries: { borderTopWidth: 1, borderTopColor: Colors.dark.border },
  emptyRow: { padding: Spacing[4] },
  emptyTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, textAlign: 'center' },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border + '80' },
  semaforoDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing[2] },
  entryName: { fontSize: Typography.fontSize.sm, fontWeight: '600', color: Colors.dark.text },
  entryMacros: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 2 },
  removeBtn: { padding: Spacing[2] },
  removeTxt: { fontSize: 14, color: Colors.accent.red, fontWeight: '700' },
})

// ── Main Screen ───────────────────────────────────────────────────────────────

const NUTRITION_TOOLS = [
  { icon: 'book-outline' as const,      label: 'Recetas',     sub: 'Cocina sano', route: '/recipes' },
  { icon: 'calendar-outline' as const,  label: 'Plan comidas',sub: 'Semana completa', route: '/meal-planner' },
  { icon: 'cart-outline' as const,      label: 'Compras',     sub: 'Lista inteligente', route: '/grocery' },
  { icon: 'camera-outline' as const,    label: 'Foto IA',     sub: 'Analiza tu plato', route: null },
]

export default function NutritionScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const {
    meals, totalCalories, totalProtein, totalCarbs, totalFat, totalFiber,
    loadToday, addEntry, removeEntry,
  } = useNutritionStore()

  const goals = (user as any)?.goals ?? {}
  const caloriesTarget = goals.calories_target ?? 2000
  const mealsPerDay    = goals.meals_per_day ?? 3
  const visibleMeals   = meals.slice(0, mealsPerDay)

  const [activeMeal, setActiveMeal]   = useState<{ id: string; label: string } | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => { loadToday() }, [])

  const openAdd = (mealId: string, mealLabel: string) => {
    setActiveMeal({ id: mealId, label: mealLabel })
    setModalVisible(true)
  }

  const remaining = Math.max(0, caloriesTarget - totalCalories)
  const pct = Math.min((totalCalories / caloriesTarget) * 100, 100)

  return (
    <SafeAreaView style={ns.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>

        {/* Header */}
        <View style={ns.header}>
          <View>
            <Text style={ns.brand}>NUTRICIÓN</Text>
            <Text style={ns.date}>{new Date().toLocaleDateString('es-MX', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
        </View>

        {/* Quick tools — Recetas, Plan, Compras, Foto IA */}
        <View style={ns.toolsRow}>
          {NUTRITION_TOOLS.map(tool => (
            <TouchableOpacity
              key={tool.label}
              style={ns.toolCard}
              onPress={() => tool.route ? router.push(tool.route as any) : Alert.alert('Foto IA', 'Agrega una comida y toca "📷 Foto IA" para analizar tu plato.')}
              activeOpacity={0.78}
            >
              <View style={ns.toolHighlight} pointerEvents="none" />
              <View style={ns.toolIconWrap}>
                <Ionicons name={tool.icon} size={22} color={Colors.primary[400]} />
              </View>
              <Text style={ns.toolLabel}>{tool.label}</Text>
              <Text style={ns.toolSub}>{tool.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Daily summary */}
        <View style={ns.summaryCard}>
          <View style={ns.calRow}>
            <View style={ns.calMain}>
              <Text style={ns.calNum}>{totalCalories.toLocaleString()}</Text>
              <Text style={ns.calLabel}>/ {caloriesTarget.toLocaleString()} kcal</Text>
            </View>
            <View style={ns.calStats}>
              <Text style={ns.calStatTxt}>Restante</Text>
              <Text style={[ns.calStatVal, { color: remaining === 0 ? Colors.accent.green : Colors.primary[400] }]}>
                {remaining > 0 ? remaining.toLocaleString() : '✓'} {remaining > 0 ? 'kcal' : 'Meta'}
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={ns.progTrack}>
            <View style={[ns.progFill, { width: `${pct}%` as any, backgroundColor: pct >= 100 ? Colors.accent.orange : Colors.primary[500] }]} />
          </View>

          {/* Macros */}
          <View style={ns.macrosRow}>
            <MacroChip label="Proteína" val={totalProtein} target={goals.protein_g ?? 150} color={Colors.primary[500]} />
            <MacroChip label="Carbos"   val={totalCarbs}   target={goals.carbs_g ?? 200}   color={Colors.secondary[500]} />
            <MacroChip label="Grasas"   val={totalFat}     target={goals.fat_g ?? 65}       color={Colors.accent.orange} />
            <MacroChip label="Fibra"    val={totalFiber}   target={goals.fiber_g ?? 28}     color={Colors.accent.green} />
          </View>
        </View>

        {/* Meal sections */}
        <View style={ns.section}>
          <Text style={ns.sectionTitle}>Registro del día</Text>
          {visibleMeals.map(meal => (
            <MealSection
              key={meal.id}
              meal={meal}
              onAddPress={() => openAdd(meal.id, meal.label)}
              onRemove={(entryId) => removeEntry(meal.id, entryId)}
            />
          ))}
        </View>

        {/* Quick tip */}
        <View style={ns.tip}>
          <Text style={ns.tipTxt}>💡 Registra tus comidas para ver tu progreso en tiempo real. La IA Coach puede analizar tu dieta de hoy.</Text>
        </View>
      </ScrollView>

      {/* Add Food Modal */}
      {activeMeal && (
        <AddFoodModal
          visible={modalVisible}
          mealId={activeMeal.id}
          mealLabel={activeMeal.label}
          onClose={() => setModalVisible(false)}
          onAdd={addEntry}
        />
      )}
    </SafeAreaView>
  )
}

function MacroChip({ label, val, target, color }: { label: string; val: number; target: number; color: string }) {
  return (
    <View style={mc2.wrap}>
      <Text style={[mc2.val, { color }]}>{Math.round(val)}g</Text>
      <Text style={mc2.target}>/ {target}g</Text>
      <Text style={mc2.label}>{label}</Text>
    </View>
  )
}
const mc2 = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  val: { fontSize: Typography.fontSize.base, fontWeight: '800' },
  target: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  label: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
})

const ns = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing[5] },
  brand: { fontSize: Typography.fontSize.xs, fontWeight: '800', color: Colors.primary[400], letterSpacing: 3 },
  date: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#fff', marginTop: 2, textTransform: 'capitalize' },
  // Quick tools grid
  toolsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing[4], gap: Spacing[3], marginBottom: Spacing[5] },
  toolCard: {
    width: '22%', flexGrow: 1,
    backgroundColor: Glass.card, borderRadius: 16,
    borderWidth: 1, borderColor: Glass.cardBorder,
    padding: Spacing[3], alignItems: 'center', gap: 6,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8,
  },
  toolHighlight: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 1,
    backgroundColor: Glass.cardHighlight,
  },
  toolIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Glass.purpleTint, borderWidth: 1, borderColor: Glass.purpleBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  toolLabel: { fontSize: 11, fontWeight: '700', color: '#fff', textAlign: 'center' },
  toolSub: { fontSize: 9, color: 'rgba(255,255,255,0.38)', textAlign: 'center' },
  // Summary card
  summaryCard: {
    marginHorizontal: Spacing[5], backgroundColor: Glass.elevated,
    borderRadius: BorderRadius.xl, padding: Spacing[5],
    borderWidth: 1, borderColor: Glass.cardBorder, marginBottom: Spacing[4],
    overflow: 'hidden',
  },
  calRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: Spacing[3] },
  calMain: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  calNum: { fontSize: 40, fontWeight: '800', color: '#fff' },
  calLabel: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.5)' },
  calStats: { alignItems: 'flex-end' },
  calStatTxt: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.35)' },
  calStatVal: { fontSize: Typography.fontSize.lg, fontWeight: '800' },
  progTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: Spacing[4] },
  progFill: { height: 5, borderRadius: 3 },
  macrosRow: { flexDirection: 'row', gap: Spacing[2] },
  section: { paddingHorizontal: Spacing[5] },
  sectionTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: '#fff', marginBottom: Spacing[3] },
  tip: {
    marginHorizontal: Spacing[5], marginTop: Spacing[4],
    backgroundColor: Glass.purpleTint, borderRadius: BorderRadius.md,
    padding: Spacing[4], borderWidth: 1, borderColor: Glass.purpleBorder,
  },
  tipTxt: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
})
