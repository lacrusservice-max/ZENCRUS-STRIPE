/**
 * CONSOLA DE ALIMENTOS · ZENCRUS
 * ══════════════════════════════
 *
 * Registrar comida es un proceso de dos tiempos, no un formulario suelto:
 *
 *     CAPTURA ──────────────▶ REVISIÓN ──────────────▶ REGISTRO
 *     cinco métodos            bandeja editable         escritura al día
 *
 * Lo capturado por cualquier método cae en una bandeja común. Nada toca el
 * registro del día hasta que se confirma en revisión, así que se puede mezclar
 * búsqueda, escáner y receta en una sola sesión y corregirlo todo al final.
 *
 * ── Por qué una sola capa ───────────────────────────────────────────────────
 * Ambas etapas viven dentro del mismo `Modal`. Anidar un `Modal` dentro de
 * otro y cerrarlos en el mismo fotograma deja en iOS un view controller
 * huérfano: la pantalla se queda negra y deja de aceptar toques. Con una capa
 * y una máquina de etapas, ese fallo es estructuralmente imposible.
 *
 * ── Por qué nada se solapa ──────────────────────────────────────────────────
 * Cada banda fija declara su altura desde `Band`; el panel de contenido es el
 * único con `flex: 1`, siempre con `minHeight: 0` para poder encogerse. Los
 * carriles horizontales llevan `flexGrow: 0` explícito — sin él, un
 * `ScrollView` horizontal se estira hasta llenar el hueco y deforma a sus
 * hijos, que es justo lo que inflaba el antiguo selector de comidas.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, Dimensions,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing, FadeIn, FadeOut,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { FoodEntry, MealSlot } from '@/store/nutritionStore'
import { MealBudget } from '@/utils/mealBudget'
import { ParsedFoodsByMeal } from '@/services/foodListService'
import { Band, Motion } from '@/constants/layout'

import { CT, numeral, legend } from './console/tokens'
import { Tap, MethodRail, TargetStrip, Method } from './console/parts'
import { SearchPanel } from './console/panels/SearchPanel'
import { DictatePanel } from './console/panels/DictatePanel'
import { ScanPanel } from './console/panels/ScanPanel'
import { RecipePanel } from './console/panels/RecipePanel'
import { ReviewStage, Draft, toDraft } from './console/ReviewStage'

const { width: SCREEN } = Dimensions.get('window')

type MethodId = 'buscar' | 'lista' | 'escanear' | 'recetas'
type Stage = 'capture' | 'review'

/**
 * Los cuatro métodos de captura.
 *
 * El dictado por voz y la entrada manual se retiraron: el catálogo en línea ya
 * cubre lo que antes obligaba a teclear un alimento a mano, y el teclado del
 * sistema ya trae su propio dictado para el modo Lista.
 */
const PRIMARY: Method[] = [
  { id: 'buscar',   icon: 'reticle',  label: 'Buscar' },
  { id: 'lista',    icon: 'stack',    label: 'Lista' },
  { id: 'escanear', icon: 'frame',    label: 'Escáner' },
  { id: 'recetas',  icon: 'codex',    label: 'Recetas' },
]

/** Métodos cuyo panel trae su propia acción de pie — no llevan barra de bandeja. */
const OWN_FOOTER = new Set<MethodId>(['lista'])

/** Métodos que terminan en un acto explícito y saltan directos a revisión. */
const AUTO_ADVANCE = new Set<MethodId>(['lista'])

/** Icono del momento del día, derivado del identificador de la comida. */
function iconForMeal(id: string, index: number): ZIconName {
  if (id.startsWith('snack')) return 'bolt'
  if (id === 'breakfast') return 'dawn'
  if (id === 'lunch') return 'zenith'
  if (id === 'dinner') return 'dusk'
  return (['dawn', 'zenith', 'dusk', 'bolt'] as ZIconName[])[index % 4]
}

interface FoodConsoleProps {
  visible: boolean
  meals: MealSlot[]
  budgetById: Record<string, MealBudget>
  initialMealId: string
  dailyConsumed: number
  dailyTarget: number
  onClose: () => void
  onCommit: (byMeal: Record<string, FoodEntry[]>) => void
}

