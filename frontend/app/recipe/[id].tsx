/**
 * FICHA DE RECETA · ZENCRUS
 * ═════════════════════════
 *
 * Todo lo de una receta en una sola pantalla, en secciones que se abren y
 * cierran. Navegar entre subpantallas para ver los ingredientes y volver para
 * cambiar las raciones obligaba a recordar cifras de una vista a otra; aquí se
 * comparan de un vistazo.
 *
 * Las secciones: composición, raciones con medidas cocinables, ingredientes
 * —cada uno con su detalle y sus sustituciones—, pasos, y el historial con la
 * variación que la persona repite.
 */

import { useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import Svg, { Circle } from 'react-native-svg'
import { useRecipesStore, Recipe, RecipeIngredient } from '@/store/recipesStore'
import { useNutritionStore } from '@/store/nutritionStore'
import { useAuthStore } from '@/store/authStore'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { RecipePhoto } from '@/components/recipes/RecipePhoto'
import { photoFor, RECIPE_CREDITS } from '@/data/recipePhotos'
import { Screen } from '@/components/ui/Screen'
import { scaleIngredients } from '@/utils/realMeasures'
import { Colors, Typography } from '@/constants/theme'
import { TabBar } from '@/constants/layout'

const N = Colors.neon

/**
 * Sustituciones del catálogo, por ingrediente base.
 *
 * Es una tabla corta y explícita en vez de un motor de equivalencias: proponer
 * cambios exige saber qué funciona en el plato, no solo qué se parece en
 * macros. Crece a mano, con criterio.
 */
const SWAPS: Record<string, RecipeIngredient[]> = {
  arroz: [
    { name: 'Quinoa cocida', amount: 100, unit: 'g', calories: 120, protein: 4.4, carbs: 21, fat: 1.9 },
    { name: 'Arroz integral', amount: 100, unit: 'g', calories: 112, protein: 2.6, carbs: 23, fat: 0.9 },
    { name: 'Coliflor en granos', amount: 100, unit: 'g', calories: 25, protein: 1.9, carbs: 5, fat: 0.3 },
  ],
  pasta: [
    { name: 'Pasta integral', amount: 100, unit: 'g', calories: 124, protein: 5.3, carbs: 26, fat: 0.5 },
    { name: 'Calabacín en espiral', amount: 100, unit: 'g', calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  ],
  crema: [
    { name: 'Yogur griego 0%', amount: 100, unit: 'g', calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  ],
  azúcar: [
    { name: 'Dátil molido', amount: 100, unit: 'g', calories: 282, protein: 2.5, carbs: 75, fat: 0.4 },
  ],
}

/** Busca sustituciones cuyo nombre esté contenido en el del ingrediente. */
function swapsFor(name: string): RecipeIngredient[] {
  const n = name.toLowerCase()
  const key = Object.keys(SWAPS).find(k => n.includes(k))
  return key ? SWAPS[key] : []
}

const totalMin = (r: Recipe) => (r.prepTimeMin ?? 0) + (r.cookTimeMin ?? 0)

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { recipes, saveVariation } = useRecipesStore()
  const user = useAuthStore(s => s.user)
  const recipe = recipes.find(r => r.id === id)

  const [open, setOpen] = useState<string | null>('composicion')
  const [servings, setServings] = useState(recipe?.variation?.servings ?? recipe?.servings ?? 1)
  const [openIng, setOpenIng] = useState<string | null>(null)
  /** Sustituciones elegidas en esta sesión, por nombre del ingrediente base. */
  const [swaps, setSwaps] = useState<Record<string, RecipeIngredient>>({})

  // ── Todos los hooks van ANTES del primer `return` ──────────────────────────
  //
  // Aquí había un `if (!recipe) return …` justo encima de estos tres `useMemo`,
  // y eso es un fallo de verdad aunque la pantalla pareciera funcionar: React
  // identifica los hooks por el ORDEN en que se llaman, así que en el render
  // sin receta veía cuatro y en el render con receta, siete. Al pasar de uno a
  // otro —abrir una receta recién borrada y volver, o recargar con Fast
  // Refresh— el estado de un hook aparece en otro, y salen fallos que no hay
  // manera de reproducir a mano.
  //
  // Los `useMemo` toleran ahora que no haya receta; el aviso de que no existe
  // se devuelve más abajo, cuando ya se han llamado todos.

  /** Ingredientes con las sustituciones aplicadas, antes de escalar. */
  const effective = useMemo(
    () => (recipe?.ingredients ?? []).map(ing => {
      const swap = swaps[ing.name]
      if (!swap) return ing
      // Se conserva la cantidad original: cambiar el alimento no cambia cuánto
      // lleva el plato, solo qué lleva.
      const f = ing.amount / (swap.amount || 100)
      return {
        ...swap,
        amount: ing.amount,
        calories: swap.calories * f,
        protein: swap.protein * f,
        carbs: swap.carbs * f,
        fat: swap.fat * f,
      }
    }),
    [recipe?.ingredients, swaps],
  )

  const scaled = useMemo(
    () => scaleIngredients(effective, recipe?.servings ?? 1, servings),
    [effective, recipe?.servings, servings],
  )

  const totals = useMemo(() => effective.reduce((a, i) => ({
    calories: a.calories + i.calories,
    protein: a.protein + i.protein,
    carbs: a.carbs + i.carbs,
    fat: a.fat + i.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [effective])

  if (!recipe) {
    return (
      <Screen>
        <View style={s.missing}>
          <Text style={s.missingTxt}>Esta receta ya no existe.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.missingBack}>VOLVER</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    )
  }

  const factor = recipe.servings > 0 ? servings / recipe.servings : 1

  const perServing = {
    calories: totals.calories / Math.max(recipe.servings, 1),
    protein: totals.protein / Math.max(recipe.servings, 1),
    carbs: totals.carbs / Math.max(recipe.servings, 1),
    fat: totals.fat / Math.max(recipe.servings, 1),
  }
  const base = recipe.nutrition
  const deltaKcal = Math.round(perServing.calories - base.calories)
  const deltaProt = Math.round(perServing.protein - base.protein)
  const changed = Object.keys(swaps).length > 0

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TabBar.scrollInset + 20 }}
      >
        <View style={s.heroWrap}>
          <RecipePhoto
            source={photoFor(recipe.id, recipe.userPhotoUri, 'hero')}
            credit={RECIPE_CREDITS[recipe.id]}
            emoji={recipe.emoji}
            height={210}
            radius={0}
            steam={recipe.cookTimeMin > 0}
          >
            <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={10}>
              <ZIcon name="chevronLeft" size={16} color={N.white} weight={2.2} />
            </TouchableOpacity>
            <View style={s.heroCap}>
              <Text style={s.heroTitle}>{recipe.title}</Text>
              <View style={s.heroMeta}>
                <View style={s.metaItem}>
                  <ZIcon name="clock" size={11} color={N.w2} weight={2} />
                  <Text style={s.metaTxt}>{totalMin(recipe)} min</Text>
                </View>
                <View style={s.metaItem}>
                  <ZIcon name="layers" size={11} color={N.w2} weight={2} />
                  <Text style={s.metaTxt}>{recipe.ingredients.length} ingr.</Text>
                </View>
                <View style={s.metaItem}>
                  <ZIcon name="flame" size={11} color={N.w2} weight={2} />
                  <Text style={s.metaTxt}>{Math.round(perServing.calories)} kcal</Text>
                </View>
              </View>
            </View>
          </RecipePhoto>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          {/* Composición */}
          <Acc
            icon="target" title="Composición" sub="De dónde salen sus kcal"
            value={String(Math.round(perServing.calories))}
            open={open === 'composicion'} onPress={() => setOpen(open === 'composicion' ? null : 'composicion')}
          >
            <View style={s.plate}>
              <MacroRing p={perServing.protein * 4} c={perServing.carbs * 4} f={perServing.fat * 9}
                total={Math.round(perServing.calories)} />
              <View style={s.legend}>
                <Leg tone={N.white} label="Proteína" value={perServing.protein * 4}
                  total={perServing.protein * 4 + perServing.carbs * 4 + perServing.fat * 9} />
                <Leg tone={N.red} label="Carbos" value={perServing.carbs * 4}
                  total={perServing.protein * 4 + perServing.carbs * 4 + perServing.fat * 9} />
                <Leg tone={N.steelSoft} label="Grasas" value={perServing.fat * 9}
                  total={perServing.protein * 4 + perServing.carbs * 4 + perServing.fat * 9} />
              </View>
            </View>
            {changed && (
              <View style={s.delta}>
                <Text style={s.deltaTxt}>
                  Con tus cambios: <Text style={s.deltaB}>{deltaKcal > 0 ? '+' : ''}{deltaKcal} kcal</Text>
                  {deltaProt !== 0 && <> y <Text style={s.deltaB}>{deltaProt > 0 ? '+' : ''}{deltaProt} g de proteína</Text></>} por ración.
                </Text>
              </View>
            )}
          </Acc>

          {/* Raciones */}
          <Acc
            icon="layers" title="Raciones" sub="Escala con medidas cocinables"
            value={String(servings)}
            open={open === 'raciones'} onPress={() => setOpen(open === 'raciones' ? null : 'raciones')}
          >
            <View style={s.seg}>
              {[1, 2, 4, 6].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.segItem, servings === n && s.segItemOn]}
                  onPress={() => setServings(n)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.segTxt, servings === n && s.segTxtOn]}>{n}</Text>
                </TouchableOpacity>
              ))}
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

          {/* Ingredientes */}
          <Acc
            icon="stack" title="Ingredientes" sub="Toca uno para ajustarlo o cambiarlo"
            value={String(recipe.ingredients.length)}
            open={open === 'ingredientes'} onPress={() => setOpen(open === 'ingredientes' ? null : 'ingredientes')}
          >
            {recipe.ingredients.map((ing, i) => {
              const eff = effective[i]
              const sc = scaled[i]
              const options = swapsFor(ing.name)
              const isOpen = openIng === ing.name
              const share = totals.calories > 0 ? eff.calories / totals.calories : 0
              return (
                <View key={ing.name + i} style={[s.ing, isOpen && s.ingOn]}>
                  <TouchableOpacity
                    style={s.ingHead}
                    onPress={() => setOpenIng(isOpen ? null : ing.name)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.ingName} numberOfLines={1}>{eff.name}</Text>
                    <Text style={s.ingQty}>{sc.real.label} {sc.real.unit}</Text>
                    <Text style={s.ingKcal}>{Math.round(eff.calories * factor)}</Text>
                    <ZIcon name={isOpen ? 'chevronUp' : 'chevronDown'} size={11} color={N.w3} weight={2} />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={s.ingBody}>
                      <View style={s.quad}>
                        <Quad v={Math.round(eff.calories * factor)} l="kcal" />
                        <Quad v={`${Math.round(eff.protein * factor)} g`} l="prot" />
                        <Quad v={`${Math.round(eff.carbs * factor)} g`} l="carb" />
                        <Quad v={`${Math.round(eff.fat * factor)} g`} l="grasa" />
                      </View>

                      <View style={s.contrib}>
                        <View style={s.contribTop}>
                          <Text style={s.contribLbl}>Aporta a la receta</Text>
                          <Text style={s.contribVal}>{Math.round(share * 100)} % de sus kcal</Text>
                        </View>
                        <View style={s.contribTrack}>
                          <View style={[s.contribFill, { width: `${Math.round(share * 100)}%` }]} />
                        </View>
                      </View>

                      {options.length > 0 ? (
                        <>
                          <Text style={s.swapLbl}>SUSTITUCIONES</Text>
                          {options.map(opt => {
                            const on = swaps[ing.name]?.name === opt.name
                            const f = ing.amount / (opt.amount || 100)
                            const dK = Math.round(opt.calories * f - ing.calories)
                            const dP = Math.round(opt.protein * f - ing.protein)
                            return (
                              <TouchableOpacity
                                key={opt.name}
                                style={[s.opt, on && s.optOn]}
                                activeOpacity={0.85}
                                onPress={() => setSwaps(prev => {
                                  const next = { ...prev }
                                  if (on) delete next[ing.name]
                                  else next[ing.name] = opt
                                  return next
                                })}
                              >
                                <Text style={s.optName} numberOfLines={1}>{opt.name}</Text>
                                {dP !== 0 && (
                                  <Text style={[s.dv, dP > 0 ? s.dvUp : s.dvDn]}>
                                    {dP > 0 ? '+' : ''}{dP} g P
                                  </Text>
                                )}
                                {dK !== 0 && (
                                  <Text style={[s.dv, dK < 0 ? s.dvDn : s.dvUp]}>
                                    {dK > 0 ? '+' : ''}{dK} kcal
                                  </Text>
                                )}
                              </TouchableOpacity>
                            )
                          })}
                        </>
                      ) : (
                        <Text style={s.noSwap}>Sin sustituciones para este ingrediente.</Text>
                      )}
                    </View>
                  )}
                </View>
              )
            })}
          </Acc>

          {/* Pasos */}
          <Acc
            icon="clock" title="Pasos" sub={`${recipe.steps.length} pasos · ${totalMin(recipe)} min`}
            value={String(recipe.steps.length)}
            open={open === 'pasos'} onPress={() => setOpen(open === 'pasos' ? null : 'pasos')}
          >
            {recipe.steps.map((st, i) => (
              <View key={i} style={s.step}>
                <View style={s.stepN}><Text style={s.stepNTxt}>{i + 1}</Text></View>
                <Text style={s.stepTxt}>{st}</Text>
              </View>
            ))}
          </Acc>

          {/* Historial */}
          <Acc
            icon="gauge" title="Tu historial" sub={recipe.cookCount ? 'Con esta receta' : 'Aún no la has cocinado'}
            value={String(recipe.cookCount ?? 0)}
            open={open === 'historial'} onPress={() => setOpen(open === 'historial' ? null : 'historial')}
          >
            <View style={s.quad}>
              <Quad v={recipe.cookCount ?? 0} l="veces" />
              <Quad v={servings} l="raciones" />
              <Quad v={recipe.lastCookedAt ? daysAgo(recipe.lastCookedAt) : '—'} l="última" />
              <Quad v={recipe.difficulty} l="nivel" />
            </View>

            {changed && (
              <TouchableOpacity
                style={s.usual}
                activeOpacity={0.85}
                onPress={() => saveVariation(recipe.id, {
                  label: `${recipe.title} · tu versión`,
                  servings,
                  swaps: Object.entries(swaps).map(([from, to]) => ({ from, to })),
                })}
              >
                <ZIcon name="spark" size={14} color={N.red} weight={2} />
                <Text style={s.usualTxt}>
                  Fijar esta versión con <Text style={s.usualB}>
                    {Object.values(swaps).map(x => x.name).join(', ')}
                  </Text> como tu variación habitual.
                </Text>
              </TouchableOpacity>
            )}

            {recipe.variation && !changed && (
              <View style={s.savedVar}>
                <ZIcon name="check" size={13} color={N.white} weight={2.4} />
                <Text style={s.savedTxt}>
                  Tu versión: <Text style={s.usualB}>{recipe.variation.swaps.map(x => x.to.name).join(', ') || 'la original'}</Text>
                  {' · '}{recipe.variation.servings} raciones
                </Text>
              </View>
            )}
          </Acc>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={s.cook}
        activeOpacity={0.88}
        onPress={() => router.push({ pathname: '/recipe/cook', params: { id: recipe.id, servings: String(servings) } } as any)}
      >
        <ZIcon name="flame" size={15} color="#fff" weight={2} />
        <Text style={s.cookTxt}>EMPEZAR A COCINAR</Text>
      </TouchableOpacity>
    </Screen>
  )
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d <= 0) return 'hoy'
  return `${d}d`
}

