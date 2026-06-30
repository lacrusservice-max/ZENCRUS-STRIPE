import { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, FlatList, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useRecipesStore, Recipe } from '@/store/recipesStore'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

type TabType = 'all' | 'favorites' | 'mine' | 'ai'
const CATEGORY_LABELS: Record<Recipe['category'] | 'all', string> = {
  all: 'Todas', desayuno: '🌅 Desayuno', almuerzo: '☀️ Almuerzo',
  cena: '🌙 Cena', snack: '🍎 Snack', bebida: '🥤 Bebida', postre: '🍮 Postre',
}
const CATS = Object.keys(CATEGORY_LABELS) as (Recipe['category'] | 'all')[]
const DIFF_COLOR: Record<Recipe['difficulty'], string> = {
  'fácil': Colors.accent.green, 'medio': Colors.accent.yellow, 'difícil': Colors.accent.red,
}

function RecipeCard({ recipe, onPress, onFavorite }: { recipe: Recipe; onPress: () => void; onFavorite: () => void }) {
  return (
    <TouchableOpacity style={rc.wrap} onPress={onPress} activeOpacity={0.8}>
      <View style={rc.emojiBox}>
        <Text style={{ fontSize: 36 }}>{recipe.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={rc.titleRow}>
          <Text style={rc.title} numberOfLines={1}>{recipe.title}</Text>
          <TouchableOpacity onPress={onFavorite} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ fontSize: 18 }}>{recipe.isFavorite ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={rc.desc} numberOfLines={2}>{recipe.description}</Text>
        <View style={rc.meta}>
          <Text style={rc.metaItem}>⏱ {recipe.prepTimeMin + recipe.cookTimeMin} min</Text>
          <Text style={rc.metaItem}>👤 {recipe.servings} porción{recipe.servings > 1 ? 'es' : ''}</Text>
          <View style={[rc.diff, { borderColor: DIFF_COLOR[recipe.difficulty] + '60', backgroundColor: DIFF_COLOR[recipe.difficulty] + '15' }]}>
            <Text style={[rc.diffTxt, { color: DIFF_COLOR[recipe.difficulty] }]}>{recipe.difficulty}</Text>
          </View>
          {recipe.isAIGenerated && <View style={rc.aiBadge}><Text style={rc.aiTxt}>IA</Text></View>}
        </View>
        <View style={rc.macros}>
          <Text style={rc.macro}>{recipe.nutrition.calories} kcal</Text>
          <Text style={rc.macro}>P: {recipe.nutrition.protein}g</Text>
          <Text style={rc.macro}>C: {recipe.nutrition.carbs}g</Text>
          <Text style={rc.macro}>G: {recipe.nutrition.fat}g</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

const rc = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: Spacing[4], padding: Spacing[4], backgroundColor: Colors.dark.surface, borderRadius: 12, marginBottom: Spacing[3], borderWidth: 1, borderColor: Colors.dark.border },
  emojiBox: { width: 64, height: 64, borderRadius: 12, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], marginBottom: Spacing[1] },
  title: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.dark.text },
  desc: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, lineHeight: 16, marginBottom: Spacing[2] },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginBottom: Spacing[2], flexWrap: 'wrap' },
  metaItem: { fontSize: 10, color: Colors.dark.textTertiary },
  diff: { borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  diffTxt: { fontSize: 9, fontWeight: '700' },
  aiBadge: { backgroundColor: Colors.primary[900], borderRadius: BorderRadius.full, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: Colors.primary[700] },
  aiTxt: { fontSize: 9, fontWeight: '700', color: Colors.primary[400] },
  macros: { flexDirection: 'row', gap: Spacing[3] },
  macro: { fontSize: 10, color: Colors.dark.textTertiary, fontWeight: '500' },
})