export function FoodConsole({
  visible, meals, budgetById, initialMealId, dailyConsumed, dailyTarget, onClose, onCommit,
}: FoodConsoleProps) {
  const insets = useSafeAreaInsets()

  const [stage, setStage] = useState<Stage>('capture')
  const [method, setMethod] = useState<MethodId>('buscar')
  const [mealId, setMealId] = useState(initialMealId)
  const [drafts, setDrafts] = useState<Draft[]>([])

  // Cada apertura arranca limpia: una bandeja heredada de la sesión anterior
  // registraría comida que el usuario ya descartó.
  useEffect(() => {
    if (!visible) return
    setStage('capture')
    setMethod('buscar')
    setMealId(initialMealId)
    setDrafts([])
  }, [visible, initialMealId])

  const targets = useMemo(
    () => meals.map((m, i) => ({
      id: m.id,
      label: m.label,
      icon: iconForMeal(m.id, i),
      free: Math.max(0, (budgetById[m.id]?.budget ?? 0) - (budgetById[m.id]?.consumed ?? 0)),
    })),
    [meals, budgetById],
  )

  const target = targets.find(t => t.id === mealId) ?? targets[0]
  const budget = budgetById[mealId]?.budget ?? 0
  const consumed = budgetById[mealId]?.consumed ?? 0

  const trayKcal = drafts.reduce((a, d) => a + d.calories, 0)

  // ── Transición entre etapas ─────────────────────────────────────────────
  const slide = useSharedValue(0)
  const progress = useSharedValue(0.5)

  useEffect(() => {
    const to = stage === 'review' ? 1 : 0
    slide.value = withSpring(to, { damping: 22, stiffness: 190, mass: 0.75 })
    progress.value = withTiming(to === 1 ? 1 : 0.5, { duration: Motion.stage, easing: Easing.out(Easing.cubic) })
  }, [stage])

  const captureAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: -slide.value * SCREEN * 0.28 }],
    opacity: 1 - slide.value,
  }))
  const reviewAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - slide.value) * SCREEN }],
  }))
  const progressAnim = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))

  // ── Bandeja ─────────────────────────────────────────────────────────────

  const collect = useCallback((entry: FoodEntry, into: string = mealId) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setDrafts(prev => [...prev, toDraft(entry, into)])
  }, [mealId])

  const collectParsed = useCallback((parsed: ParsedFoodsByMeal) => {
    const next: Draft[] = []
    for (const [meal, list] of Object.entries(parsed)) {
      for (const [i, f] of list.entries()) {
        next.push(toDraft({
          id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          name: f.name,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          fiber: f.fiber,
          amount: f.amount,
          unit: f.unit,
          active: true,
        }, meal))
      }
    }
    if (next.length === 0) return
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setDrafts(prev => [...prev, ...next])
    setStage('review')
  }, [])

  const pickMethod = (id: string) => setMethod(id as MethodId)

  const back = () => {
    if (stage === 'review') { setStage('capture'); return }
    onClose()
  }

  const commit = (byMeal: Record<string, FoodEntry[]>) => {
    onCommit(byMeal)
    onClose()
  }

  const showTray = drafts.length > 0 && !OWN_FOOTER.has(method)
  const showTarget = method !== 'lista'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={back}
    >
      <View style={[c.root, { paddingTop: insets.top }]}>
        {/* Progreso del proceso */}
        <View style={c.progressTrack}>
          <Animated.View style={[c.progressFill, progressAnim]} />
        </View>

        {/* Cabecera */}
        <View style={c.head}>
          <Tap onPress={back} scaleTo={0.88} haptic="light">
            <View style={c.back}>
              <ZIcon name="chevronLeft" size={17} color={CT.ink} weight={2} />
            </View>
          </Tap>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={legend}>
              {stage === 'review' ? 'Paso 2 de 2 · Revisión' : 'Paso 1 de 2 · Captura'}
            </Text>
            <Text style={c.headTitle} numberOfLines={1}>
              {stage === 'review' ? 'Confirma y ajusta' : target?.label ?? 'Registrar'}
            </Text>
          </View>

          {stage === 'capture' && budget > 0 && (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[numeral, { fontSize: 20 }]}>{Math.max(0, budget - consumed)}</Text>
              <Text style={legend}>kcal libres</Text>
            </View>
          )}
        </View>

        <KeyboardAvoidingView
          style={c.stageHost}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={insets.top}
        >
          {/* ── Etapa 1 · Captura ── */}
          <Animated.View style={[c.stage, captureAnim]} pointerEvents={stage === 'capture' ? 'auto' : 'none'}>
            <MethodRail
              methods={PRIMARY}
              active={method}
              onSelect={pickMethod}
            />

            {showTarget && (
              <TargetStrip targets={targets} active={mealId} onSelect={setMealId} />
            )}

            <View style={c.panelHost}>
              {method === 'buscar' && (
                <SearchPanel
                  consumed={consumed}
                  budget={budget}
                  onCommit={e => collect(e)}
                />
              )}
              {method === 'lista' && (
                <DictatePanel
                  mode="lista"
                  targets={targets}
                  focusMeal={mealId}
                  bottomInset={insets.bottom}
                  onParsed={collectParsed}
                />
              )}
              {method === 'escanear' && (
                <ScanPanel onCommit={e => collect(e)} onBuscar={() => setMethod('buscar')} />
              )}
              {method === 'recetas' && (
                <RecipePanel consumed={consumed} budget={budget} onCommit={e => collect(e)} />
              )}
            </View>

            {/* Puente a la revisión */}
            {showTray && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(140)}
                style={[c.tray, { paddingBottom: 14 + insets.bottom }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={c.trayCount}>
                    {drafts.length} {drafts.length === 1 ? 'alimento' : 'alimentos'} en bandeja
                  </Text>
                  <Text style={c.trayKcal}>{Math.round(trayKcal)} kcal acumuladas</Text>
                </View>
                <Tap onPress={() => setStage('review')} haptic="medium" scaleTo={0.96}>
                  <View style={c.trayGo}>
                    <Text style={c.trayGoTxt}>Revisar</Text>
                    <ZIcon name="arrowRight" size={15} color="#fff" weight={2} />
                  </View>
                </Tap>
              </Animated.View>
            )}
          </Animated.View>

          {/* ── Etapa 2 · Revisión ── */}
          <Animated.View
            style={[c.stage, c.stageOverlay, reviewAnim]}
            pointerEvents={stage === 'review' ? 'auto' : 'none'}
          >
            <ReviewStage
              drafts={drafts}
              targets={targets}
              dailyConsumed={dailyConsumed}
              dailyTarget={dailyTarget}
              bottomInset={insets.bottom}
              onChange={setDrafts}
              onAddMore={id => { setMealId(id); setMethod('buscar'); setStage('capture') }}
              onCommit={commit}
            />
          </Animated.View>
        </KeyboardAvoidingView>

      </View>
    </Modal>
  )
}

