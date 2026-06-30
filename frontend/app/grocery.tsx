import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMealPlanStore, DAYS, DAY_LABELS } from '@/store/mealPlanStore'
import { useRecipesStore } from '@/store/recipesStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

// ── Category helpers ──────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { emoji: string; keywords: string[] }> = {
  'Proteínas': { emoji: '🥩', keywords: ['pollo', 'pechuga', 'carne', 'salmón', 'atún', 'huevo', 'proteína', 'res', 'cerdo', 'pavo', 'tilapia', 'camarón'] },
  'Lácteos': { emoji: '🥛', keywords: ['leche', 'yogur', 'queso', 'crema', 'mantequilla', 'cheddar'] },
  'Verduras': { emoji: '🥦', keywords: ['brócoli', 'espinaca', 'lechuga', 'tomate', 'zanahoria', 'cebolla', 'ajo', 'pepino', 'chile', 'ensalada', 'calabaza', 'aguacate'] },
  'Frutas': { emoji: '🍎', keywords: ['manzana', 'plátano', 'naranja', 'fresa', 'mango', 'uva', 'pera', 'durazno', 'fruta', 'arándano'] },
  'Granos y carbos': { emoji: '🌾', keywords: ['arroz', 'avena', 'pan', 'pasta', 'tortilla', 'quinoa', 'lenteja', 'frijol', 'garbanzo', 'harina', 'integral'] },
  'Grasas saludables': { emoji: '🥑', keywords: ['aceite', 'nuez', 'almendra', 'cacahuate', 'mantequilla de', 'semilla', 'chía'] },
  'Bebidas': { emoji: '🥤', keywords: ['leche', 'jugo', 'agua', 'batido', 'café', 'té', 'proteína', 'suero'] },
  'Condimentos': { emoji: '🫙', keywords: ['salsa', 'vinagre', 'mostaza', 'ketchup', 'limón', 'sal', 'pimienta', 'especias', 'chile en polvo'] },
}

function categorize(name: string): string {
  const lower = name.toLowerCase()
  for (const [cat, { keywords }] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) return cat
  }
  return 'Otros'
}

// ── Grocery Item Row ──────────────────────────────────────────────────────────

interface GroceryItem {
  id: string
  name: string
  count: number
  checked: boolean
  category: string
  custom?: boolean
}

