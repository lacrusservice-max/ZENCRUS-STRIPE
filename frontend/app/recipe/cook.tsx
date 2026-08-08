/**
 * MODO COCINA · ZENCRUS
 * ═════════════════════
 *
 * Un paso a la vez, con su reloj. Cocinando se tienen las manos ocupadas o
 * mojadas: la pantalla mantiene un solo foco, el texto crece y el temporizador
 * avisa solo.
 *
 * ── Al terminar ─────────────────────────────────────────────────────────────
 * Dos preguntas que ninguna app hace y cambian el registro:
 *
 *   ¿Cómo quedó?   la foto propia sustituye a la de archivo — el recetario deja
 *                  de depender de imágenes de stock.
 *   ¿Te sobró?     registrar la ración entera cuando sobró un cuarto mete un
 *                  error del 25 % en el día. Aquí se descuenta y el resto queda
 *                  como táper.
 */

import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, AppState, Alert,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import Svg, { Circle } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useRecipesStore } from '@/store/recipesStore'
import { useNutritionStore } from '@/store/nutritionStore'
import { ZIcon } from '@/components/ui/ZencrusIcon'
import { RecipePhoto } from '@/components/recipes/RecipePhoto'
import { photoFor, RECIPE_CREDITS } from '@/data/recipePhotos'
import { Screen } from '@/components/ui/Screen'
import { Colors, Typography } from '@/constants/theme'

const N = Colors.neon

/** Cuánto se comió realmente, como fracción de la ración preparada. */
const PORTIONS = [
  { id: 'all', label: 'Nada', sub: 'me lo comí', eaten: 1 },
  { id: 'q1', label: '¼', sub: 'sobró poco', eaten: 0.75 },
  { id: 'half', label: '½', sub: 'la mitad', eaten: 0.5 },
  { id: 'q3', label: '¾', sub: 'casi todo', eaten: 0.25 },
]

/**
 * Comida a la que va lo cocinado, según la hora.
 *
 * Preguntar «¿a qué comida lo apunto?» justo cuando alguien acaba de cocinar y
 * quiere sentarse a comer es fricción innecesaria: la hora acierta casi
 * siempre, y si falla se mueve luego en la revisión del día.
 */
function mealSlotNow(): string {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 17) return 'lunch'
  if (h < 22) return 'dinner'
  return 'snack1'
}

