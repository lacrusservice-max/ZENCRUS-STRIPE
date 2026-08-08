/**
 * PANEL · RECETAS
 * ═══════════════
 *
 * El recetario completo, dentro de la consola de captura. No es pestaña de la
 * barra inferior a propósito: Recetas se usa en el momento de decidir qué
 * comer, y ese momento es «añadir a una comida». Separarlo en su propia
 * pestaña lo alejaría de su único punto de uso.
 *
 * Cuatro vistas con su navegación propia:
 *
 *   HOY        qué cocinar ahora, ordenado por lo que cabe en esta comida
 *   RECETARIO  el catálogo completo, ordenado por uso
 *   LOTE       repeticiones del plan semanal y lista de compra
 *   COMUNIDAD  recetas de otras personas
 *
 * Al tocar una receta se abre su ficha dentro del mismo panel —composición,
 * raciones, ingredientes con sustituciones— sin salir de la consola ni perder
 * la bandeja que se lleva acumulada.
 *
 * ── Por qué «Hoy» va primero ────────────────────────────────────────────────
 * Un catálogo obliga a elegir entre veinte opciones sin criterio. «Hoy» ordena
 * por lo que de verdad cabe en el día —kcal libres y macros pendientes— y
 * escribe la razón, para que elegir cueste un vistazo y no una comparación.
 */

import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import Animated, { FadeInDown, FadeIn, LinearTransition } from 'react-native-reanimated'
import { router } from 'expo-router'
import { useRecipesStore, Recipe } from '@/store/recipesStore'
import { useNutritionStore } from '@/store/nutritionStore'
import { useMealPlanStore, DAYS, DAY_LABELS } from '@/store/mealPlanStore'
import { useAuthStore } from '@/store/authStore'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { RecipePhoto } from '@/components/recipes/RecipePhoto'
import { photoFor, RECIPE_CREDITS } from '@/data/recipePhotos'
import { scoreFit, missingIngredients, DayRemaining } from '@/utils/recipeFit'
import { scaleIngredients } from '@/utils/realMeasures'
import { Colors, Typography } from '@/constants/theme'
import { FoodEntry } from '@/store/nutritionStore'
import { Panel } from '../parts'

const N = Colors.neon

type Tab = 'hoy' | 'recetario' | 'lote' | 'comunidad'
const TABS: { id: Tab; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'recetario', label: 'Recetario' },
  { id: 'lote', label: 'Lote' },
  { id: 'comunidad', label: 'Comunidad' },
]

/** Minutos totales de una receta: preparación más cocción. */
const totalMin = (r: Recipe) => (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0)

interface RecipePanelProps {
  /** Kcal ya consumidas en la comida a la que se está registrando. */
  consumed: number
  /** Presupuesto de esa comida. */
  budget: number
  onCommit: (entry: FoodEntry) => void
}

