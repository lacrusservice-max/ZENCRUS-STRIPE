/**
 * NUTRICIÓN · ZENCRUS
 * ═══════════════════
 * Lectura del día en cuatro planos, de lo general a lo accionable:
 *
 *   1. ESTADO      — cuánto queda, si vas dentro de meta, cómo van los macros
 *   2. COMIDAS     — presupuesto adaptativo por comida y lo que ya registraste
 *   3. ZENA        — la única lectura interpretada, no un dato más
 *   4. HERRAMIENTAS— accesos secundarios, al final porque no son la tarea
 *
 * El registro de alimentos no vive aquí: lo resuelve `FoodConsole`, que es una
 * consola de dos etapas con su propia máquina de estados.
 */

import { aFechaLocal } from '@/utils/fechas'
import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { useNutritionStore, MealSlot } from '@/store/nutritionStore'
import { useBodyMeasurementsStore } from '@/store/bodyMeasurementsStore'
import { suggestCalorieAdjustment, Goal } from '@/utils/calorieAdjustment'
import api from '@/services/api'
import { PlateRing } from '@/components/ui/PlateRing'
import { AnilloMacro } from '@/components/nutrition/AnilloMacro'
import {
  limitesDe, tramoDe, COLOR_TRAMO, ETIQUETA_TRAMO, frase as fraseDelDia, aviso as avisoDelDia,
} from '@/utils/tramoCalorico'
import { CountUp } from '@/components/ui/CountUp'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { Colors } from '@/constants/theme'
import { TabBar } from '@/constants/layout'
import { computeMealBudgets, describeMealStatus, buildCoachNote, MealBudget } from '@/utils/mealBudget'
import { FoodConsole } from '@/components/nutrition/FoodConsole'
import { FondoPlato } from '@/components/nutrition/FondoPlato'
import { emojiForFood } from '@/data/foodEmoji'

const NEON = Colors.neon

const TOOLS: { icon: ZIconName; label: string; note: string; route: string | null }[] = [
  { icon: 'codex',  label: 'Recetas',      note: 'Qué cocinar hoy',       route: '/recipes' },
  { icon: 'layers', label: 'Plan semanal', note: 'Organiza la semana',    route: '/meal-planner' },
  { icon: 'stack',  label: 'Compras',      note: 'Lista de la despensa',  route: '/grocery' },
  { icon: 'gauge',  label: 'Medidas',      note: 'Peso y composición',    route: '/measurements' },
]

/** Icono del momento del día. Sustituye a los emojis, que rompían la línea gráfica. */
function mealIcon(id: string): ZIconName {
  if (id.startsWith('snack')) return 'bolt'
  if (id === 'breakfast') return 'dawn'
  if (id === 'lunch') return 'zenith'
  return 'dusk'
}