const c = StyleSheet.create({
  root: { flex: 1, backgroundColor: CT.base },

  progressTrack: { height: Band.progress, backgroundColor: 'rgba(255,255,255,0.07)' },
  progressFill: { height: Band.progress, backgroundColor: CT.signal },

  head: {
    height: Band.header,
    flexDirection: 'row', alignItems: 'center', gap: 13,
    paddingHorizontal: 18,
  },
  back: {
    width: 34, height: 34, borderRadius: CT.r.xs,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: CT.panel,
  },
  headTitle: { fontSize: 18, fontWeight: '800', color: CT.ink, letterSpacing: -0.3, marginTop: 1 },

  stageHost: { flex: 1, minHeight: 0 },
  stage: { flex: 1, minHeight: 0 },
  stageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: CT.base },

  panelHost: { flex: 1, minHeight: 0 },

  tray: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CT.hairline,
    backgroundColor: CT.base,
  },
  trayCount: { fontSize: 13, fontWeight: '800', color: CT.ink },
  trayKcal: { fontSize: 11, color: CT.ink3, marginTop: 2, fontVariant: ['tabular-nums'] },
  trayGo: {
    height: 46, paddingHorizontal: 20, borderRadius: CT.r.sm, backgroundColor: CT.signal,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  trayGoTxt: { fontSize: 13.5, fontWeight: '800', color: '#fff' },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  menu: {
    position: 'absolute', right: 12, width: 268,
    borderRadius: CT.r.md, backgroundColor: '#131318',
    borderWidth: StyleSheet.hairlineWidth, borderColor: CT.edge,
    paddingBottom: 6, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
    elevation: 24,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  menuItemOn: { backgroundColor: 'rgba(255,255,255,0.05)' },
  menuIcon: {
    width: 32, height: 32, borderRadius: CT.r.xs, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  menuLbl: { fontSize: 13, fontWeight: '700', color: CT.ink2 },
  menuNote: { fontSize: 10.5, color: CT.ink3, marginTop: 2 },
  menuDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: CT.signal },
  menuSep: { height: StyleSheet.hairlineWidth, backgroundColor: CT.hairline, marginVertical: 5 },
})
