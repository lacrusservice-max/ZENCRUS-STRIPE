/**
 * RECETARIO · ZENCRUS
 * ═══════════════════
 *
 * La puerta a las recetas. Existía, se borró en el commit 87663c6 y nadie
 * quitó los enlaces: la tarjeta «Recetas» de Nutrición, el atajo de Progreso,
 * la fila de Perfil y la guía llevaban los cuatro a `/recipes`, que ya no
 * resolvía. Cuatro caminos a una pantalla de «Unmatched route».
 *
 * El recetario en sí nunca se fue —`recipesStore` sigue con sus recetas, sus
 * favoritas y su historial de cocinado, y `/recipe/[id]` sigue montando la
 * ficha—; lo que faltaba era el índice.
 *
 * ── Lo que se filtra antes que nada ─────────────────────────────────────────
 * Los alérgenos. `getFiltered` del store NO los mira —eso lo hace `getSafe`, y
 * son dos funciones distintas— así que aquí se cruzan las dos: primero lo que
 * la persona puede comer, y sobre eso la búsqueda y la categoría. Al revés, un
 * filtro de categoría podría devolver a la pantalla algo que se acababa de
 * excluir por alérgeno.
 */

import { useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { router } from 'expo-router'
import { useRecipesStore, Recipe } from '@/store/recipesStore'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { RecipePhoto } from '@/components/recipes/RecipePhoto'
import { photoFor } from '@/data/recipePhotos'
import { Screen } from '@/components/ui/Screen'
import { elegir } from '@/utils/haptica'
import { Colors } from '@/constants/theme'
import { TabBar } from '@/constants/layout'

const N = Colors.neon

type Filtro = 'all' | Recipe['category'] | 'favoritas'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'all',       label: 'Todas' },
  { id: 'favoritas', label: 'Favoritas' },
  { id: 'desayuno',  label: 'Desayuno' },
  { id: 'almuerzo',  label: 'Almuerzo' },
  { id: 'cena',      label: 'Cena' },
  { id: 'snack',     label: 'Snack' },
  { id: 'bebida',    label: 'Bebida' },
  { id: 'postre',    label: 'Postre' },
]

const totalMin = (r: Recipe) => r.prepTimeMin + r.cookTimeMin