export default function NutritionScreen() {
  const router = useRouter()
  const { user, setUser, refrescarPerfil } = useAuthStore()
  const {
    meals, totalCalories, totalProtein, totalCarbs, totalFat,
    loadToday, addEntries, removeEntry, toggleEntryActive,
  } = useNutritionStore()

  const goals = (user as any)?.goals ?? {}

  /**
   * Piso, meta y techo salen todos de `limitesDe`.
   *
   * Antes el piso se derivaba aquí y el techo sencillamente NO EXISTÍA: la
   * pantalla solo sabía «meta» y «te pasaste de la meta», que son cosas
   * distintas. Pasarse doscientas kcal de la meta un día de entreno no es
   * pasarse; pasarse seiscientas sí. Sin techo no había forma de decirlo.
   */
  const limites = limitesDe(goals)
  const caloriesTarget = limites.meta
  const caloriesFloor  = limites.minimo
  const proteinTarget  = goals.protein_g ?? 150
  const carbsTarget    = goals.carbs_g ?? 200
  const fatTarget      = goals.fat_g ?? 65
  const visibleMeals   = meals.slice(0, goals.meals_per_day ?? 3)

  const { measurements, load: loadMeasurements } = useBodyMeasurementsStore()
  const [dismissedAdjustment, setDismissedAdjustment] = useState(false)
  const [applyingAdjustment, setApplyingAdjustment] = useState(false)
  /* El aviso se cierra para la sesión, no para siempre: mañana el día es otro
     y el consejo vuelve a valer. */
  const [avisoCerrado, setAvisoCerrado] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [consoleMeal, setConsoleMeal] = useState<string | null>(null)

  /**
   * Se recarga cada vez que se entra, no solo al montar.
   *
   * Con `useEffect` la pantalla se cargaba una vez y se quedaba así mientras la
   * app siguiera viva: si ZENA apuntaba una comida desde el chat, había que
   * cerrar la app entera para verla. Volver a la pestaña no bastaba, porque el
   * componente no se había desmontado.
   *
   * `useFocusEffect` es lo que la despierta al volver — y el diario es lo
   * primero que uno mira después de apuntar algo.
   */
  useFocusEffect(useCallback(() => {
    loadToday()
    /**
     * Y también el perfil, no solo las comidas.
     *
     * Las metas se cambian desde tres sitios —Ajustes, el ajuste semanal y ZENA
     * en el chat— y solo el primero deja la pantalla delante. Sin esto, cambiar
     * la meta hablando con ZENA y volver aquí seguía enseñando la vieja: el
     * plato en verde con una meta que ya no era la tuya.
     */
    void refrescarPerfil()
  }, []))
  useEffect(() => { loadMeasurements() }, [])

  // ── Ajuste calórico semanal ─────────────────────────────────────────────
  const MAIN_GOAL_TO_GOAL: Record<string, Goal> = {
    lose_fat: 'perder_grasa', gain_muscle: 'ganar_musculo', maintain: 'mantener',
  }
  const goal = MAIN_GOAL_TO_GOAL[goals.main_goal] ?? 'mantener'
  const weighIns = measurements
    .filter(m => typeof m.weight === 'number')
    .map(m => ({ date: m.date, weightKg: m.weight! }))
  const adjustment = suggestCalorieAdjustment(weighIns, goal, caloriesTarget)
  const showAdjustment = adjustment.shouldAdjust && !dismissedAdjustment

  const applyAdjustment = async () => {
    setApplyingAdjustment(true)
    try {
      const { data: res } = await api.put('/users/profile', {
        goals: { ...goals, calories_target: caloriesTarget + adjustment.deltaKcal },
      })
      if (res?.data) setUser(res.data)
      setDismissedAdjustment(true)
    } catch {
      Alert.alert('No se pudo aplicar', 'Revisa tu conexión o cámbialo desde Perfil.')
    } finally {
      setApplyingAdjustment(false)
    }
  }

  // ── Presupuesto por comida ──────────────────────────────────────────────
  const budgets = computeMealBudgets(
    visibleMeals.map(m => ({
      id: m.id,
      label: m.label,
      consumed: Math.round(m.entries.reduce((a, e) => a + (e.active === false ? 0 : e.calories), 0)),
      entryCount: m.entries.filter(e => e.active !== false).length,
    })),
    caloriesTarget,
  )
  const budgetById = Object.fromEntries(budgets.map(b => [b.id, b]))

  const tramo = tramoDe(totalCalories, limites)
  const colorTramo = COLOR_TRAMO[tramo]

  const coachNote = buildCoachNote(budgets, Math.max(0, proteinTarget - totalProtein))

  const closed = budgets.filter(b => b.status !== 'pending')
  const adherence = closed.length
    ? Math.round(closed.reduce((a, b) => (
        b.budget <= 0 ? a + 100 : a + Math.max(0, 100 - (Math.abs(b.delta) / b.budget) * 100)
      ), 0) / closed.length)
    : 100

  const nextPending = budgets.find(b => b.status === 'pending')
  const nextMeal = nextPending ? visibleMeals.find(m => m.id === nextPending.id) : undefined

  const openConsole = (mealId: string) => {
    setConsoleMeal(mealId)
    setConsoleOpen(true)
  }

  return (
    <View style={s.root}>
      <FondoPlato />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: TabBar.scrollInset + 20 }}
        >
          {/* ── Cabecera ── */}
          <View style={s.head}>
            <View style={s.kickRow}>
              <View style={s.kickDot} />
              <Text style={s.kick}>ZENCRUS · NUTRICIÓN</Text>
            </View>
            <Text style={s.h1}>Tu plato</Text>
            <Text style={s.h1}>de <Text style={s.h1Accent}>hoy</Text></Text>
          </View>

          {/* ── Semana ── */}
          <View style={s.week}>
            {weekStrip().map(d => (
              <View key={d.iso} style={[s.day, d.isToday && s.dayOn]}>
                <Text style={[s.dayNum, d.isToday && s.dayNumOn]}>{d.day}</Text>
                <Text style={[s.dayLbl, d.isToday && s.dayLblOn]}>{d.short}</Text>
              </View>
            ))}
          </View>

          {/* ── Estado del día ── */}
          <View style={s.plate}>
            <PlateRing size={238} consumed={totalCalories} limites={limites} />
            <View style={s.plateCenter} pointerEvents="none">
              {/*
                LO CONSUMIDO, SUBIENDO. No lo que queda, bajando.

                El arco crece con lo que comes; con la cuenta atrás, el número
                bajaba mientras el arco subía y los dos contaban historias
                opuestas. Además «1,240» dice exactamente dónde estás, y «760
                restantes» obliga a restar mentalmente para saberlo.

                Lo que falta no se pierde: lo dicen la frase de abajo y el aviso,
                que es donde se lee como una frase y no como un número suelto.
              */}
              <CountUp value={totalCalories} style={s.plateNum} />
              <Text style={s.plateLbl}>
                DE {limites.meta.toLocaleString('es-MX')} · TECHO {limites.techo.toLocaleString('es-MX')}
              </Text>
              {/* La pastilla dice el tramo con palabras: el color solo no basta
                  para quien no distingue verde de ámbar. */}
              <View style={[s.plateChip, { borderColor: colorTramo }]}>
                <Text style={[s.plateChipTxt, { color: colorTramo }]}>{ETIQUETA_TRAMO[tramo]}</Text>
              </View>
            </View>
          </View>

          {/* La línea que NO se cierra: dice cómo vas, en una sola frase. */}
          <View style={s.animo}>
            <View style={[s.animoDot, { backgroundColor: colorTramo }]} />
            <Text style={s.animoTxt}>{fraseDelDia(totalCalories, limites)}</Text>
          </View>

          {/*
            AQUÍ SOLO LA ADHERENCIA.

            Había un tercer veredicto —«te pasaste de la meta», «vas dentro»— con
            su propia aritmética, y discrepaba de las otras dos piezas: con 2.098
            kcal y el techo en 2.400, el plato decía EN LA META y la frase «vas
            excelente» mientras esta línea decía «te pasaste de la meta». Las
            tres miraban el mismo día y solo esta usaba la meta como si fuera el
            techo.

            No se ha migrado a `tramoCalorico`: se ha QUITADO. Ya lo dicen la
            pastilla del plato y la frase, y un tercer texto repitiéndolo es
            justo el ruido que sobra en esta pantalla. La adherencia se queda
            porque es lo único que no está en ninguna otra parte.
          */}
          <View style={s.verdict}>
            <View style={[s.verdictDot, { backgroundColor: colorTramo }]} />
            <Text style={s.verdictTxt}>
              {totalCalories === 0 ? 'Sin registrar aún' : 'Reparto entre comidas'}
            </Text>
            <Text style={s.verdictPct}>
              <Text style={s.verdictPctB}>{adherence} %</Text> adherencia
            </Text>
          </View>

          {/*
            EL AVISO, QUE SE PUEDE CERRAR.

            Antes eran dos bloques distintos —uno para pasarse, otro para el
            piso— y solo cubrían dos de los cuatro tramos: quien iba en la meta
            o acababa de cruzar el mínimo no leía nada. Ahora es uno que cambia
            de texto, y con su ×: el consejo largo verlo cada vez que abres
            cansa, y saturaba justamente la pantalla que hay que poder mirar de
            un vistazo. La frase de arriba se queda; esta tarjeta no.
          */}
          {!avisoCerrado && (() => {
            const av = avisoDelDia(totalCalories, limites)
            return (
              <View style={[s.aviso, {
                borderColor: colorTramo + '6B',
                backgroundColor: colorTramo + '1F',
              }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.avisoTitulo, { color: colorTramo }]}>{av.titulo}</Text>
                  <Text style={s.avisoCuerpo}>{av.cuerpo}</Text>
                </View>
                <TouchableOpacity
                  style={s.avisoCerrar}
                  onPress={() => setAvisoCerrado(true)}
                  hitSlop={10}
                  accessibilityLabel="Cerrar el aviso"
                >
                  <Text style={s.avisoCerrarTxt}>×</Text>
                </TouchableOpacity>
              </View>
            )
          })()}

          <View style={s.macros}>
            <AnilloMacro nombre="Proteína" valor={totalProtein} meta={proteinTarget} />
            <AnilloMacro nombre="Carbos"   valor={totalCarbs}   meta={carbsTarget} />
            <AnilloMacro nombre="Grasas"   valor={totalFat}     meta={fatTarget} />
          </View>

          {/* ── Ajuste sugerido ── */}
          {showAdjustment && (
            <View style={s.adjust}>
              <View style={s.adjustHead}>
                <ZIcon name="target" size={16} color={NEON.white} weight={1.7} />
                <Text style={s.adjustTitle}>Ajuste sugerido esta semana</Text>
              </View>
              <Text style={s.adjustReason}>{adjustment.reason}</Text>
              <View style={s.adjustActions}>
                <TouchableOpacity
                  style={s.adjustSkip}
                  onPress={() => setDismissedAdjustment(true)}
                  activeOpacity={0.75}
                >
                  <Text style={s.adjustSkipTxt}>Ignorar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.adjustApply}
                  onPress={applyAdjustment}
                  disabled={applyingAdjustment}
                  activeOpacity={0.85}
                >
                  {applyingAdjustment
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <Text style={s.adjustApplyTxt}>
                        {adjustment.deltaKcal > 0 ? '+' : ''}{adjustment.deltaKcal} kcal · Aplicar
                      </Text>
                    )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Comidas ── */}
          <Section title="Comidas" note="Presupuesto adaptativo" />

          {visibleMeals.map(meal => (
            <MealCard
              key={meal.id}
              meal={meal}
              budget={budgetById[meal.id]}
              onAdd={() => openConsole(meal.id)}
              onRemove={id => removeEntry(meal.id, id)}
              onToggle={id => toggleEntryActive(meal.id, id)}
            />
          ))}

          {nextMeal && (
            <TouchableOpacity style={s.cta} onPress={() => openConsole(nextMeal.id)} activeOpacity={0.86}>
              <ZIcon name="plus" size={17} color="#fff" weight={2.2} />
              <Text style={s.ctaTxt}>Registrar {nextMeal.label.toLowerCase()}</Text>
            </TouchableOpacity>
          )}

          {/* ── ZENA ── */}
          {coachNote && (
            <View style={s.zena}>
              <View style={s.zenaMark}>
                <ZIcon name="spark" size={14} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.zenaName}>ZENA</Text>
                <Text style={s.zenaTxt}>{coachNote}</Text>
              </View>
            </View>
          )}

          {/* ── Herramientas ── */}
          <Section title="Herramientas" />
          <View style={s.tools}>
            {TOOLS.map(tool => (
              <TouchableOpacity
                key={tool.label}
                style={s.tool}
                onPress={() => tool.route && router.push(tool.route as any)}
                activeOpacity={0.78}
              >
                <View style={s.toolIcon}>
                  <ZIcon name={tool.icon} size={18} color={NEON.white} weight={1.6} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.toolLabel}>{tool.label}</Text>
                  <Text style={s.toolNote} numberOfLines={1}>{tool.note}</Text>
                </View>
                <ZIcon name="chevronRight" size={14} color={NEON.w3} weight={1.9} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Difuminado bajo la barra flotante: el contenido se desvanece en vez de
          quedar cortado por la píldora. */}
      <LinearGradient
        colors={['rgba(5,5,6,0)', 'rgba(5,5,6,0.92)', '#050506']}
        style={s.scrim}
        pointerEvents="none"
      />

      {consoleMeal && (
        <FoodConsole
          visible={consoleOpen}
          meals={visibleMeals}
          budgetById={budgetById}
          initialMealId={consoleMeal}
          dailyConsumed={totalCalories}
          dailyTarget={caloriesTarget}
          onClose={() => setConsoleOpen(false)}
          onCommit={addEntries}
        />
      )}
    </View>
  )
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function Section({ title, note }: { title: string; note?: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title.toUpperCase()}</Text>
      {!!note && <Text style={s.sectionNote}>{note}</Text>}
    </View>
  )
}