export function RecipePanel({ consumed, budget, onCommit }: RecipePanelProps) {
  const [tab, setTab] = useState<Tab>('hoy')
  /** Ficha abierta dentro del panel. La consola ya es un modal: apilar otra
      pantalla encima deja en iOS un controlador huérfano y la app se queda
      en negro, así que la ficha es una vista más de este mismo panel. */
  const [openId, setOpenId] = useState<string | null>(null)
  const { recipes, pantry, getMostCooked, load } = useRecipesStore()
  const { totalCalories, totalProtein, totalCarbs, totalFat, loadToday } = useNutritionStore()
  const { weekPlan, load: loadPlan } = useMealPlanStore()
  const user = useAuthStore(s => s.user)

  useEffect(() => { load(); loadToday(); loadPlan() }, [])

  const goals = (user as any)?.goals ?? {}
  // El encaje se mide contra el presupuesto de esta comida cuando lo hay: aquí
  // no se decide «qué como hoy» sino «qué pongo en el desayuno».
  const left: DayRemaining = {
    kcal: budget > 0
      ? Math.max(0, budget - consumed)
      : Math.max(0, (goals.calories_target ?? 2000) - totalCalories),
    protein: Math.max(0, (goals.protein_g ?? 150) - totalProtein),
    carbs: Math.max(0, (goals.carbs_g ?? 200) - totalCarbs),
    fat: Math.max(0, (goals.fat_g ?? 65) - totalFat),
  }

  /** Recetas puntuadas por encaje con lo que queda del día. */
  const ranked = useMemo(() => (
    recipes
      .map(r => ({
        recipe: r,
        fit: scoreFit(r.nutrition, left),
        missing: missingIngredients(r.ingredients, pantry),
      }))
      .sort((a, b) => b.fit.score - a.fit.score)
  ), [recipes, left.kcal, left.protein, pantry])

  // «Rápidas» excluye la receta del héroe y las que ya salen en «También
  // encajan»: repetir la misma tarjeta tres veces en una pantalla la vacía de
  // significado.
  const quick = useMemo(() => {
    const shown = new Set(ranked.slice(0, 5).map(x => x.recipe.id))
    return recipes.filter(r => totalMin(r) <= 10 && !shown.has(r.id)).slice(0, 4)
  }, [recipes, ranked])

  /** Recetas que el plan repite esta semana: candidatas a cocinar en lote. */
  const repeats = useMemo(() => {
    const count = new Map<string, { name: string; days: string[] }>()
    DAYS.forEach(day => {
      const slots = weekPlan[day] ?? {}
      Object.values(slots).forEach(meals => {
        (meals ?? []).forEach(m => {
          const key = m.name.toLowerCase()
          const hit = count.get(key) ?? { name: m.name, days: [] }
          if (!hit.days.includes(day)) hit.days.push(day)
          count.set(key, hit)
        })
      })
    })
    return Array.from(count.values()).filter(x => x.days.length > 1)
  }, [weekPlan])

  const opened = openId ? recipes.find(r => r.id === openId) : undefined
  if (opened) {
    return (
      <Panel>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <Detail recipe={opened} onBack={() => setOpenId(null)} onCommit={onCommit} />
        </ScrollView>
      </Panel>
    )
  }

  return (
    <Panel>
      <View style={s.nav}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.navItem, tab === t.id && s.navItemOn]}
            onPress={() => setTab(t.id)}
            activeOpacity={0.8}
          >
            <Text style={[s.navTxt, tab === t.id && s.navTxtOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* `key` fuerza el remontaje al cambiar de pestaña para que las
            entradas vuelvan a dispararse. */}
        <Animated.View key={tab} entering={FadeIn.duration(240)} layout={LinearTransition}>
        {tab === 'hoy' && <Today ranked={ranked} quick={quick} left={left} onOpen={setOpenId} />}
        {tab === 'recetario' && <Catalog list={getMostCooked()} pantry={pantry} onOpen={setOpenId} />}
        {tab === 'lote' && <Batch repeats={repeats} recipes={recipes} onOpen={setOpenId} />}
        {tab === 'comunidad' && <Community recipes={recipes} />}
        </Animated.View>
      </ScrollView>
    </Panel>
  )
}


// ── FICHA DENTRO DEL PANEL ────────────────────────────────────────────────────

/**
 * La receta abierta, sin salir de la consola.
 *
 * Secciones colapsables en vez de subpantallas: comparar la composición con las
 * raciones obligaba a ir y volver recordando cifras. Aquí se abren y cierran
 * sobre el mismo sitio.
 */