export default function RecipesScreen() {
  const { getSafe, getFiltered, toggleFavorite, recipes, allergens, intolerances } = useRecipesStore()
  const [query, setQuery] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('all')

  /* Se recalcula con `recipes` en las dependencias y no solo con los filtros:
     marcar una favorita cambia el store, y sin eso la estrella se quedaba
     encendida pero la pestaña «Favoritas» seguía enseñando la lista vieja. */
  const lista = useMemo(() => {
    const seguras = new Set(getSafe().map(r => r.id))
    const cat = filtro === 'all' || filtro === 'favoritas' ? 'all' : filtro
    return getFiltered(query.trim() || undefined, cat)
      .filter(r => seguras.has(r.id))
      .filter(r => filtro !== 'favoritas' || r.isFavorite)
      .sort((a, b) => (b.cookCount ?? 0) - (a.cookCount ?? 0))
  }, [query, filtro, recipes, allergens, intolerances])

  /* Cuántas quedan fuera por alérgeno. Se dice en voz alta: una lista más
     corta de lo esperado sin explicación se lee como que faltan recetas. */
  const ocultas = recipes.length - getSafe().length

  return (
    <Screen>
      <View style={s.head}>
        <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={10}>
          <ZIcon name="chevronLeft" size={16} color={N.white} weight={2.2} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.kickRow}>
            <View style={s.kickDot} />
            <Text style={s.kick}>ZENCRUS · RECETARIO</Text>
          </View>
          <Text style={s.h1}>Qué cocinar</Text>
        </View>
        <TouchableOpacity
          style={s.compras}
          onPress={() => { elegir(); router.push('/grocery' as any) }}
          hitSlop={8}
        >
          <ZIcon name="stack" size={16} color={N.white} weight={1.8} />
        </TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <ZIcon name="reticle" size={15} color={N.w3} weight={1.7} />
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Busca por nombre, ingrediente o etiqueta"
          placeholderTextColor={N.w4}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
            <ZIcon name="close" size={14} color={N.w3} weight={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* `flexGrow: 0` es obligatorio: sin él un ScrollView horizontal se
          estira hasta llenar el hueco y deforma las píldoras. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={s.chips}
      >
        {FILTROS.map(f => {
          const on = f.id === filtro
          return (
            <TouchableOpacity
              key={f.id}
              style={[s.chip, on && s.chipOn]}
              onPress={() => { elegir(); setFiltro(f.id) }}
              activeOpacity={0.8}
            >
              {f.id === 'favoritas' && (
                <ZIcon name="star" size={11} color={on ? '#0A0A0D' : N.w3} weight={2} />
              )}
              <Text style={[s.chipTxt, on && s.chipTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TabBar.scrollInset + 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.countRow}>
          <Text style={s.count}>
            {lista.length} {lista.length === 1 ? 'receta' : 'recetas'}
          </Text>
          {ocultas > 0 && (
            <Text style={s.ocultas}>
              {ocultas} fuera por {ocultas === 1 ? 'tu alérgeno' : 'tus alérgenos'}
            </Text>
          )}
        </View>

        {lista.length === 0 ? (
          <View style={s.vacio}>
            <ZIcon name="codex" size={26} color={N.w4} weight={1.5} />
            <Text style={s.vacioTitulo}>
              {query.trim() ? 'Sin resultados' : 'Nada por aquí'}
            </Text>
            <Text style={s.vacioNota}>
              {query.trim()
                ? `No hay recetas que casen con "${query.trim()}".`
                : filtro === 'favoritas'
                  ? 'Marca una receta con la estrella y aparecerá aquí.'
                  : 'No hay recetas en esta categoría.'}
            </Text>
          </View>
        ) : (
          lista.map((r, i) => (
            <Tarjeta
              key={r.id}
              receta={r}
              primera={i === 0}
              onAbrir={() => { elegir(); router.push(`/recipe/${r.id}` as any) }}
              onFavorita={() => { elegir(); toggleFavorite(r.id) }}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────

function Tarjeta({ receta, primera, onAbrir, onFavorita }: {
  receta: Recipe
  primera: boolean
  onAbrir: () => void
  onFavorita: () => void
}) {
  const kcal = Math.round(receta.nutrition.calories)

  return (
    <TouchableOpacity style={s.card} onPress={onAbrir} activeOpacity={0.88}>
      <RecipePhoto
        source={photoFor(receta.id, receta.userPhotoUri, 'card')}
        emoji={receta.emoji}
        height={148}
        radius={16}
        steam={receta.cookTimeMin > 0}
        /* Solo la primera se decodifica con prioridad: es la única que está en
           pantalla cuando se abre el recetario. */
        priority={primera}
      >
        <TouchableOpacity style={s.fav} onPress={onFavorita} hitSlop={12}>
          <ZIcon
            name="star"
            size={15}
            color={receta.isFavorite ? N.red : N.w2}
            weight={receta.isFavorite ? 2.6 : 1.9}
          />
        </TouchableOpacity>

        <View style={s.cardCap}>
          <Text style={s.cardTitle} numberOfLines={1}>{receta.title}</Text>
          <View style={s.cardMeta}>
            <Meta icon="clock" txt={`${totalMin(receta)} min`} />
            <Meta icon="layers" txt={`${receta.ingredients.length} ingr.`} />
            <Meta icon="flame" txt={`${kcal} kcal`} />
            {(receta.cookCount ?? 0) > 0 && (
              <Meta icon="undo" txt={`${receta.cookCount}×`} />
            )}
          </View>
        </View>
      </RecipePhoto>
    </TouchableOpacity>
  )
}

function Meta({ icon, txt }: { icon: ZIconName; txt: string }) {
  return (
    <View style={s.metaItem}>
      <ZIcon name={icon} size={10.5} color={N.w2} weight={2} />
      <Text style={s.metaTxt}>{txt}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  head: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12,
  },
  back: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', backgroundColor: N.pane,
  },
  compras: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', backgroundColor: N.pane,
  },
  kickRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4 },
  kickDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: N.red },
  kick: { fontSize: 9, fontWeight: '800', letterSpacing: 2.3, color: N.red },
  h1: { fontSize: 25, fontWeight: '800', color: N.white, letterSpacing: -0.9 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 44, marginHorizontal: 20, paddingHorizontal: 14,
    borderRadius: 14, backgroundColor: N.pane,
    borderWidth: 1, borderColor: N.edge,
  },
  input: { flex: 1, fontSize: 14.5, color: N.white, padding: 0 },

  chips: { paddingHorizontal: 20, paddingVertical: 13, gap: 7 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: N.pane, borderWidth: 1, borderColor: N.edge,
  },
  chipOn: { backgroundColor: N.white, borderColor: N.white },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: N.w2 },
  chipTxtOn: { color: '#0A0A0D' },

  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 11 },
  count: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, color: N.w3 },
  ocultas: { fontSize: 10, color: N.w4 },

  card: { marginBottom: 11 },
  fav: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(5,5,6,0.55)',
  },
  cardCap: { position: 'absolute', left: 13, right: 13, bottom: 11 },
  cardTitle: {
    fontSize: 16, fontWeight: '800', color: N.white, letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 6,
  },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: {
    fontSize: 10.5, color: N.w2, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 5,
  },

  vacio: { alignItems: 'center', paddingVertical: 54, gap: 9 },
  vacioTitulo: { fontSize: 14.5, fontWeight: '800', color: N.w2 },
  vacioNota: { fontSize: 12, color: N.w3, textAlign: 'center', paddingHorizontal: 40, lineHeight: 17 },
})