function Acc({ icon, title, sub, value, open, onPress, children }: {
  icon: ZIconName; title: string; sub: string; value?: string
  open: boolean; onPress: () => void; children: React.ReactNode
}) {
  return (
    <View style={[s.acc, open && s.accOn]}>
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
    </View>
  )
}

function MacroRing({ p, c, f, total }: { p: number; c: number; f: number; total: number }) {
  const R = 39
  const C = 2 * Math.PI * R
  const sum = Math.max(p + c + f, 1)
  const a = (C * p) / sum
  const b = (C * c) / sum
  const d = (C * f) / sum
  return (
    <View style={s.ring}>
      <Svg width={88} height={88} viewBox="0 0 88 88" style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={44} cy={44} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={10} fill="none" />
        <Circle cx={44} cy={44} r={R} stroke={N.white} strokeWidth={10} fill="none"
          strokeDasharray={`${a} ${C - a}`} />
        <Circle cx={44} cy={44} r={R} stroke={N.red} strokeWidth={10} fill="none"
          strokeDasharray={`${b} ${C - b}`} strokeDashoffset={-a} />
        <Circle cx={44} cy={44} r={R} stroke={N.steelSoft} strokeWidth={10} fill="none"
          strokeDasharray={`${d} ${C - d}`} strokeDashoffset={-(a + b)} />
      </Svg>
      <View style={s.ringCenter} pointerEvents="none">
        <Text style={s.ringNum}>{total}</Text>
        <Text style={s.ringLbl}>KCAL</Text>
      </View>
    </View>
  )
}