function Detail({ recipe, onBack, onCommit }: {
  recipe: Recipe
  onBack: () => void
  onCommit: (entry: FoodEntry) => void
}) {
  const [open, setOpen] = useState<string | null>('composicion')
  const [servings, setServings] = useState(recipe.variation?.servings ?? 1)
  const n = recipe.nutrition
  const kcal = Math.round(n.calories * servings)
  const scaled = scaleIngredients(recipe.ingredients, recipe.servings, servings)

  const kp = n.protein * 4, kc = n.carbs * 4, kf = n.fat * 9
  const sum = Math.max(kp + kc + kf, 1)
  const pct = (v: number) => Math.round((v / sum) * 100)

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <RecipePhoto
        source={photoFor(recipe.id, recipe.userPhotoUri, 'detail')}
        credit={RECIPE_CREDITS[recipe.id]}
        emoji={recipe.emoji}
        height={186}
        radius={0}
        priority
        steam={recipe.cookTimeMin > 0}
      >
        <TouchableOpacity style={s.dBack} onPress={onBack} hitSlop={10} activeOpacity={0.8}>
          <ZIcon name="chevronLeft" size={16} color={N.white} weight={2.2} />
        </TouchableOpacity>
        <View style={s.dCap}>
          <Text style={s.dTitle} numberOfLines={2}>{recipe.title}</Text>
          <Text style={s.dMeta}>
            {totalMin(recipe)} min · {recipe.ingredients.length} ingr. · {Math.round(n.calories)} kcal
          </Text>
        </View>
      </RecipePhoto>

      <View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
        <Acc
          icon="target" title="Composición" sub="De dónde salen sus kcal"
          value={String(kcal)}
          open={open === 'composicion'}
          onPress={() => setOpen(open === 'composicion' ? null : 'composicion')}
        >
          <View style={s.splitBar}>
            <View style={[s.splitSeg, { flex: Math.max(kp, 1), backgroundColor: N.white }]} />
            <View style={[s.splitSeg, { flex: Math.max(kc, 1), backgroundColor: N.red }]} />
            <View style={[s.splitSeg, { flex: Math.max(kf, 1), backgroundColor: N.steelSoft }]} />
          </View>
          <View style={s.splitLeg}>
            <Text style={s.splitTxt}>Prot {pct(kp)} %</Text>
            <Text style={s.splitTxt}>Carb {pct(kc)} %</Text>
            <Text style={s.splitTxt}>Grasa {pct(kf)} %</Text>
          </View>
          <View style={s.quad}>
            <Quad v={kcal} l="kcal" />
            <Quad v={`${Math.round(n.protein * servings)} g`} l="prot" />
            <Quad v={`${Math.round(n.carbs * servings)} g`} l="carb" />
            <Quad v={`${Math.round(n.fat * servings)} g`} l="grasa" />
          </View>
        </Acc>

        <Acc
          icon="layers" title="Raciones" sub="Medidas cocinables"
          value={String(servings)}
          open={open === 'raciones'}
          onPress={() => setOpen(open === 'raciones' ? null : 'raciones')}
        >
          <View style={s.seg}>
            {[0.5, 1, 1.5, 2].map(v => {
              const on = Math.abs(v - servings) < 0.01
              return (
                <TouchableOpacity
                  key={v}
                  style={[s.segItem, on && s.segItemOn]}
                  onPress={() => setServings(v)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.segTxt, on && s.segTxtOn]}>
                    {v === 0.5 ? '½' : v === 1.5 ? '1½' : v}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <View style={s.realBox}>
            <Text style={s.realLbl}>REDONDEADO A MEDIDAS COMPRABLES</Text>
            {scaled.map((ing, i) => (
              <View key={i} style={s.realRow}>
                <Text style={s.realName} numberOfLines={1}>{ing.name}</Text>
                <Text style={s.realVal}>
                  {ing.real.label} {ing.real.unit}
                  {ing.real.exact !== undefined && (
                    <Text style={s.realExact}> · no {ing.real.exact}</Text>
                  )}
                </Text>
              </View>
            ))}
          </View>
        </Acc>

        <Acc
          icon="stack" title="Ingredientes" sub="Lo que lleva"
          value={String(recipe.ingredients.length)}
          open={open === 'ingredientes'}
          onPress={() => setOpen(open === 'ingredientes' ? null : 'ingredientes')}
        >
          {scaled.map((ing, i) => (
            <View key={i} style={s.ingRow}>
              <Text style={s.ingName} numberOfLines={1}>{ing.name}</Text>
              <Text style={s.ingQty}>{ing.real.label} {ing.real.unit}</Text>
              <Text style={s.ingKcal}>{Math.round(ing.calories * servings)}</Text>
            </View>
          ))}
        </Acc>

        <Acc
          icon="clock" title="Pasos" sub={`${recipe.steps.length} pasos · ${totalMin(recipe)} min`}
          value={String(recipe.steps.length)}
          open={open === 'pasos'}
          onPress={() => setOpen(open === 'pasos' ? null : 'pasos')}
        >
          {recipe.steps.map((st, i) => (
            <View key={i} style={s.stepRow}>
              <View style={s.stepN}><Text style={s.stepNTxt}>{i + 1}</Text></View>
              <Text style={s.stepTxt}>{st}</Text>
            </View>
          ))}
        </Acc>

        <TouchableOpacity
          style={s.addBtn}
          activeOpacity={0.88}
          onPress={() => onCommit({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            name: recipe.title,
            calories: kcal,
            protein: n.protein * servings,
            carbs: n.carbs * servings,
            fat: n.fat * servings,
            fiber: 0,
            amount: servings,
            unit: 'ración',
            active: true,
            emoji: recipe.emoji,
          })}
        >
          <ZIcon name="check" size={15} color="#fff" weight={2.2} />
          <Text style={s.addTxt}>AÑADIR A LA BANDEJA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.cookBtn}
          activeOpacity={0.85}
          onPress={() => router.push({
            pathname: '/recipe/cook',
            params: { id: recipe.id, servings: String(servings) },
          } as any)}
        >
          <ZIcon name="flame" size={14} color={N.red} weight={2} />
          <Text style={s.cookTxt}>COCINARLA AHORA</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

function Acc({ icon, title, sub, value, open, onPress, children }: {
  icon: ZIconName; title: string; sub: string; value?: string
  open: boolean; onPress: () => void; children: React.ReactNode
}) {
  return (
    <Animated.View layout={LinearTransition.duration(200)} style={[s.acc, open && s.accOn]}>
      <TouchableOpacity style={s.accHead} onPress={onPress} activeOpacity={0.85}>
        <View style={[s.accMark, open && s.accMarkOn]}>
          <ZIcon name={icon} size={13} color={open ? N.red : N.w3} weight={1.8} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.accTitle}>{title}</Text>
          <Text style={s.accSub} numberOfLines={1}>{sub}</Text>
        </View>
        {!!value && <Text style={s.accVal}>{value}</Text>}
        <ZIcon name={open ? 'chevronUp' : 'chevronDown'} size={13} color={N.w3} weight={2} />
      </TouchableOpacity>
      {open && <View style={s.accBody}>{children}</View>}
    </Animated.View>
  )
}

function Quad({ v, l }: { v: string | number; l: string }) {
  return (
    <View style={s.quadItem}>
      <Text style={s.quadV}>{v}</Text>
      <Text style={s.quadL}>{l.toUpperCase()}</Text>
    </View>
  )
}

// ── HOY ───────────────────────────────────────────────────────────────────────

function Today({ ranked, quick, left, onOpen }: {
  onOpen: (id: string) => void
  ranked: { recipe: Recipe; fit: ReturnType<typeof scoreFit>; missing: string[] }[]
  quick: Recipe[]
  left: DayRemaining
}) {
  const best = ranked[0]
  if (!best) return <Blank note="Aún no tienes recetas guardadas." />

  return (
    <View>
      {/* Entradas escalonadas: el héroe primero y las tarjetas detrás, con
          40 ms de separación. Aparecer todo a la vez se lee como un salto. */}
      <Animated.View entering={FadeInDown.duration(420).springify().damping(18)}>
      <TouchableOpacity
        style={s.today}
        onPress={() => onOpen(best.recipe.id)}
        activeOpacity={0.9}
      >
        <RecipePhoto
          source={photoFor(best.recipe.id, best.recipe.userPhotoUri, 'hero')}
          credit={RECIPE_CREDITS[best.recipe.id]}
          emoji={best.recipe.emoji}
          height={218}
          radius={20}
          priority
          steam={best.recipe.cookTimeMin > 0}
        >
          <View style={s.todayCap}>
            <View style={s.todayPin}>
              <ZIcon name="target" size={10} color="#fff" weight={2.2} />
              <Text style={s.todayPinTxt}>ENCAJA HOY</Text>
            </View>
            <Text style={s.todayTitle}>{best.recipe.title}</Text>
            <Text style={s.todayWhy}>{best.fit.reason}.</Text>
            <View style={s.chips}>
              <View style={[s.chip, s.chipTime]}>
                <ZIcon name="clock" size={11} color={N.void} weight={2.2} />
                <Text style={s.chipTimeTxt}>{totalMin(best.recipe)} min</Text>
              </View>
              <View style={s.chip}>
                <ZIcon name="flame" size={11} color={N.w2} weight={2} />
                <Text style={s.chipTxt}>{Math.round(best.recipe.nutrition.calories)} kcal</Text>
              </View>
              <View style={s.chip}>
                <ZIcon name="layers" size={11} color={N.w2} weight={2} />
                <Text style={s.chipTxt}>{best.recipe.ingredients.length} ingr.</Text>
              </View>
            </View>
          </View>
        </RecipePhoto>
      </TouchableOpacity>
      </Animated.View>

      {/* Si faltan *todos* los ingredientes, lo que pasa es que la despensa
          está sin configurar, no que falte algo puntual. Avisar ahí es ruido:
          el aviso solo aparece cuando de verdad falta poco. */}
      {best.missing.length > 0 && best.missing.length < best.recipe.ingredients.length && (
        <View style={s.missing}>
          <View style={s.missingIc}>
            <ZIcon name="warning" size={14} color={N.red} weight={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.missingTitle}>
              Te {best.missing.length === 1 ? 'falta 1 ingrediente' : `faltan ${best.missing.length} ingredientes`}
            </Text>
            <Text style={s.missingSub} numberOfLines={1}>
              No tienes {best.missing.slice(0, 2).join(', ').toLowerCase()}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/grocery')} hitSlop={8}>
            <Text style={s.missingGo}>AÑADIR</Text>
          </TouchableOpacity>
        </View>
      )}

      <Section title="También encajan" note={`${Math.round(left.kcal)} kcal libres`} />
      <View style={s.grid}>
        {ranked.slice(1, 5).map((x, i) => (
          <Card
            key={x.recipe.id}
            index={i}
            onOpen={onOpen}
            recipe={x.recipe}
            missing={x.missing.length < x.recipe.ingredients.length ? x.missing.length : 0}
          />
        ))}
      </View>

      {quick.length > 0 && (
        <>
          <Section title="Rápidas" note="10 min o menos" />
          <View style={s.grid}>
            {quick.map((r, i) => <Card key={r.id} index={i} onOpen={onOpen} recipe={r} missing={0} />)}
          </View>
        </>
      )}
    </View>
  )
}

// ── RECETARIO ─────────────────────────────────────────────────────────────────

function Catalog({ list, pantry, onOpen }: {
  list: Recipe[]; pantry: string[]; onOpen: (id: string) => void
}) {
  if (!list.length) return <Blank note="Aún no tienes recetas guardadas." />
  return (
    <View style={s.grid}>
      {list.map((r, i) => {
        const miss = missingIngredients(r.ingredients, pantry).length
        return (
          <Card
            key={r.id}
            index={i}
            onOpen={onOpen}
            recipe={r}
            missing={miss < r.ingredients.length ? miss : 0}
            sub={r.cookCount ? `Cocinada ${r.cookCount} ${r.cookCount === 1 ? 'vez' : 'veces'}` : undefined}
          />
        )
      })}
    </View>
  )
}

// ── LOTE ──────────────────────────────────────────────────────────────────────

function Batch({ repeats, recipes, onOpen }: {
  onOpen: (id: string) => void
  repeats: { name: string; days: string[] }[]
  recipes: Recipe[]
}) {
  if (!repeats.length) {
    return (
      <Blank note="Cuando el plan semanal repita una receta, aparecerá aquí para cocinarla en lote." />
    )
  }
  return (
    <View>
      <Section title="Repetido en tu plan" note="Cocínalo de una vez" />
      {repeats.map(rep => {
        const recipe = recipes.find(r => r.title.toLowerCase() === rep.name.toLowerCase())
        const mins = recipe ? totalMin(recipe) : 0
        return (
          <View key={rep.name} style={s.batchCard}>
            <View style={s.batchHead}>
              <View style={s.batchMark}>
                <ZIcon name="layers" size={14} color={N.red} weight={1.8} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.batchTitle} numberOfLines={1}>{rep.name}</Text>
                <Text style={s.batchSub}>
                  {rep.days.map(d => DAY_LABELS[d as keyof typeof DAY_LABELS]).join(' · ')}
                </Text>
              </View>
              <Text style={s.batchCount}>{rep.days.length}×</Text>
            </View>
            <View style={s.propose}>
              <ZIcon name="spark" size={13} color={N.red} weight={2} />
              <Text style={s.proposeTxt}>
                Cocina <Text style={s.proposeB}>{rep.days.length} raciones juntas</Text>
                {mins > 0 && ` y ahorra ${mins * (rep.days.length - 1)} minutos`}.
              </Text>
            </View>
            {recipe && (
              <TouchableOpacity
                style={s.batchBtn}
                onPress={() => onOpen(recipe.id)}
                activeOpacity={0.85}
              >
                <Text style={s.batchBtnTxt}>PREPARAR {rep.days.length} RACIONES</Text>
              </TouchableOpacity>
            )}
          </View>
        )
      })}

      <TouchableOpacity style={s.listBtn} onPress={() => router.push('/grocery')} activeOpacity={0.85}>
        <ZIcon name="stack" size={15} color="#fff" weight={2} />
        <Text style={s.listBtnTxt}>GENERAR LISTA DE COMPRA</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── COMUNIDAD ─────────────────────────────────────────────────────────────────

function Community({ recipes }: { recipes: Recipe[] }) {
  const shared = recipes.filter(r => r.isPublic)
  if (!shared.length) {
    return <Blank note="Todavía no hay recetas compartidas por la comunidad." />
  }
  return (
    <View>
      {shared.map(r => (
        <View key={r.id} style={s.commCard}>
          <View style={s.commUser}>
            <View style={s.avatar}>
              <Text style={s.avatarTxt}>
                {(r.authorName ?? 'ZC').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.commName}>{r.authorName ?? 'Comunidad ZENCRUS'}</Text>
              <Text style={s.commMeta}>
                {r.cookCount ? `Cocinada ${r.cookCount} veces` : 'Nueva en la comunidad'}
              </Text>
            </View>
            <TouchableOpacity style={s.saveBtn} activeOpacity={0.85}>
              <Text style={s.saveTxt}>GUARDAR</Text>
            </TouchableOpacity>
          </View>
          <RecipePhoto
            source={photoFor(r.id, r.userPhotoUri)}
            emoji={r.emoji}
            height={150}
            radius={12}
            scrim={false}
          />
          <Text style={s.commTitle}>{r.title}</Text>
          <Text style={s.commStats}>
            {totalMin(r)} min · {Math.round(r.nutrition.calories)} kcal · P{Math.round(r.nutrition.protein)} C{Math.round(r.nutrition.carbs)} G{Math.round(r.nutrition.fat)}
          </Text>
        </View>
      ))}
    </View>
  )
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function Card({ recipe, missing, sub, index = 0, onOpen }: {
  recipe: Recipe; missing: number; sub?: string; index?: number
  onOpen: (id: string) => void
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(380).springify().damping(18)}
      style={{ width: '47.6%' }}
    >
    <TouchableOpacity
      style={s.card}
      onPress={() => onOpen(recipe.id)}
      activeOpacity={0.88}
    >
      <RecipePhoto
        source={photoFor(recipe.id, recipe.userPhotoUri, 'card')}
        emoji={recipe.emoji}
        height={112}
        radius={14}
        steam={recipe.cookTimeMin > 0}
      >
        {/* El tiempo va en blanco sólido: al decidir qué cocinar pesa tanto
            como las kilocalorías, y antes quedaba enterrado en el subtítulo. */}
        <View style={s.cardTime}>
          <ZIcon name="clock" size={9} color={N.void} weight={2.4} />
          <Text style={s.cardTimeTxt}>{totalMin(recipe)} min</Text>
        </View>
        <View style={s.cardKcal}>
          <Text style={s.cardKcalTxt}>{Math.round(recipe.nutrition.calories)}</Text>
        </View>
        {missing > 0 && (
          <View style={s.cardMiss}>
            <Text style={s.cardMissTxt}>FALTA {missing}</Text>
          </View>
        )}
      </RecipePhoto>
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={2}>{recipe.title}</Text>
        <Text style={s.cardSub} numberOfLines={1}>
          {sub ?? `P${Math.round(recipe.nutrition.protein)} · C${Math.round(recipe.nutrition.carbs)} · G${Math.round(recipe.nutrition.fat)}`}
        </Text>
      </View>
    </TouchableOpacity>
    </Animated.View>
  )
}

function Section({ title, note }: { title: string; note?: string }) {
  return (
    <View style={s.sec}>
      <Text style={s.secTitle}>{title}</Text>
      {!!note && <Text style={s.secNote}>{note}</Text>}
    </View>
  )
}

function Blank({ note }: { note: string }) {
  return (
    <View style={s.blank}>
      <ZIcon name="codex" size={30} color={N.w4} weight={1.6} />
      <Text style={s.blankTxt}>{note}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  // ── Ficha dentro del panel ──
  dBack: {
    position: 'absolute', top: 12, left: 14,
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  dCap: { position: 'absolute', left: 18, right: 18, bottom: 12 },
  dTitle: {
    fontFamily: Typography.fontFamily.display,
    fontSize: 21, fontWeight: '800', color: N.white, letterSpacing: -0.2, marginBottom: 4,
  },
  dMeta: { fontSize: 11, color: 'rgba(255,255,255,0.68)' },

  acc: {
    borderRadius: 14, marginBottom: 8, overflow: 'hidden',
    backgroundColor: N.pane, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  accOn: { borderColor: 'rgba(255,31,61,0.28)' },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  accMark: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.paneHi, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  accMarkOn: { backgroundColor: N.redDim, borderColor: 'rgba(255,31,61,0.28)' },
  accTitle: {
    fontFamily: Typography.fontFamily.display,
    fontSize: 12, fontWeight: '800', letterSpacing: 1, color: N.white, textTransform: 'uppercase',
  },
  accSub: { fontSize: 10.5, color: N.w3, marginTop: 1 },
  accVal: { fontFamily: Typography.fontFamily.display, fontSize: 13, fontWeight: '800', color: N.white },
  accBody: { paddingHorizontal: 12, paddingBottom: 12 },

  splitBar: { flexDirection: 'row', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden' },
  splitSeg: { height: '100%' },
  splitLeg: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, marginBottom: 10 },
  splitTxt: { fontSize: 10, color: N.w3 },

  quad: { flexDirection: 'row', gap: 5 },
  quadItem: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.32)', alignItems: 'center' },
  quadV: { fontFamily: Typography.fontFamily.display, fontSize: 13, fontWeight: '800', color: N.white },
  quadL: { fontFamily: Typography.fontFamily.display, fontSize: 7.5, fontWeight: '700', letterSpacing: 1, color: N.w3, marginTop: 2 },

  seg: {
    flexDirection: 'row', gap: 4, padding: 3, marginBottom: 10,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  segItem: { flex: 1, paddingVertical: 7, borderRadius: 999, alignItems: 'center' },
  segItemOn: { backgroundColor: N.white },
  segTxt: { fontFamily: Typography.fontFamily.display, fontSize: 12, fontWeight: '800', color: N.w3 },
  segTxtOn: { color: N.void },

  realBox: {
    padding: 11, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1, borderColor: N.edge, borderStyle: 'dashed',
  },
  realLbl: { fontFamily: Typography.fontFamily.display, fontSize: 8, fontWeight: '800', letterSpacing: 1.6, color: N.w3, marginBottom: 8 },
  realRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  realName: { flex: 1, minWidth: 0, fontSize: 11.5, color: N.w2 },
  realVal: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', color: N.white },
  realExact: { fontSize: 9.5, fontWeight: '600', color: N.w3 },

  ingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  ingName: { flex: 1, minWidth: 0, fontSize: 12, color: N.white },
  ingQty: { fontSize: 10.5, color: N.w3 },
  ingKcal: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', color: N.white, width: 38, textAlign: 'right' },

  stepRow: { flexDirection: 'row', gap: 10, paddingVertical: 7 },
  stepN: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: N.paneHi },
  stepNTxt: { fontFamily: Typography.fontFamily.display, fontSize: 10.5, fontWeight: '800', color: N.w2 },
  stepTxt: { flex: 1, fontSize: 11.5, lineHeight: 17, color: N.w2 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    marginTop: 6, paddingVertical: 15, borderRadius: 16, backgroundColor: N.red,
  },
  addTxt: { fontFamily: Typography.fontFamily.display, fontSize: 12.5, fontWeight: '800', letterSpacing: 1.4, color: '#fff' },
  cookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8, paddingVertical: 13, borderRadius: 14,
    backgroundColor: N.redDim, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  cookTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, color: N.red },

  head: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  kick: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  kickDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: N.red },
  kickTxt: { fontFamily: Typography.fontFamily.display, fontSize: 9.5, fontWeight: '800', letterSpacing: 2.5, color: N.w3 },
  h1: { fontFamily: Typography.fontFamily.display, fontSize: 30, fontWeight: '800', color: N.white, letterSpacing: -1, lineHeight: 33 },
  h1Accent: { color: N.red, textTransform: 'capitalize' },

  nav: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 14 },
  navItem: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: N.pane, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  navItemOn: { backgroundColor: N.white, borderColor: N.white },
  navTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11, fontWeight: '800', letterSpacing: 1, color: N.w3, textTransform: 'uppercase' },
  navTxtOn: { color: N.void },

  today: { marginHorizontal: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)' },
  todayCap: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  todayPin: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: N.red, marginBottom: 8,
  },
  todayPinTxt: { fontFamily: Typography.fontFamily.display, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: '#fff' },
  todayTitle: { fontFamily: Typography.fontFamily.display, fontSize: 22, fontWeight: '800', color: N.white, letterSpacing: -0.4, marginBottom: 4 },
  todayWhy: { fontSize: 11.5, color: 'rgba(255,255,255,0.72)', lineHeight: 16 },
  chips: { flexDirection: 'row', gap: 6, marginTop: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  chipTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11, fontWeight: '800', color: N.white },
  chipTime: { backgroundColor: 'rgba(255,255,255,0.94)', borderColor: 'transparent' },
  chipTimeTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11, fontWeight: '800', color: N.void },

  missing: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginTop: 10, padding: 12, borderRadius: 14,
    backgroundColor: N.redDim, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  missingIc: {
    width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  missingTitle: { fontFamily: Typography.fontFamily.display, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: N.red, textTransform: 'uppercase' },
  missingSub: { fontSize: 11.5, color: N.w2, marginTop: 2 },
  missingGo: { fontFamily: Typography.fontFamily.display, fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: N.white },

  sec: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  secTitle: { fontFamily: Typography.fontFamily.display, flex: 1, fontSize: 11.5, fontWeight: '800', letterSpacing: 2, color: N.white, textTransform: 'uppercase' },
  secNote: { fontSize: 10.5, color: N.w3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20 },
  card: {
    width: '100%', borderRadius: 14, overflow: 'hidden',
    backgroundColor: N.pane, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  cardTime: {
    position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)',
  },
  cardTimeTxt: { fontFamily: Typography.fontFamily.display, fontSize: 9, fontWeight: '800', color: N.void },
  cardKcal: {
    position: 'absolute', top: 7, right: 7,
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.72)', borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  cardKcalTxt: { fontFamily: Typography.fontFamily.display, fontSize: 9.5, fontWeight: '800', color: N.white },
  cardMiss: {
    position: 'absolute', bottom: 7, right: 7,
    paddingVertical: 3, paddingHorizontal: 7, borderRadius: 999, backgroundColor: N.red,
  },
  cardMissTxt: { fontFamily: Typography.fontFamily.display, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, color: '#fff' },
  cardBody: { padding: 9 },
  cardTitle: { fontFamily: Typography.fontFamily.display, fontSize: 12, fontWeight: '700', color: N.white, lineHeight: 16, marginBottom: 3 },
  cardSub: { fontSize: 9.5, color: N.w3 },

  batchCard: {
    marginHorizontal: 20, marginBottom: 10, padding: 14, borderRadius: 18,
    backgroundColor: N.pane, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  batchHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 11 },
  batchMark: {
    width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.paneHi, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  batchTitle: { fontFamily: Typography.fontFamily.display, fontSize: 13, fontWeight: '800', color: N.white, letterSpacing: 0.4 },
  batchSub: { fontSize: 10.5, color: N.w3, marginTop: 2 },
  batchCount: { fontFamily: Typography.fontFamily.display, fontSize: 15, fontWeight: '800', color: N.white },
  propose: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    padding: 11, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)', borderStyle: 'dashed',
  },
  proposeTxt: { flex: 1, fontSize: 11.5, lineHeight: 17, color: N.w2 },
  proposeB: { color: N.white, fontWeight: '700' },
  batchBtn: {
    marginTop: 11, paddingVertical: 12, borderRadius: 12,
    alignItems: 'center', backgroundColor: N.red,
  },
  batchBtnTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, color: '#fff' },
  listBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 6, paddingVertical: 14, borderRadius: 14,
    backgroundColor: N.paneHi, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  listBtnTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, color: N.white },

  commCard: {
    marginHorizontal: 20, marginBottom: 12, padding: 13, borderRadius: 18,
    backgroundColor: N.pane, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  commUser: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  avatar: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.paneHi, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  avatarTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11, fontWeight: '800', color: N.w2 },
  commName: { fontSize: 12.5, fontWeight: '700', color: N.white },
  commMeta: { fontSize: 10, color: N.w3, marginTop: 1 },
  saveBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: N.redDim, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  saveTxt: { fontFamily: Typography.fontFamily.display, fontSize: 9.5, fontWeight: '800', letterSpacing: 1, color: N.red },
  commTitle: { fontFamily: Typography.fontFamily.display, fontSize: 13.5, fontWeight: '700', color: N.white, marginTop: 10, marginBottom: 3 },
  commStats: { fontSize: 10.5, color: N.w3 },

  blank: { alignItems: 'center', paddingHorizontal: 40, paddingVertical: 60, gap: 12 },
  blankTxt: { fontSize: 12.5, lineHeight: 19, color: N.w3, textAlign: 'center' },
})
