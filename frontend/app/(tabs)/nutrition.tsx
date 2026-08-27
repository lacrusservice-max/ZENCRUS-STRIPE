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

import { aFechaLocal, hoyLocal } from '@/utils/fechas'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { elegir, confirmar, logro, ojo } from '@/utils/haptica'
import { useRouter, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import {
  resumenSemana, resumenSemanaDelServidor, useNutritionStore, MealSlot, META_VASOS,
} from '@/store/nutritionStore'
import { useBodyMeasurementsStore } from '@/store/bodyMeasurementsStore'
import { suggestCalorieAdjustment, Goal } from '@/utils/calorieAdjustment'
import api from '@/services/api'
import { PlateRing } from '@/components/ui/PlateRing'
import { AnilloMacro } from '@/components/nutrition/AnilloMacro'
import {
  limitesDe, tramoDe, COLOR_TRAMO, ETIQUETA_TRAMO, fraccion, frase as fraseDelDia, aviso as avisoDelDia,
} from '@/utils/tramoCalorico'
import { CountUp } from '@/components/ui/CountUp'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { Colors } from '@/constants/theme'
import { TabBar } from '@/constants/layout'
import { computeMealBudgets, describeMealStatus, buildCoachNote, MealBudget } from '@/utils/mealBudget'
import { FoodConsole } from '@/components/nutrition/FoodConsole'
import { RachaEncendida } from '@/components/racha/RachaEncendida'
import { useRachaDelDia } from '@/hooks/useRachaDelDia'
import { FondoPlato } from '@/components/nutrition/FondoPlato'
import { emojiForFood } from '@/data/foodEmoji'
import { NotaDeFase } from '@/components/salud/ciclo/NotaDeFase'

const NEON = Colors.neon

/* «Plan semanal · Organiza la semana» salió de aquí: planificar la semana ya no
   es ir a otro sitio, es tocar un día en la tira de arriba. Dos puertas a lo
   mismo, una de ellas escondida al final de la pantalla, solo confundían.
   La ruta /meal-planner sigue en el proyecto, sin acceso desde aquí. */
/* `Href` y no `string`. La tarjeta de Recetas apuntó durante meses a una ruta
   que ya no existía —`app/recipes.tsx` se borró en el commit 87663c6— y el
   `as any` del `router.push` de abajo se comía el aviso. Con el tipo puesto,
   `typedRoutes` no deja compilar un destino que no resuelve. */
const TOOLS: { icon: ZIconName; label: string; note: string; route: Href }[] = [
  { icon: 'codex',  label: 'Recetas',      note: 'Qué cocinar hoy',       route: '/recipes' },
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
    meals, totalCalories, totalProtein, totalCarbs, totalFat, totalFiber,
    date, loadToday, addEntries, removeEntry, toggleEntryActive,
    waterGlasses, setWater,
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
  /* 28 g es el valor que ya usan Ajustes, Perfil y la bienvenida. Se repite
     aquí el mismo respaldo para que las cuatro pantallas no discrepen. */
  const fiberTarget    = goals.fiber_g ?? 28
  const visibleMeals   = meals.slice(0, goals.meals_per_day ?? 3)

  const { measurements, load: loadMeasurements } = useBodyMeasurementsStore()
  const [dismissedAdjustment, setDismissedAdjustment] = useState(false)
  const [applyingAdjustment, setApplyingAdjustment] = useState(false)
  /* El aviso se cierra para la sesión, no para siempre: mañana el día es otro
     y el consejo vuelve a valer. */
  const [avisoCerrado, setAvisoCerrado] = useState(false)
  const [consoleOpen, setConsoleOpen] = useState(false)
  /** Con qué método abrir la consola cuando la manda abrir el menú de la barra. */
  const [metodoConsola, setMetodoConsola] = useState<'buscar' | 'lista' | 'escanear' | 'recetas'>('buscar')
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
  /* Se recarga el día que se está mirando, no hoy: si estabas repasando el
     sábado y vuelves de la consola de comida, saltar a hoy te quitaría de
     delante justo lo que acabas de apuntar. Se lee del store y no de la
     variable `date` de arriba porque el callback va sin dependencias a
     propósito —se quiere en CADA foco— y con `date` dentro se quedaría mirando
     el valor del primer render. */
  /* El resumen de la semana se relee cuando cambia el día O el total de hoy:
     así, al apuntar una comida, la barrita de ese día crece sin salir de la
     pantalla. Solo al enfocar no bastaba. */
  const racha = useRachaDelDia()
  const [semana, setSemana] = useState<{ iso: string; calorias: number; registrado: boolean }[]>([])
  /* Dos pasadas: el disco pinta la tira YA, y el servidor la corrige cuando
     conteste. Sin la segunda, un día apuntado desde otro teléfono o por ZENA
     en el chat se quedaba con el trazo hueco de «sin registrar». */
  useEffect(() => {
    let vivo = true
    void resumenSemana().then(local => {
      if (!vivo) return
      setSemana(local)
      void resumenSemanaDelServidor(local).then(remoto => {
        if (vivo && remoto) setSemana(remoto)
      })
    })
    return () => { vivo = false }
  }, [date, totalCalories])

  useFocusEffect(useCallback(() => {
    loadToday(useNutritionStore.getState().date)
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

  /**
   * LO QUE HACE QUE LA APP NO SE SIENTA SECA
   * ────────────────────────────────────────
   * No es que vibren los botones: eso lo hace cualquiera. Es que el móvil te
   * conteste cuando pasa algo que te importa. Aquí el momento es cruzar la
   * meta del día —y pasarse del techo—, y llega mientras miras el número
   * subir, sin que hayas tocado nada más que «añadir».
   *
   * Se dispara solo AL CRUZAR, comparando con el tramo anterior. Si se
   * disparara mientras estás en la meta, cada alimento que apuntaras después
   * volvería a felicitarte y en dos días sería ruido. Y la primera carga no
   * cuenta: abrir la app con la meta ya hecha ayer no es un logro de ahora.
   */
  const tramoPrevio = useRef<string | null>(null)
  useEffect(() => {
    const antes = tramoPrevio.current
    tramoPrevio.current = tramo
    if (antes === null || antes === tramo) return
    if (tramo === 'meta') logro()
    else if (tramo === 'pasado') ojo()
  }, [tramo])


  const coachNote = buildCoachNote(budgets, Math.max(0, proteinTarget - totalProtein))

  /*
   * `null` cuando no hay ninguna comida cerrada, no 100.
   *
   * Con el día en blanco la fila decía «Sin registrar aún · 100 % adherencia»:
   * las dos mitades de la misma línea se contradecían, y la que mentía era la
   * buena noticia. Un cien por cien de adherencia sobre cero comidas no es un
   * dato optimista, es una división por cero disfrazada.
   */
  const closed = budgets.filter(b => b.status !== 'pending')
  const adherence = closed.length
    ? Math.round(closed.reduce((a, b) => (
        b.budget <= 0 ? a + 100 : a + Math.max(0, 100 - (Math.abs(b.delta) / b.budget) * 100)
      ), 0) / closed.length)
    : null

  const nextPending = budgets.find(b => b.status === 'pending')
  const nextMeal = nextPending ? visibleMeals.find(m => m.id === nextPending.id) : undefined

  const openConsole = (mealId: string) => {
    setConsoleMeal(mealId)
    setMetodoConsola('buscar')
    setConsoleOpen(true)
  }

  /**
   * El menú de la barra abre la consola.
   *
   * Buscar, Lista y Scanner son tres de los cuatro métodos de la consola, y
   * desde el rediseño de la barra se llega a ellos desde abajo en vez de desde
   * el riel de dentro. Llegan como `?captura=…` sobre esta misma pantalla.
   *
   * El parámetro se limpia en cuanto se usa: si se quedara puesto, volver aquí
   * desde cualquier sitio reabriría la consola sola, y eso es de las cosas que
   * más desconciertan — una ventana que aparece sin que la hayas pedido.
   */
  const { captura } = useLocalSearchParams<{ captura?: string }>()
  useEffect(() => {
    if (!captura) return
    const valido = ['buscar', 'lista', 'escanear', 'recetas'] as const
    const metodo = valido.find(v => v === captura)
    if (!metodo) return

    /* La consola necesita saber a qué comida apunta. Se usa la primera
       pendiente, que es a la que iba a ir de todas formas; si no hay ninguna,
       la primera del día. */
    const destino = nextPending?.id ?? visibleMeals[0]?.id
    if (!destino) return

    setConsoleMeal(destino)
    setMetodoConsola(metodo)
    setConsoleOpen(true)
    router.setParams({ captura: undefined })
  }, [captura])

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
            {/* Mirando el sábado, un titular que dice «hoy» es sencillamente
                falso, y encima es lo primero que se lee. */}
            <Text style={s.h1}>de <Text style={s.h1Accent}>{tituloDia(date)}</Text></Text>
          </View>

          {/* ── Semana ──
              Tocar un día lo abre aquí mismo: cambia el diario, el plato y los
              macros, y lo que se apunte se guarda en ESE día. No hay pantalla
              aparte porque no hace falta ninguna — el store ya trabajaba por
              fecha, solo que nadie podía pedirle otra. */}
          <View style={s.weekHead}>
            <Text style={s.weekTitle}>TU SEMANA</Text>
            <Text style={s.weekCount}>
              {semana.filter(d => d.registrado).length} de {semana.length || 6} días
            </Text>
          </View>
          <View style={s.week}>
            {weekStrip(date).map(d => {
              const r = semana.find(x => x.iso === d.iso)
              const tr = r?.registrado ? tramoDe(r.calorias, limites) : null
              return (
                <TouchableOpacity
                  key={d.iso}
                  style={[s.day, d.activo && s.dayOn]}
                  onPress={() => { elegir(); void loadToday(d.iso) }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dayNum, d.activo && s.dayNumOn]}>{d.day}</Text>
                  <Text style={[s.dayLbl, d.activo && s.dayLblOn]}>{d.short}</Text>
                  {/* Cómo fue ese día, con el MISMO semáforo del anillo grande.
                      Un día sin apuntar no lleva barra sino un trazo hueco: la
                      diferencia entre «comí poco» y «no lo registré» es justo lo
                      que hace que uno quiera tocarlo. */}
                  {tr ? (
                    <View style={s.dayBar}>
                      <View style={[s.dayBarFill, {
                        width: `${Math.max(8, fraccion(r!.calorias, limites) * 100)}%`,
                        backgroundColor: COLOR_TRAMO[tr],
                      }]} />
                    </View>
                  ) : (
                    <View style={s.dayVacio} />
                  )}
                  {d.esHoy && !d.activo && <View style={s.dayHoy} />}
                </TouchableOpacity>
              )
            })}
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
              {adherence === null
                ? <Text style={s.verdictPctB}>sin datos aún</Text>
                : <><Text style={s.verdictPctB}>{adherence} %</Text> adherencia</>}
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

          {/* Cuatro, no tres. La fibra se venía contando en el store, tenía
              meta en el perfil y se enseñaba por alimento en la búsqueda y en
              la revisión — pero en la pantalla del día no salía por ninguna
              parte. Era el único macro con meta que nadie podía comprobar. */}
          <View style={s.macros}>
            <AnilloMacro nombre="Proteína" valor={totalProtein} meta={proteinTarget} />
            <AnilloMacro nombre="Carbos"   valor={totalCarbs}   meta={carbsTarget} />
            <AnilloMacro nombre="Grasas"   valor={totalFat}     meta={fatTarget} />
            <AnilloMacro nombre="Fibra"    valor={totalFiber}   meta={fiberTarget} />
          </View>

          <Agua vasos={waterGlasses} onFijar={setWater} />

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

          {/* ── El ciclo, si lo hay ──
              Va antes de las comidas y no al final: en fase lútea el hambre
              sube de verdad, y esa explicación solo sirve si se lee ANTES de
              mirar lo que ya se comió. Después es una excusa; antes, contexto.
              El componente se esconde solo cuando no procede. */}
          <NotaDeFase donde="nutricion" />

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
                onPress={() => router.push(tool.route)}
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
        colors={['rgba(5,5,5,0)', 'rgba(5,5,5,0.92)', '#050505']}
        style={s.scrim}
        pointerEvents="none"
      />

      {consoleMeal && (
        <FoodConsole
          visible={consoleOpen}
          meals={visibleMeals}
          budgetById={budgetById}
          initialMealId={consoleMeal}
          metodoInicial={metodoConsola}
          dailyConsumed={totalCalories}
          dailyTarget={caloriesTarget}
          onClose={() => setConsoleOpen(false)}
          onCommit={entradas => {
            addEntries(entradas)
            /* Solo cuenta para la racha si se apunta en HOY. Registrar el
               sábado desde el lunes es corregir el historial, no hacer algo
               hoy, y encender la racha por eso sería regalarla. */
            if (date === hoyLocal()) void racha.registrarGesto('loggedFood')
          }}
        />
      )}

      <RachaEncendida
        visible={racha.visible}
        dias={racha.dias}
        semana={racha.semana}
        onCerrar={racha.cerrar}
      />
    </View>
  )
}

// ── Piezas ────────────────────────────────────────────────────────────────────

/**
 * EL AGUA, EN LA PANTALLA DONDE SE BUSCA
 * ══════════════════════════════════════
 * `waterGlasses`, `addWater` y `removeWater` viven en el `nutritionStore`
 * desde siempre —viajan con el día, se sincronizan con el servidor y cuentan
 * para el HealthScore— pero no había forma de tocarlos desde Nutrición. Estaban
 * en Salud y en Progreso; en el sitio donde uno apunta lo que se mete al
 * cuerpo, no.
 *
 * ── Ocho vasos que se tocan, no un más y un menos ───────────────────────────
 * Con botones de ±1, ponerse al día después de una mañana entera cuesta cinco
 * toques. Aquí se toca el vaso al que quieres llegar, y el store lo resuelve de
 * una vez con `setWater` — que hubo que añadirle, porque solo sabía sumar y
 * restar de uno en uno y recorrer la diferencia costaba una escritura en disco
 * y un PUT por cada vaso.
 */

function Agua({ vasos, onFijar }: { vasos: number; onFijar: (n: number) => void }) {
  const lleno = vasos >= META_VASOS

  const tocar = (destino: number) => {
    /* Tocar el último vaso lleno lo apaga: si no, llegar a 3 por error no
       tendría marcha atrás sin un botón de menos que ya no existe. */
    const n = destino === vasos ? destino - 1 : destino
    if (n === vasos) return
    onFijar(n)
    /* El vaso que cierra la meta se siente distinto a los siete anteriores. */
    if (n >= META_VASOS && vasos < META_VASOS) logro()
    else if (n > vasos) confirmar()
    else elegir()
  }

  return (
    <View style={s.agua}>
      <View style={s.aguaHead}>
        <ZIcon name="droplet" size={13} color={lleno ? NEON.white : NEON.w2} weight={1.9} />
        <Text style={s.aguaLbl}>HIDRATACIÓN</Text>
        <View style={{ flex: 1 }} />
        <Text style={s.aguaCuenta}>
          <Text style={s.aguaCuentaB}>{vasos}</Text> de {META_VASOS} vasos
        </Text>
      </View>
      <View style={s.aguaFila}>
        {Array.from({ length: META_VASOS }, (_, i) => {
          const on = i < vasos
          return (
            <TouchableOpacity
              key={i}
              style={[s.vaso, on && s.vasoOn]}
              onPress={() => tocar(i + 1)}
              activeOpacity={0.7}
              accessibilityLabel={`Marcar ${i + 1} ${i === 0 ? 'vaso' : 'vasos'} de agua`}
            >
              <ZIcon
                name="droplet"
                size={13}
                color={on ? NEON.white : NEON.w4}
                weight={on ? 2.2 : 1.6}
              />
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

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

/**
 * Los seis días de la tira.
 *
 * `activo` es el día que se está mirando, que ya no tiene por qué ser hoy: la
 * tira dejó de ser un adorno con el último recuadro encendido y ahora es el
 * mando para movserse por la semana. Se conservan los dos datos por separado
 * —`esHoy` y `activo`— porque hacen cosas distintas: uno decide el resalte y el
 * otro permite señalar cuál es hoy aunque estés mirando el martes.
 */
/**
 * Qué poner después de «Tu plato de …».
 *
 * Hoy y ayer se dicen por su nombre porque es como los llama cualquiera; del
 * resto se da el día de la semana, que es lo que uno recuerda («el sábado comí
 * fuera»). La fecha completa no aporta: ya está en la tira, justo debajo.
 */
function tituloDia(iso: string): string {
  const hoy = aFechaLocal(new Date())
  if (iso === hoy) return 'hoy'
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
  if (iso === aFechaLocal(ayer)) return 'ayer'
  const LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const [a, m, d] = iso.split('-').map(Number)
  return `el ${LARGO[new Date(a, m - 1, d).getDay()]}`
}

function weekStrip(seleccionado: string) {
  const SHORT = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']
  const today = new Date()
  const hoyIso = aFechaLocal(today)
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (5 - i))
    const iso = aFechaLocal(d)
    return {
      iso,
      day: d.getDate(),
      short: SHORT[d.getDay()],
      esHoy: iso === hoyIso,
      activo: iso === seleccionado,
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
  week: { flexDirection: 'row', gap: 6, paddingHorizontal: 20 },
  day: {
    flex: 1, alignItems: 'center', paddingTop: 9, paddingBottom: 10, borderRadius: 13,
    backgroundColor: NEON.pane,
  },
  dayOn: { backgroundColor: 'rgba(255,92,0,0.16)' },
  dayNum: { fontSize: 13.5, fontWeight: '800', color: NEON.w2, fontVariant: ['tabular-nums'] },
  dayNumOn: { color: NEON.white },
  dayLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: NEON.w3, marginTop: 3 },
  dayLblOn: { color: NEON.redSoft },
  /* Marca dónde está hoy cuando estás mirando otro día. Va abajo del todo para
     no competir con el número. */
  weekHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 24, marginTop: 20, marginBottom: 8,
  },
  weekTitle: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.9, color: NEON.w2 },
  weekCount: { fontSize: 9.5, color: NEON.w3, fontVariant: ['tabular-nums'] },
  dayBar: {
    /* `alignSelf: stretch` es imprescindible: el recuadro del día centra a sus
       hijos, así que un View sin ancho propio se encoge a cero y la barra
       desaparecía entera —carril incluido—. El hueco de al lado sí se veía
       porque lleva un ancho fijo. */
    alignSelf: 'stretch',
    height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 5, marginHorizontal: 6, overflow: 'hidden',
  },
  dayBarFill: { height: '100%', borderRadius: 2 },
  /* Hueco, no barra a cero: un carril vacío se leería como «cero kcal». */
  dayVacio: {
    height: 2.5, width: 12, borderRadius: 2, marginTop: 5, alignSelf: 'center',
    borderTopWidth: 1.5, borderColor: NEON.w4, borderStyle: 'dashed',
  },
  dayHoy: {
    position: 'absolute', bottom: 4, width: 3, height: 3, borderRadius: 2,
    backgroundColor: NEON.w3,
  },

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

  /* Con cuatro anillos el hueco entre ellos baja de 8 a 6: a 402 px de ancho,
     mantener 8 dejaba cada caja en 82 px y el nombre «PROTEÍNA» partía en dos
     líneas. */
  macros: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginTop: 14 },

  // Hidratación
  agua: {
    marginHorizontal: 20, marginTop: 10, padding: 13,
    borderRadius: 15, borderWidth: 1, borderColor: NEON.edge,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  aguaHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  aguaLbl: { fontSize: 8.5, fontWeight: '800', letterSpacing: 1.6, color: NEON.w2 },
  aguaCuenta: { fontSize: 10.5, color: NEON.w3 },
  aguaCuentaB: { fontWeight: '800', color: NEON.white, fontVariant: ['tabular-nums'] },
  aguaFila: { flexDirection: 'row', gap: 6, marginTop: 11 },
  vaso: {
    flex: 1, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEON.pane,
    borderWidth: 1, borderColor: 'transparent',
  },
  vasoOn: { backgroundColor: 'rgba(255,92,0,0.16)', borderColor: 'rgba(255,92,0,0.36)' },
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
  mealEmpty: { backgroundColor: 'rgba(255,92,0,0.06)' },
  mealTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mealMark: {
    width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  mealMarkEmpty: { backgroundColor: 'rgba(255,92,0,0.13)' },
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
    borderRadius: 18, backgroundColor: 'rgba(255,92,0,0.09)',
  },
  zenaMark: {
    width: 28, height: 28, borderRadius: 9, backgroundColor: NEON.red,
    alignItems: 'center', justifyContent: 'center',
  },
  zenaName: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1.6, color: NEON.redSoft, marginBottom: 4 },
  zenaTxt: { fontSize: 12.5, lineHeight: 19, color: 'rgba(242,243,245,0.92)' },

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