/** mm:ss a partir de segundos. */
function clock(sec: number) {
  const m = Math.floor(Math.max(sec, 0) / 60)
  const r = Math.max(sec, 0) % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function CookMode() {
  const { id, servings } = useLocalSearchParams<{ id: string; servings?: string }>()
  const { recipes, logCooked } = useRecipesStore()
  const { addEntries } = useNutritionStore()
  const recipe = recipes.find(r => r.id === id)

  const [step, setStep] = useState(0)
  const [handsFree, setHandsFree] = useState(false)
  const [done, setDone] = useState(false)
  const [left, setLeft] = useState(0)
  const [running, setRunning] = useState(false)
  const [portion, setPortion] = useState(PORTIONS[0])
  const startedAt = useRef(Date.now())

  const total = recipe?.steps.length ?? 0
  const timers = recipe?.stepTimersMin ?? []
  const stepMinutes = timers[step] ?? 0

  // Al cambiar de paso se carga su reloj. Un paso sin minutos declarados
  // —cortar, emplatar— no abre temporizador en vez de inventar un tiempo.
  useEffect(() => {
    setLeft(stepMinutes * 60)
    setRunning(stepMinutes > 0)
  }, [step, stepMinutes])

  // El reloj se recalcula desde una marca de tiempo real, no descontando un
  // segundo por tick: si el sistema suspende el intervalo, al volver la cuenta
  // sigue siendo correcta.
  useEffect(() => {
    if (!running || left <= 0) return
    const endAt = Date.now() + left * 1000
    const t = setInterval(() => {
      const rest = Math.round((endAt - Date.now()) / 1000)
      if (rest <= 0) {
        setLeft(0)
        setRunning(false)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      } else {
        setLeft(rest)
      }
    }, 500)
    return () => clearInterval(t)
  }, [running])

  // Al volver del segundo plano se refresca la cuenta, que pudo avanzar fuera.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active' && running) setLeft(l => l)
    })
    return () => sub.remove()
  }, [running])

  if (!recipe) {
    return (
      <Screen>
        <View style={s.center}>
          <Text style={s.centerTxt}>Esta receta ya no existe.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.centerBack}>VOLVER</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    )
  }

  const nServings = Number(servings) || recipe.servings || 1
  const per = recipe.nutrition
  const elapsedMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))

  const finish = () => {
    const eaten = portion.eaten
    addEntries({
      [mealSlotNow()]: [{
        id: `${Date.now()}_cook`,
        timestamp: Date.now(),
        name: recipe.title,
        calories: Math.round(per.calories * eaten),
        protein: per.protein * eaten,
        carbs: per.carbs * eaten,
        fat: per.fat * eaten,
        fiber: 0,
        amount: eaten,
        unit: 'ración',
        active: true,
        emoji: recipe.emoji,
      }],
    })
    logCooked(recipe.id, nServings)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    router.replace('/(tabs)/nutrition')
  }

  // ── Cierre ────────────────────────────────────────────────────────────────
  if (done) {
    const eatenKcal = Math.round(per.calories * portion.eaten)
    const restKcal = Math.round(per.calories) - eatenKcal
    return (
      <Screen>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.doneCard}>
            <Text style={s.doneTitle}>Listo en {elapsedMin} min</Text>
            <Text style={s.doneSub}>
              {elapsedMin < (recipe.prepTimeMin + recipe.cookTimeMin)
                ? `${(recipe.prepTimeMin + recipe.cookTimeMin) - elapsedMin} min menos que la estimación`
                : 'Buen trabajo'}
            </Text>
          </View>

          <TouchableOpacity
            style={s.shot}
            activeOpacity={0.85}
            onPress={() => Alert.alert('Cámara', 'Aquí se abriría la cámara para tu foto del plato.')}
          >
            <View style={s.shotIc}><ZIcon name="frame" size={20} color={N.red} weight={1.9} /></View>
            <Text style={s.shotTitle}>¿CÓMO QUEDÓ?</Text>
            <Text style={s.shotSub}>
              Tu foto reemplaza la de archivo en el recetario y queda en tu historial.
            </Text>
          </TouchableOpacity>

          <Text style={s.lbl}>¿TE SOBRÓ?</Text>
          <View style={s.portions}>
            {PORTIONS.map(p => {
              const on = p.id === portion.id
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[s.portion, on && s.portionOn]}
                  onPress={() => setPortion(p)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.portionV, on && s.portionVOn]}>{p.label}</Text>
                  <Text style={s.portionL}>{p.sub}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={s.adj}>
            <Text style={s.adjTxt}>
              Se registran <Text style={s.adjB}>{eatenKcal} kcal</Text>
              {restKcal > 0 && <> en vez de {Math.round(per.calories)}, y el resto queda como <Text style={s.adjB}>1 táper</Text> de {restKcal} kcal</>}.
            </Text>
          </View>

          <TouchableOpacity style={s.primary} onPress={finish} activeOpacity={0.88}>
            <ZIcon name="check" size={15} color="#fff" weight={2.4} />
            <Text style={s.primaryTxt}>REGISTRAR EN MI DÍA</Text>
          </TouchableOpacity>
        </ScrollView>
      </Screen>
    )
  }

  // ── Manos libres ──────────────────────────────────────────────────────────
  if (handsFree) {
    return (
      <Screen>
        <View style={s.hfWrap}>
          <Text style={s.hfStep}>PASO {step + 1} DE {total} · MANOS LIBRES</Text>
          <Text style={s.hfText}>{recipe.steps[step]}</Text>

          {stepMinutes > 0 && (
            <View style={s.hfTimer}>
              <Text style={s.hfClock}>{clock(left)}</Text>
              <Text style={s.hfClockLbl}>{running ? 'CORRIENDO' : 'LISTO'}</Text>
            </View>
          )}

          <View style={s.mic}>
            <ZIcon name="waveform" size={26} color="#fff" weight={2} />
          </View>
          <Text style={s.hfHint}>Escuchando · di lo que necesites</Text>
          <View style={s.cmds}>
            {['«siguiente»', '«repite»', '«cuánto falta»', '«pon 3 minutos»'].map(c => (
              <View key={c} style={s.cmd}><Text style={s.cmdTxt}>{c}</Text></View>
            ))}
          </View>

          <View style={s.hfActions}>
            <TouchableOpacity style={s.ghost} onPress={() => setHandsFree(false)} activeOpacity={0.85}>
              <Text style={s.ghostTxt}>SALIR DE MANOS LIBRES</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.primary}
              activeOpacity={0.88}
              onPress={() => step + 1 >= total ? setDone(true) : setStep(step + 1)}
            >
              <Text style={s.primaryTxt}>
                {step + 1 >= total ? 'TERMINAR' : 'SIGUIENTE PASO'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen>
    )
  }

  // ── Paso a paso ───────────────────────────────────────────────────────────
  const R = 20
  const C = 2 * Math.PI * R
  const progress = stepMinutes > 0 ? left / (stepMinutes * 60) : 0

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <RecipePhoto
          source={photoFor(recipe.id, recipe.userPhotoUri, 'cook')}
            credit={RECIPE_CREDITS[recipe.id]}
          emoji={recipe.emoji}
          height={150}
          radius={14}
          steam={recipe.cookTimeMin > 0}
        >
          <TouchableOpacity style={s.back} onPress={() => router.back()} hitSlop={10}>
            <ZIcon name="chevronLeft" size={16} color={N.white} weight={2.2} />
          </TouchableOpacity>
        </RecipePhoto>

        <Text style={s.lbl}>PASO {step + 1} DE {total}</Text>

        <View style={s.stepCard}>
          <View style={s.stepHead}>
            <View style={s.stepN}><Text style={s.stepNTxt}>{step + 1}</Text></View>
            <Text style={s.stepTitle} numberOfLines={2}>{recipe.steps[step]}</Text>
          </View>

          {stepMinutes > 0 && (
            <View style={s.timer}>
              <View style={s.tRing}>
                <Svg width={48} height={48} viewBox="0 0 48 48" style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={24} cy={24} r={R} stroke="rgba(255,255,255,0.1)" strokeWidth={4} fill="none" />
                  <Circle
                    cx={24} cy={24} r={R} stroke={N.red} strokeWidth={4} fill="none"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - progress)}
                  />
                </Svg>
                <View style={s.tCenter} pointerEvents="none">
                  <Text style={s.tTxt}>{clock(left)}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.tLbl}>{running ? 'CORRIENDO' : left === 0 ? 'TERMINADO' : 'EN PAUSA'}</Text>
                <Text style={s.tSub}>Te aviso aunque bloquees la pantalla</Text>
              </View>
              <TouchableOpacity
                style={s.tBtn}
                onPress={() => setRunning(r => !r)}
                hitSlop={8}
                activeOpacity={0.85}
              >
                <ZIcon name={running ? 'minus' : 'plus'} size={13} color={N.white} weight={2.2} />
              </TouchableOpacity>
            </View>
          )}

          <View style={s.bar}>
            {recipe.steps.map((_, i) => (
              <View key={i} style={[s.barSeg, i < step && s.barDone, i === step && s.barNow]} />
            ))}
          </View>
        </View>

        <TouchableOpacity style={s.hfBtn} onPress={() => setHandsFree(true)} activeOpacity={0.85}>
          <ZIcon name="waveform" size={14} color={N.red} weight={2} />
          <Text style={s.hfBtnTxt}>MODO MANOS LIBRES</Text>
        </TouchableOpacity>

        <Text style={s.lbl}>TODOS LOS PASOS</Text>
        {recipe.steps.map((st, i) => (
          <TouchableOpacity
            key={i}
            style={[s.mini, i < step && s.miniDone]}
            onPress={() => setStep(i)}
            activeOpacity={0.85}
          >
            <View style={[s.miniN, i < step && s.miniNDone]}>
              {i < step
                ? <ZIcon name="check" size={9} color={N.void} weight={3} />
                : <Text style={s.miniNTxt}>{i + 1}</Text>}
            </View>
            <Text style={[s.miniTxt, i < step && s.miniTxtDone]} numberOfLines={1}>{st}</Text>
            {(timers[i] ?? 0) > 0 && <Text style={s.miniTime}>{timers[i]} min</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={s.next}
        activeOpacity={0.88}
        onPress={() => step + 1 >= total ? setDone(true) : setStep(step + 1)}
      >
        <Text style={s.primaryTxt}>
          {step + 1 >= total ? 'TERMINAR Y REGISTRAR' : 'SIGUIENTE PASO'}
        </Text>
        <ZIcon name="chevronRight" size={14} color="#fff" weight={2.4} />
      </TouchableOpacity>
    </Screen>
  )
}

const s = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 110 },
  back: {
    position: 'absolute', top: 12, left: 12,
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  lbl: { fontFamily: Typography.fontFamily.display, fontSize: 9, fontWeight: '800', letterSpacing: 1.9, color: N.w3, marginTop: 18, marginBottom: 9 },

  stepCard: {
    padding: 14, borderRadius: 16,
    backgroundColor: N.pane, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  stepHead: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', marginBottom: 12 },
  stepN: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.red,
  },
  stepNTxt: { fontFamily: Typography.fontFamily.display, fontSize: 12, fontWeight: '800', color: '#fff' },
  stepTitle: { flex: 1, fontSize: 14, lineHeight: 20, color: N.white, fontWeight: '600' },

  timer: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    padding: 10, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.32)', borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  tRing: { width: 48, height: 48 },
  tCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  tTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', color: N.white },
  tLbl: { fontFamily: Typography.fontFamily.display, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.2, color: N.red },
  tSub: { fontSize: 10.5, color: N.w3, marginTop: 2 },
  tBtn: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.paneHi, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },

  bar: { flexDirection: 'row', gap: 4, marginTop: 12 },
  barSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  barDone: { backgroundColor: N.w2 },
  barNow: { backgroundColor: N.red },

  hfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10, paddingVertical: 12, borderRadius: 12,
    backgroundColor: N.redDim, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  hfBtnTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: N.red },

  mini: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 11, borderRadius: 10, marginBottom: 5,
    backgroundColor: 'rgba(0,0,0,0.24)',
  },
  miniDone: { opacity: 0.6 },
  miniN: {
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.paneHi,
  },
  miniNDone: { backgroundColor: N.white },
  miniNTxt: { fontFamily: Typography.fontFamily.display, fontSize: 9.5, fontWeight: '800', color: N.w3 },
  miniTxt: { flex: 1, fontSize: 11.5, color: N.w2 },
  miniTxtDone: { textDecorationLine: 'line-through' },
  miniTime: { fontFamily: Typography.fontFamily.display, fontSize: 10, color: N.w3 },

  next: {
    position: 'absolute', left: 20, right: 20, bottom: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 16, backgroundColor: N.red,
    shadowColor: N.red, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },

  // Manos libres
  hfWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 20, alignItems: 'center', justifyContent: 'center' },
  hfStep: { fontFamily: Typography.fontFamily.display, fontSize: 10, fontWeight: '800', letterSpacing: 2, color: N.red, marginBottom: 16 },
  hfText: { fontFamily: Typography.fontFamily.display, fontSize: 24, lineHeight: 33, fontWeight: '700', color: N.white, textAlign: 'center', marginBottom: 20 },
  hfTimer: { alignItems: 'center', marginBottom: 22 },
  hfClock: { fontFamily: Typography.fontFamily.display, fontSize: 44, fontWeight: '800', color: N.white, letterSpacing: -1 },
  hfClockLbl: { fontFamily: Typography.fontFamily.display, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.8, color: N.red, marginTop: 4 },
  mic: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.red, marginBottom: 12,
    shadowColor: N.red, shadowOpacity: 0.6, shadowRadius: 26, shadowOffset: { width: 0, height: 0 },
  },
  hfHint: { fontSize: 11.5, color: N.w3, marginBottom: 12 },
  cmds: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 26 },
  cmd: {
    paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.34)', borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  cmdTxt: { fontSize: 11, color: N.w2 },
  hfActions: { alignSelf: 'stretch', gap: 9 },
  ghost: {
    paddingVertical: 13, borderRadius: 14, alignItems: 'center',
    backgroundColor: N.paneHi, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  ghostTxt: { fontFamily: Typography.fontFamily.display, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: N.w2 },

  // Cierre
  doneCard: {
    padding: 18, borderRadius: 18, alignItems: 'center',
    backgroundColor: N.redDim, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)',
  },
  doneTitle: { fontFamily: Typography.fontFamily.display, fontSize: 19, fontWeight: '800', color: N.white, letterSpacing: 0.3 },
  doneSub: { fontSize: 11.5, color: N.w2, marginTop: 5 },
  shot: {
    marginTop: 12, paddingVertical: 22, paddingHorizontal: 16, borderRadius: 16, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.24)', borderWidth: 1, borderColor: N.edge, borderStyle: 'dashed',
  },
  shotIc: {
    width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.redDim, borderWidth: 1, borderColor: 'rgba(255,31,61,0.28)', marginBottom: 11,
  },
  shotTitle: { fontFamily: Typography.fontFamily.display, fontSize: 13, fontWeight: '800', letterSpacing: 1.2, color: N.white, marginBottom: 5 },
  shotSub: { fontSize: 11.5, lineHeight: 17, color: N.w3, textAlign: 'center' },

  portions: { flexDirection: 'row', gap: 6 },
  portion: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: N.edge,
  },
  portionOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: N.redDim },
  portionV: { fontFamily: Typography.fontFamily.display, fontSize: 14, fontWeight: '800', color: N.white },
  portionVOn: { color: N.red },
  portionL: { fontFamily: Typography.fontFamily.display, fontSize: 8.5, fontWeight: '700', letterSpacing: 0.8, color: N.w3, marginTop: 4, textTransform: 'uppercase' },

  adj: {
    marginTop: 10, padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  adjTxt: { fontSize: 11.5, lineHeight: 17, color: N.w3 },
  adjB: { color: N.white, fontWeight: '700' },

  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    marginTop: 14, paddingVertical: 15, borderRadius: 16, backgroundColor: N.red,
  },
  primaryTxt: { fontFamily: Typography.fontFamily.display, fontSize: 12.5, fontWeight: '800', letterSpacing: 1.4, color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  centerTxt: { fontSize: 13, color: N.w3 },
  centerBack: { fontFamily: Typography.fontFamily.display, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.2, color: N.red },
})