function RecipeDetailModal({ recipe, visible, onClose }: { recipe: Recipe | null; visible: boolean; onClose: () => void }) {
  if (!recipe) return null
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
        <View style={rd.header}>
          <TouchableOpacity onPress={onClose} style={{ padding: Spacing[2] }}>
            <Text style={rd.back}>✕</Text>
          </TouchableOpacity>
          <Text style={rd.title} numberOfLines={1}>{recipe.title}</Text>
          <View style={{ width: 36 }} />
        </View>
        <ScrollView contentContainerStyle={rd.body} showsVerticalScrollIndicator={false}>
          <View style={rd.heroEmoji}><Text style={{ fontSize: 64 }}>{recipe.emoji}</Text></View>
          <Text style={rd.name}>{recipe.title}</Text>
          <Text style={rd.desc}>{recipe.description}</Text>

          <View style={rd.metaRow}>
            <View style={rd.metaItem}><Text style={rd.metaVal}>⏱ {recipe.prepTimeMin + recipe.cookTimeMin}</Text><Text style={rd.metaLabel}>minutos</Text></View>
            <View style={rd.metaItem}><Text style={rd.metaVal}>👤 {recipe.servings}</Text><Text style={rd.metaLabel}>porción{recipe.servings > 1 ? 'es' : ''}</Text></View>
            <View style={rd.metaItem}><Text style={rd.metaVal}>{recipe.nutrition.calories}</Text><Text style={rd.metaLabel}>calorías</Text></View>
          </View>

          <View style={rd.macroRow}>
            {[
              { label: 'Proteína', value: recipe.nutrition.protein, unit: 'g', color: Colors.primary[400] },
              { label: 'Carbs', value: recipe.nutrition.carbs, unit: 'g', color: Colors.accent.yellow },
              { label: 'Grasa', value: recipe.nutrition.fat, unit: 'g', color: Colors.accent.orange },
            ].map(m => (
              <View key={m.label} style={rd.macroCard}>
                <Text style={[rd.macroVal, { color: m.color }]}>{m.value}g</Text>
                <Text style={rd.macroLabel}>{m.label}</Text>
              </View>
            ))}
          </View>

          <Text style={rd.sectionTitle}>Ingredientes</Text>
          {recipe.ingredients.map((ing, i) => (
            <View key={i} style={rd.ingRow}>
              <View style={rd.ingDot} />
              <Text style={rd.ingName}>{ing.name}</Text>
              <Text style={rd.ingAmount}>{ing.amount} {ing.unit}</Text>
              <Text style={rd.ingCal}>{ing.calories} kcal</Text>
            </View>
          ))}

          <Text style={rd.sectionTitle}>Preparación</Text>
          {recipe.steps.map((step, i) => (
            <View key={i} style={rd.stepRow}>
              <View style={rd.stepNum}><Text style={rd.stepNumTxt}>{i + 1}</Text></View>
              <Text style={rd.stepTxt}>{step}</Text>
            </View>
          ))}

          {recipe.tags.length > 0 && (
            <View style={rd.tagRow}>
              {recipe.tags.map(t => (
                <View key={t} style={rd.tag}><Text style={rd.tagTxt}>{t}</Text></View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const rd = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing[5], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  back: { fontSize: 18, color: Colors.dark.text, fontWeight: '600' },
  title: { flex: 1, fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text, textAlign: 'center' },
  body: { padding: Spacing[5] },
  heroEmoji: { alignItems: 'center', marginBottom: Spacing[4] },
  name: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.dark.text, textAlign: 'center', marginBottom: Spacing[2] },
  desc: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing[5] },
  metaRow: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[4] },
  metaItem: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: 10, padding: Spacing[4], alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  metaVal: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.dark.text },
  metaLabel: { fontSize: 10, color: Colors.dark.textTertiary, marginTop: 2 },
  macroRow: { flexDirection: 'row', gap: Spacing[3], marginBottom: Spacing[6] },
  macroCard: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: 10, padding: Spacing[4], alignItems: 'center', borderWidth: 1, borderColor: Colors.dark.border },
  macroVal: { fontSize: Typography.fontSize.lg, fontWeight: '800' },
  macroLabel: { fontSize: 10, color: Colors.dark.textTertiary, marginTop: 2 },
  sectionTitle: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[3], marginTop: Spacing[2] },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border + '60' },
  ingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary[500] },
  ingName: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.text },
  ingAmount: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '600' },
  ingCal: { fontSize: Typography.fontSize.xs, color: Colors.dark.textTertiary, width: 55, textAlign: 'right' },
  stepRow: { flexDirection: 'row', gap: Spacing[4], marginBottom: Spacing[4], alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary[500], alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: '#fff' },
  stepTxt: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.dark.text, lineHeight: 22, paddingTop: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], marginTop: Spacing[4] },
  tag: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderWidth: 1, borderColor: Colors.dark.border },
  tagTxt: { fontSize: 10, color: Colors.dark.textSecondary },
})