function Leg({ tone, label, value, total }: { tone: string; label: string; value: number; total: number }) {
  return (
    <View style={s.leg}>
      <View style={[s.legDot, { backgroundColor: tone }]} />
      <Text style={s.legLbl}>{label}</Text>
      <Text style={s.legVal}>{total > 0 ? Math.round((value / total) * 100) : 0} %</Text>
    </View>
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

const s = StyleSheet.create({
  heroWrap: { marginBottom: 2 },
  back: {
    position: 'absolute', top: 14, left: 16,
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  heroCap: { position: 'absolute', left: 20, right: 20, bottom: 14 },
  heroTitle: { fontFamily: Typography.fontFamily.display, fontSize: 23, fontWeight: '800', color: N.white, letterSpacing: -0.5, marginBottom: 7 },
  heroMeta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaTxt: { fontSize: 11, color: N.w2, fontWeight: '600' },

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
  accTitle: { fontFamily: Typography.fontFamily.display, fontSize: 12, fontWeight: '800', letterSpacing: 1, color: N.white, textTransform: 'uppercase' },
  accSub: { fontSize: 10.5, color: N.w3, marginTop: 1 },
  accVal: { fontFamily: Typography.fontFamily.display, fontSize: 13, fontWeight: '800', color: N.white },
  accBody: { paddingHorizontal: 12, paddingBottom: 12 },

  plate: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ring: { width: 88, height: 88 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: Typography.fontFamily.display, fontSize: 18, fontWeight: '800', color: N.white },
  ringLbl: { fontFamily: Typography.fontFamily.display, fontSize: 7.5, fontWeight: '800', letterSpacing: 1.4, color: N.w3, marginTop: 2 },
  legend: { flex: 1, gap: 6 },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legLbl: { flex: 1, fontSize: 11, color: N.w3 },
  legVal: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', color: N.white },

  delta: {
    marginTop: 11, padding: 10, borderRadius: 10,
    backgroundColor: N.redDim, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  deltaTxt: { fontSize: 11.5, lineHeight: 17, color: N.w2 },
  deltaB: { fontFamily: Typography.fontFamily.display, color: N.red, fontWeight: '800' },

  seg: {
    flexDirection: 'row', gap: 4, padding: 3, marginBottom: 11,
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

  ing: {
    borderRadius: 10, marginBottom: 6, overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.26)', borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  ingOn: { borderColor: 'rgba(255,31,61,0.28)', backgroundColor: N.redDim },
  ingHead: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10 },
  ingName: { flex: 1, minWidth: 0, fontSize: 12, color: N.white },
  ingQty: { fontSize: 10.5, color: N.w3 },
  ingKcal: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', color: N.white, width: 38, textAlign: 'right' },
  ingBody: { paddingHorizontal: 10, paddingBottom: 10 },

  quad: { flexDirection: 'row', gap: 5, marginBottom: 9 },
  quadItem: { flex: 1, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center' },
  quadV: { fontFamily: Typography.fontFamily.display, fontSize: 12.5, fontWeight: '800', color: N.white },
  quadL: { fontFamily: Typography.fontFamily.display, fontSize: 7.5, fontWeight: '700', letterSpacing: 1, color: N.w3, marginTop: 2 },

  contrib: { marginBottom: 9 },
  contribTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  contribLbl: { fontSize: 10.5, color: N.w3 },
  contribVal: { fontFamily: Typography.fontFamily.display, fontSize: 10.5, fontWeight: '800', color: N.white },
  contribTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  contribFill: { height: '100%', borderRadius: 2, backgroundColor: N.w2 },

  swapLbl: { fontFamily: Typography.fontFamily.display, fontSize: 8, fontWeight: '800', letterSpacing: 1.6, color: N.w3, marginBottom: 6 },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 9, borderRadius: 8, marginBottom: 5,
    backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: N.edge,
  },
  optOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: 'rgba(255,31,61,0.12)' },
  optName: { flex: 1, minWidth: 0, fontSize: 11.5, color: N.w2 },
  dv: { fontFamily: Typography.fontFamily.display, fontSize: 9.5, fontWeight: '800', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 999, overflow: 'hidden' },
  dvUp: { backgroundColor: 'rgba(255,255,255,0.11)', color: N.white },
  dvDn: { backgroundColor: N.redDim, color: N.red },
  noSwap: { fontSize: 10.5, color: N.w3, fontStyle: 'italic' },

  step: { flexDirection: 'row', gap: 10, paddingVertical: 7 },
  stepN: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.paneHi,
  },
  stepNTxt: { fontFamily: Typography.fontFamily.display, fontSize: 10.5, fontWeight: '800', color: N.w2 },
  stepTxt: { flex: 1, fontSize: 11.5, lineHeight: 17, color: N.w2 },

  usual: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginTop: 10,
    padding: 11, borderRadius: 10,
    backgroundColor: N.redDim, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  usualTxt: { flex: 1, fontSize: 11.5, lineHeight: 17, color: N.w2 },
  usualB: { color: N.white, fontWeight: '700' },
  savedVar: {
    flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 10,
    padding: 11, borderRadius: 10, backgroundColor: N.paneHi,
    borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  savedTxt: { flex: 1, fontSize: 11.5, lineHeight: 17, color: N.w2 },

  cook: {
    position: 'absolute', left: 20, right: 20, bottom: TabBar.scrollInset - 40,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    paddingVertical: 15, borderRadius: 16, backgroundColor: N.red,
    shadowColor: N.red, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  cookTxt: { fontFamily: Typography.fontFamily.display, fontSize: 12.5, fontWeight: '800', letterSpacing: 1.4, color: '#fff' },

  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  missingTxt: { fontSize: 13, color: N.w3 },
  missingBack: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, color: N.red },
})