function MealCard({ meal, budget, onAdd, onRemove, onToggle }: {
  meal: MealSlot
  budget?: MealBudget
  onAdd: () => void
  onRemove: (entryId: string) => void
  onToggle: (entryId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const active = meal.entries.filter(e => e.active !== false)
  const kcal = Math.round(active.reduce((a, e) => a + e.calories, 0))
  const empty = meal.entries.length === 0
  const over = budget?.status === 'over'
  const status = budget ? describeMealStatus(budget) : null

  return (
    <View style={[s.meal, empty && s.mealEmpty]}>
      <TouchableOpacity
        style={s.mealTop}
        onPress={() => (empty ? onAdd() : setOpen(v => !v))}
        activeOpacity={0.82}
      >
        <View style={[s.mealMark, empty && s.mealMarkEmpty]}>
          <ZIcon
            name={empty ? 'plus' : mealIcon(meal.id)}
            size={17}
            color={empty ? NEON.red : NEON.white}
            weight={empty ? 2.2 : 1.7}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.mealName}>{meal.label}</Text>
          <Text style={s.mealSub} numberOfLines={1}>
            {active.length === 0
              ? (empty ? 'Sin registrar' : 'Todo desactivado')
              : active.map(e => e.name.split('(')[0].trim()).join(' · ')}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.mealKcal, empty && { color: NEON.w3 }]}>{kcal}</Text>
          {!!budget && <Text style={s.mealBudget}>de {budget.budget}</Text>}
        </View>

        {!empty && (
          <ZIcon name={open ? 'chevronUp' : 'chevronDown'} size={14} color={NEON.w3} weight={1.9} />
        )}
      </TouchableOpacity>

      <View style={s.track}>
        <View
          style={[
            s.fill,
            {
              width: `${Math.round((budget?.fill ?? 0) * 100)}%` as any,
              backgroundColor: over ? NEON.red : NEON.white,
            },
          ]}
        />
      </View>

      {!!status && (
        <View style={s.statusRow}>
          <View style={[s.statusDot, over && { backgroundColor: NEON.red }]} />
          <Text style={[s.statusTxt, over && { color: NEON.redSoft }]}>{status}</Text>
        </View>
      )}

      {open && !empty && (
        <View style={s.entries}>
          {meal.entries.map(e => {
            const on = e.active !== false
            return (
              <View key={e.id} style={[s.entry, !on && s.entryOff]}>
                <TouchableOpacity
                  onPress={() => onToggle(e.id)}
                  hitSlop={8}
                  style={[s.check, on && s.checkOn]}
                >
                  {on && <ZIcon name="check" size={10} color="#fff" weight={3} />}
                </TouchableOpacity>
                {/* Las entradas antiguas no traen emoji guardado, así que se
                    deduce del nombre para que ninguna fila quede sin icono. */}
                <Text style={[s.entryEmoji, !on && s.entryEmojiOff]}>
                  {e.emoji ?? emojiForFood(e.name)}
                </Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[s.entryName, !on && s.strike]} numberOfLines={1}>{e.name}</Text>
                  <Text style={s.entryMacros}>
                    {e.amount} {e.unit} · P {Math.round(e.protein)} · C {Math.round(e.carbs)} · G {Math.round(e.fat)}
                  </Text>
                </View>
                <Text style={[s.entryKcal, !on && s.strike]}>{Math.round(e.calories)}</Text>
                <TouchableOpacity onPress={() => onRemove(e.id)} hitSlop={8}>
                  <ZIcon name="close" size={13} color={NEON.w3} weight={2} />
                </TouchableOpacity>
              </View>
            )
          })}

          <TouchableOpacity style={s.entryAdd} onPress={onAdd} activeOpacity={0.8}>
            <ZIcon name="plus" size={12} color={NEON.red} weight={2.2} />
            <Text style={s.entryAddTxt}>Añadir a {meal.label.toLowerCase()}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function weekStrip() {
  const SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
  const today = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (5 - i))
    return {
      iso: aFechaLocal(d),
      day: d.getDate(),
      short: SHORT[d.getDay()],
      isToday: i === 5,
    }
  })
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEON.void },

  // Cabecera
  head: { paddingHorizontal: 20, paddingTop: 6 },
  kickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  kickDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: NEON.red },
  kick: { fontSize: 9.5, fontWeight: '800', letterSpacing: 2.6, color: NEON.red },
  h1: { fontSize: 34, fontWeight: '800', color: NEON.white, letterSpacing: -1.2, lineHeight: 37 },
  h1Accent: { color: NEON.red },

  // Semana
  week: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginTop: 20 },
  day: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 13,
    backgroundColor: NEON.pane,
  },
  dayOn: { backgroundColor: 'rgba(255,31,61,0.16)' },
  dayNum: { fontSize: 13.5, fontWeight: '800', color: NEON.w2, fontVariant: ['tabular-nums'] },
  dayNumOn: { color: NEON.white },
  dayLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: NEON.w3, marginTop: 3 },
  dayLblOn: { color: NEON.redSoft },

  // Estado
  plate: { alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  /* El texto va CENTRADO en el arco, no colgado del borde superior.
     Con `top: 34%` la cifra flotaba alta y descuadrada respecto al aro; el
     centro del SVG y el del texto son el mismo punto, así que basta centrar. */
  plateCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  /* 46, no 58: a 58 la cifra de cuatro dígitos se salía del aro por los lados
     y el medidor dejaba de leerse como una pieza. */
  plateNum: {
    fontSize: 46, fontWeight: '800', color: NEON.white,
    letterSpacing: -2.4, lineHeight: 48, fontVariant: ['tabular-nums'],
  },
  plateLbl: { fontSize: 7.5, fontWeight: '800', letterSpacing: 1.1, color: NEON.w3, marginTop: 7 },

  plateChip: {
    marginTop: 9, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
  },
  plateChipTxt: { fontSize: 8, fontWeight: '800', letterSpacing: 1.3 },

  /* La frase que se queda. Una línea, sin caja: si llevara fondo y borde
     competiría con el aviso de debajo y volvería a saturar. */
  animo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    paddingHorizontal: 20, marginTop: 14,
  },
  animoDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  animoTxt: { flex: 1, fontSize: 12, lineHeight: 17, color: NEON.w2 },

  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginHorizontal: 20, marginTop: 14,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  avisoTitulo: { fontSize: 12.5, fontWeight: '800' },
  avisoCuerpo: { fontSize: 11.5, lineHeight: 16, color: NEON.w2, marginTop: 2 },
  avisoCerrar: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  avisoCerrarTxt: { fontSize: 15, lineHeight: 17, color: NEON.w2, fontWeight: '600' },

  // Leyenda de límites del anillo

  // Avisos de límite

  verdict: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: 20, marginTop: 22, height: 46, paddingHorizontal: 16,
    borderRadius: 14, backgroundColor: NEON.paneHi,
  },
  verdictDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: NEON.white },
  verdictTxt: { fontSize: 12.5, fontWeight: '700', color: NEON.white },
  verdictPct: { marginLeft: 'auto', fontSize: 11, fontWeight: '700', color: NEON.w2 },
  verdictPctB: { color: NEON.white, fontWeight: '800' },

  macros: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 14 },
  macro: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 11,
    borderRadius: 14, backgroundColor: NEON.pane,
    borderWidth: StyleSheet.hairlineWidth, borderColor: NEON.edge,
  },
  macroTop: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between', marginBottom: 7,
  },
  macroVal: { fontSize: 12.5, fontWeight: '800', color: NEON.white, fontVariant: ['tabular-nums'] },
  macroTarget: { fontSize: 9, color: NEON.w3, fontWeight: '600' },
  macroLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.3, color: NEON.w3 },
  macroTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden' },
  macroFill: { height: '100%', borderRadius: 2 },

  // Ajuste
  adjust: {
    marginHorizontal: 20, marginTop: 22, padding: 16,
    borderRadius: 18, backgroundColor: NEON.pane,
    borderWidth: StyleSheet.hairlineWidth, borderColor: NEON.edge,
  },
  adjustHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  adjustTitle: { fontSize: 13, fontWeight: '800', color: NEON.white },
  adjustReason: { fontSize: 12.5, color: NEON.w2, lineHeight: 19, marginBottom: 14 },
  adjustActions: { flexDirection: 'row', gap: 9 },
  adjustSkip: {
    flex: 1, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  adjustSkipTxt: { fontSize: 12.5, fontWeight: '700', color: NEON.w2 },
  adjustApply: {
    flex: 2, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: NEON.red,
  },
  adjustApplyTxt: { fontSize: 12.5, fontWeight: '800', color: '#fff' },

  // Secciones
  section: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 20, marginTop: 30, marginBottom: 13,
  },
  sectionTitle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 2.4, color: NEON.w3 },
  sectionNote: { fontSize: 10, fontWeight: '700', color: NEON.w3 },

  // Comida
  meal: {
    marginHorizontal: 20, marginBottom: 9, padding: 14,
    borderRadius: 18, backgroundColor: NEON.pane,
  },
  mealEmpty: { backgroundColor: 'rgba(255,31,61,0.06)' },
  mealTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealMark: {
    width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  mealMarkEmpty: { backgroundColor: 'rgba(255,31,61,0.13)' },
  mealName: { fontSize: 13.5, fontWeight: '700', color: NEON.white, letterSpacing: -0.2 },
  mealSub: { fontSize: 11, color: NEON.w3, marginTop: 3 },
  mealKcal: { fontSize: 15, fontWeight: '800', color: NEON.white, fontVariant: ['tabular-nums'] },
  mealBudget: { fontSize: 9.5, color: NEON.w3, marginTop: 2, fontVariant: ['tabular-nums'] },

  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 13, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  statusDot: { width: 4.5, height: 4.5, borderRadius: 3, backgroundColor: NEON.w2 },
  statusTxt: { fontSize: 10, fontWeight: '700', color: NEON.w2 },

  entries: {
    marginTop: 13, paddingTop: 12, gap: 11,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: NEON.edge,
  },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryOff: { opacity: 0.42 },
  check: {
    width: 19, height: 19, borderRadius: 6,
    borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.26)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: NEON.red, borderColor: NEON.red },
  strike: { textDecorationLine: 'line-through' },
  entryEmoji: { fontSize: 16, width: 22, textAlign: 'center' },
  entryEmojiOff: { opacity: 0.4 },
  entryName: { fontSize: 12.5, color: NEON.white, fontWeight: '600' },
  entryMacros: { fontSize: 10, color: NEON.w3, marginTop: 2, fontVariant: ['tabular-nums'] },
  entryKcal: { fontSize: 12.5, fontWeight: '800', color: NEON.w2, fontVariant: ['tabular-nums'] },
  entryAdd: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  entryAddTxt: { fontSize: 11.5, fontWeight: '700', color: NEON.red },

  // Acción principal
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    marginHorizontal: 20, marginTop: 12, height: 54, borderRadius: 16,
    backgroundColor: NEON.red,
  },
  ctaTxt: { fontSize: 14.5, fontWeight: '800', color: '#fff' },

  // ZENA
  zena: {
    flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 22, padding: 15,
    borderRadius: 18, backgroundColor: 'rgba(255,31,61,0.09)',
  },
  zenaMark: {
    width: 28, height: 28, borderRadius: 9, backgroundColor: NEON.red,
    alignItems: 'center', justifyContent: 'center',
  },
  zenaName: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6, color: NEON.redSoft, marginBottom: 4 },
  zenaTxt: { fontSize: 12.5, lineHeight: 19, color: 'rgba(255,225,230,0.92)' },

  // Herramientas
  tools: { paddingHorizontal: 20, gap: 8 },
  tool: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    height: 62, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: NEON.pane,
  },
  toolIcon: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  toolLabel: { fontSize: 13, fontWeight: '700', color: NEON.white },
  toolNote: { fontSize: 10.5, color: NEON.w3, marginTop: 2 },

  // Difuminado inferior
  scrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: TabBar.scrollInset,
  },
})