export default function RecipesScreen() {
  const { getFiltered, getSafe, toggleFavorite, allergens, intolerances } = useRecipesStore()
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<Recipe['category'] | 'all'>('all')
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [safeOnly, setSafeOnly] = useState(allergens.length + intolerances.length > 0)

  const base = safeOnly ? getSafe() : getFiltered(search, cat)
  const filtered = search || cat !== 'all'
    ? base.filter(r => {
        const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.tags.some(t => t.includes(search.toLowerCase()))
        const matchCat = cat === 'all' || r.category === cat
        return matchSearch && matchCat
      })
    : base

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing[2] }}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Recetas</Text>
        <Text style={s.count}>{filtered.length}</Text>
      </View>

      <View style={s.searchRow}>
        <TextInput
          style={s.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar recetas..."
          placeholderTextColor={Colors.dark.textTertiary}
        />
        {(allergens.length + intolerances.length) > 0 && (
          <TouchableOpacity
            style={[s.safeBtn, safeOnly && s.safeBtnActive]}
            onPress={() => setSafeOnly(v => !v)}
          >
            <Text style={[s.safeTxt, safeOnly && s.safeTxtActive]}>🛡️ Apto</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
        {CATS.map(c => (
          <TouchableOpacity
            key={c}
            style={[s.catChip, cat === c && s.catChipActive]}
            onPress={() => setCat(c)}
          >
            <Text style={[s.catTxt, cat === c && s.catTxtActive]}>{CATEGORY_LABELS[c]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={r => r.id}
        contentContainerStyle={{ padding: Spacing[4] }}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => setSelected(item)}
            onFavorite={() => toggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🥗</Text>
            <Text style={s.emptyTxt}>Sin recetas para este filtro</Text>
          </View>
        }
      />

      <RecipeDetailModal recipe={selected} visible={!!selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  back: { fontSize: 28, color: Colors.dark.text, marginRight: Spacing[2] },
  title: { flex: 1, fontSize: Typography.fontSize.lg, fontWeight: '800', color: Colors.dark.text },
  count: { fontSize: Typography.fontSize.sm, color: Colors.dark.textTertiary },
  searchRow: { flexDirection: 'row', gap: Spacing[3], paddingHorizontal: Spacing[4], paddingTop: Spacing[3] },
  search: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], fontSize: Typography.fontSize.sm, color: Colors.dark.text, borderWidth: 1, borderColor: Colors.dark.border },
  safeBtn: { borderRadius: BorderRadius.md, paddingHorizontal: Spacing[3], paddingVertical: Spacing[3], borderWidth: 1, borderColor: Colors.dark.border, justifyContent: 'center' },
  safeBtnActive: { backgroundColor: Colors.accent.green + '20', borderColor: Colors.accent.green + '60' },
  safeTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '600' },
  safeTxtActive: { color: Colors.accent.green },
  catRow: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], gap: Spacing[2] },
  catChip: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.surface },
  catChipActive: { backgroundColor: Colors.primary[900], borderColor: Colors.primary[500] },
  catTxt: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, fontWeight: '600' },
  catTxtActive: { color: Colors.primary[400] },
  empty: { padding: Spacing[10], alignItems: 'center' },
  emptyEmoji: { fontSize: 40, marginBottom: Spacing[3] },
  emptyTxt: { fontSize: Typography.fontSize.sm, color: Colors.dark.textTertiary },
})