function GroceryItemRow({ item, onToggle, onDelete }: {
  item: GroceryItem; onToggle: () => void; onDelete: () => void
}) {
  return (
    <TouchableOpacity style={[gi.row, item.checked && gi.rowChecked]} onPress={onToggle} activeOpacity={0.7}>
      <View style={[gi.check, item.checked && gi.checkOn]}>
        {item.checked && <Text style={gi.checkMark}>✓</Text>}
      </View>
      <Text style={[gi.name, item.checked && gi.nameChecked]}>{item.name}</Text>
      {item.count > 1 && (
        <Text style={gi.count}>×{item.count}</Text>
      )}
      {item.custom && (
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={gi.delete}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

const gi = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  rowChecked: { opacity: 0.5 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.dark.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Colors.accent.green, borderColor: Colors.accent.green },
  checkMark: { fontSize: 12, color: '#fff', fontWeight: '800' },
  name: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.text, fontWeight: '500' },
  nameChecked: { textDecorationLine: 'line-through', color: Colors.dark.textTertiary },
  count: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, backgroundColor: Colors.dark.border, borderRadius: BorderRadius.base, paddingHorizontal: Spacing[2], paddingVertical: 2 },
  delete: { fontSize: 14, color: Colors.dark.textTertiary, padding: 4 },
})

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function GroceryScreen() {
  const router = useRouter()
  const { getShoppingList, weekPlan, load } = useMealPlanStore()

  const [items, setItems] = useState<GroceryItem[]>([])
  const [newItem, setNewItem] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  useEffect(() => {
    load().then(() => {
      const list = getShoppingList()
      setItems(list.map((item, i) => ({
        id: `auto_${i}`,
        name: item.name,
        count: item.count,
        checked: false,
        category: categorize(item.name),
      })))
    })
  }, [])

  const addCustomItem = () => {
    const name = newItem.trim()
    if (!name) return
    setItems(prev => [...prev, {
      id: `custom_${Date.now()}`,
      name,
      count: 1,
      checked: false,
      category: categorize(name),
      custom: true,
    }])
    setNewItem('')
    setShowAdd(false)
  }

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item))
  }

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
  }

  const clearChecked = () => {
    Alert.alert('Limpiar marcados', '¿Eliminar todos los ítems marcados?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpiar', style: 'destructive', onPress: () => setItems(prev => prev.filter(i => !i.checked)) },
    ])
  }

  const filtered = items.filter(i => {
    if (filter === 'pending') return !i.checked
    if (filter === 'done') return i.checked
    return true
  })

  // Group by category
  const grouped = filtered.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  const checkedCount = items.filter(i => i.checked).length
  const totalCount = items.length

  // Week summary: which days have meals
  const weekSummary = DAYS.map(d => {
    const count = Object.values(weekPlan[d] ?? {}).reduce((s, m) => s + (m ?? []).length, 0)
    return { day: d, count }
  }).filter(d => d.count > 0)

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Lista de compras</Text>
          <Text style={s.sub}>{checkedCount}/{totalCount} completados</Text>
        </View>
        {checkedCount > 0 && (
          <TouchableOpacity onPress={clearChecked}>
            <Text style={s.clearTxt}>Limpiar ✓</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      {totalCount > 0 && (
        <View style={s.progressWrap}>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${(checkedCount / totalCount) * 100}%` as any }]} />
          </View>
        </View>
      )}

      {/* Week context */}
      {weekSummary.length > 0 && (
        <View style={s.weekCtx}>
          <Text style={s.weekCtxTxt}>
            Plan de {weekSummary.length} día{weekSummary.length !== 1 ? 's' : ''}: {weekSummary.map(d => DAY_LABELS[d.day].slice(0, 3)).join(', ')}
          </Text>
        </View>
      )}

      {/* Filter chips */}
      <View style={s.filters}>
        {(['all', 'pending', 'done'] as const).map(f => (
          <TouchableOpacity key={f} style={[s.filterChip, filter === f && s.filterChipOn]} onPress={() => setFilter(f)}>
            <Text style={[s.filterTxt, filter === f && s.filterTxtOn]}>
              {f === 'all' ? `Todo (${totalCount})` : f === 'pending' ? `Pendientes (${totalCount - checkedCount})` : `Listos (${checkedCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: Spacing[5] }}>

        {totalCount === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🛒</Text>
            <Text style={s.emptyTxt}>Lista vacía</Text>
            <Text style={s.emptySub}>Planifica tus comidas de la semana para generar tu lista automáticamente</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/meal-planner')}>
              <Text style={s.emptyBtnTxt}>Ir al planificador</Text>
            </TouchableOpacity>
          </View>
        ) : (
          Object.entries(grouped).map(([category, catItems]) => {
            const catEmoji = Object.entries(CATEGORIES).find(([k]) => k === category)?.[1].emoji ?? '📦'
            return (
              <View key={category} style={s.category}>
                <Text style={s.categoryHeader}>{catEmoji} {category}</Text>
                {catItems.map(item => (
                  <GroceryItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => toggleItem(item.id)}
                    onDelete={() => deleteItem(item.id)}
                  />
                ))}
              </View>
            )
          })
        )}

        {/* Add custom item */}
        {showAdd ? (
          <View style={s.addForm}>
            <TextInput
              style={s.addInput}
              value={newItem}
              onChangeText={setNewItem}
              placeholder="Nombre del producto..."
              placeholderTextColor={Colors.dark.textTertiary}
              autoFocus
              onSubmitEditing={addCustomItem}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addConfirmBtn} onPress={addCustomItem}>
              <Text style={s.addConfirmTxt}>Agregar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowAdd(false); setNewItem('') }}>
              <Text style={s.addCancelTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={s.addBtnTxt}>+ Agregar producto manualmente</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[2], gap: Spacing[3] },
  backBtn: { padding: Spacing[1] },
  backTxt: { fontSize: 28, color: Colors.dark.text, fontWeight: '300' },
  title: { fontSize: Typography.fontSize.xl, fontWeight: '900', color: Colors.dark.text },
  sub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary },
  clearTxt: { fontSize: Typography.fontSize.xs, color: Colors.accent.red, fontWeight: '700' },
  progressWrap: { paddingHorizontal: Spacing[5], marginBottom: Spacing[2] },
  progressBg: { height: 4, backgroundColor: Colors.dark.border, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: Colors.accent.green, borderRadius: 2 },
  weekCtx: { paddingHorizontal: Spacing[5], marginBottom: Spacing[2] },
  weekCtxTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary },
  filters: { flexDirection: 'row', paddingHorizontal: Spacing[5], gap: Spacing[2], marginBottom: Spacing[4] },
  filterChip: { paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderRadius: BorderRadius.full, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border },
  filterChipOn: { backgroundColor: Colors.primary[500], borderColor: Colors.primary[500] },
  filterTxt: { fontSize: Typography.fontSize.xs, fontWeight: '600', color: Colors.dark.textSecondary },
  filterTxtOn: { color: '#fff' },
  category: { marginBottom: Spacing[5] },
  categoryHeader: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.dark.textSecondary, marginBottom: Spacing[2], textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', paddingTop: Spacing[16], gap: Spacing[3] },
  emptyEmoji: { fontSize: 56 },
  emptyTxt: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.dark.text },
  emptySub: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  emptyBtnTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  addForm: { gap: Spacing[3], marginTop: Spacing[4] },
  addInput: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[4], fontSize: Typography.fontSize.sm, color: Colors.dark.text, borderWidth: 1.5, borderColor: Colors.primary[500] },
  addConfirmBtn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.lg, padding: Spacing[3], alignItems: 'center' },
  addConfirmTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  addCancelTxt: { textAlign: 'center', color: Colors.dark.textSecondary, fontSize: Typography.fontSize.sm, paddingVertical: Spacing[2] },
  addBtn: { marginTop: Spacing[4], borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.dark.border, borderRadius: BorderRadius.lg, padding: Spacing[4], alignItems: 'center' },
  addBtnTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, fontWeight: '600' },
})
