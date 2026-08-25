/**
 * METAS DE ENERGÍA · ZENCRUS
 * ══════════════════════════
 *
 * El dial de porción no es exclusivo de los alimentos: aquí gobierna la meta
 * diaria, el piso calórico y el reparto de macros. Misma interacción en toda la
 * app — se arrastra el arco o se toca un atajo.
 *
 * ── Por qué el piso vive aquí ───────────────────────────────────────────────
 * Comer de menos frena el progreso tanto como pasarse, pero ninguna app lo
 * señala. Al hacerlo configurable deja de ser una regla escondida y pasa a ser
 * una decisión del usuario, que es quien conoce su contexto.
 *
 * El guardado va contra el mismo endpoint que usa el ajuste semanal de
 * Nutrición (`PUT /users/profile`), así que ambos escriben el mismo objeto de
 * metas y no pueden divergir.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { PortionDial } from '@/components/nutrition/PortionDial'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { Colors, Typography } from '@/constants/theme'
import { TabBar } from '@/constants/layout'
import api from '@/services/api'
import { calculateTDEE } from '@/utils/tdee'

const N = Colors.neon

/** Reparto de kilocalorías por gramo de cada macro. */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 }

export default function GoalsEnergyScreen() {
  const { user, setUser } = useAuthStore()
  const goals = (user as any)?.goals ?? {}

  const [target, setTarget] = useState<number>(goals.calories_target ?? 2000)
  const [floor, setFloor] = useState<number>(
    goals.calories_min ?? Math.round((goals.calories_target ?? 2000) * 0.85),
  )
  const [ceiling, setCeiling] = useState<number>(
    goals.calories_max ?? Math.round((goals.calories_target ?? 2000) * 1.15),
  )
  const [protein, setProtein] = useState<number>(goals.protein_g ?? 150)
  const [carbs, setCarbs] = useState<number>(goals.carbs_g ?? 200)
  const [fat, setFat] = useState<number>(goals.fat_g ?? 65)
  const [fibra, setFibra] = useState<number>(goals.fiber_g ?? 28)
  const [comidas, setComidas] = useState<number>(goals.meals_per_day ?? 3)
  const [saving, setSaving] = useState(false)
  /* Con un dedo sobre un dial, la pantalla no se desplaza. En iOS es lo único
     que lo impide: el UIScrollView cancela por su cuenta los toques que
     empiezan en una vista hija. Ver la nota del gesto en `PortionDial`. */
  const [arrastrando, setArrastrando] = useState(false)

  /**
   * Los tres van encadenados: piso ≤ meta ≤ techo.
   *
   * Mover la meta arrastra a los otros dos si se quedan del lado equivocado. Sin
   * esto, bajar la meta a 1.800 con el piso en 1.900 deja la app diciendo a la
   * vez «te falta para el mínimo» y «ya estás en la meta». El servidor rechaza
   * esa combinación, pero el usuario no debería llegar a mandarla.
   */
  const setTargetSafe = (v: number) => {
    setTarget(v)
    if (floor > v) setFloor(Math.round(v * 0.85))
    if (ceiling < v) setCeiling(Math.round(v * 1.15))
  }
  const setFloorSafe = (v: number) => setFloor(Math.min(v, target))
  const setCeilingSafe = (v: number) => setCeiling(Math.max(v, target))

  const kcalP = protein * KCAL_PER_G.protein
  const kcalC = carbs * KCAL_PER_G.carbs
  const kcalF = fat * KCAL_PER_G.fat
  const kcalMacros = kcalP + kcalC + kcalF
  const pct = (v: number) => (kcalMacros > 0 ? Math.round((v / kcalMacros) * 100) : 0)
  // Desajuste entre lo que suman los macros y la meta declarada.
  const drift = Math.round(kcalMacros - target)

  /**
   * Rehace las cinco cifras a partir del peso, la altura, la edad y la
   * actividad. Vivía en el acordeón de Perfil, que era el otro sitio donde se
   * editaban metas; se trae aquí porque este pasa a ser el único.
   *
   * No guarda: deja los diales cargados para que se vean antes de aceptar. Un
   * botón que reescribe cinco cifras sin enseñarlas primero da miedo de tocar.
   */
  const recalcular = () => {
    if (!user?.weight || !user?.height || !user?.age || !user?.gender || !user?.activity_level) {
      Alert.alert('Faltan datos', 'Completa peso, altura, edad y nivel de actividad en tu perfil.')
      return
    }
    const r = calculateTDEE({
      weight: user.weight, height: user.height, age: user.age,
      gender: user.gender as any, activityLevel: user.activity_level as any,
      goal: (goals.main_goal ?? 'maintain') as any,
      targetWeight: goals.target_weight ?? user.weight,
    })
    setTargetSafe(r.targetCalories)
    setProtein(r.proteinG); setCarbs(r.carbsG); setFat(r.fatG); setFibra(r.fiberG)
    Alert.alert('Recalculado', `Meta: ${r.targetCalories.toLocaleString('es-MX')} kcal. Revísalo y guarda si te encaja.`)
  }

  const save = async () => {
    setSaving(true)
    try {
      const { data: res } = await api.put('/users/profile', {
        goals: {
          ...goals,
          calories_target: Math.round(target),
          calories_min: Math.round(floor),
          calories_max: Math.round(ceiling),
          protein_g: Math.round(protein),
          carbs_g: Math.round(carbs),
          fat_g: Math.round(fat),
          fiber_g: Math.round(fibra),
          meals_per_day: comidas,
        },
      })
      if (res?.data) setUser(res.data)
      router.back()
    } catch {
      Alert.alert('No se pudo guardar', 'Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        /* No se desplaza mientras un dedo gira un dial. Ver `PortionDial`. */
        scrollEnabled={!arrastrando}
        contentContainerStyle={{ paddingBottom: TabBar.scrollInset + 30 }}
      >
        <ScreenHeader
          eyebrow="Zencrus · Ajustes"
          title="Metas de energía"
          icon="flame"
          color={N.red}
          back
        />

        <Section title="Meta diaria" note="Se recalcula sola cada semana" />

        <DialCard
          onArrastre={setArrastrando}
          icon="target"
          title="Meta de kcal"
          sub="Objetivo del día"
          value={target}
          unit="kcal"
          readout="kcal objetivo"
          max={4000}
          step={25}
          presets={[1800, 2000, 2200, 2500]}
          onChange={setTargetSafe}
        />

        <DialCard
          onArrastre={setArrastrando}
          icon="target"
          title="Límite mínimo"
          sub="Piso de seguridad — no bajar de aquí"
          value={floor}
          unit="kcal"
          readout="kcal mínimas"
          max={4000}
          step={25}
          presets={[
            Math.round(target * 0.8),
            Math.round(target * 0.85),
            Math.round(target * 0.9),
          ]}
          onChange={setFloorSafe}
        />

        <DialCard
          onArrastre={setArrastrando}
          icon="flame"
          title="Límite máximo"
          sub="Techo del día — a partir de aquí, te pasaste"
          value={ceiling}
          unit="kcal"
          readout="kcal máximas"
          max={5000}
          step={25}
          presets={[
            Math.round(target * 1.10),
            Math.round(target * 1.15),
            Math.round(target * 1.25),
          ]}
          onChange={setCeilingSafe}
        />

        <View style={s.note}>
          <ZIcon name="target" size={13} color={N.steelSoft} weight={1.9} />
          <Text style={s.noteTxt}>
            <Text style={s.noteB}>El mínimo es un piso y el máximo un techo; la meta va en
            medio.</Text> ZENCRUS avisa por debajo del piso porque comer de menos frena el
            progreso tanto como pasarse, y por encima del techo porque pasarse doscientas kcal
            un día de entreno no es lo mismo que pasarse seiscientas.
          </Text>
        </View>

        <Section title="Reparto de macros" note={`${pct(kcalP)} / ${pct(kcalC)} / ${pct(kcalF)} %`} />

        <DialCard
          onArrastre={setArrastrando}
          icon="flame" title="Proteína" sub="4 kcal por gramo"
          value={protein} unit="g" readout="gramos de proteína"
          max={300} step={5} presets={[120, 150, 180, 210]}
          onChange={setProtein}
        />
        <DialCard
          onArrastre={setArrastrando}
          icon="flame" title="Carbohidratos" sub="4 kcal por gramo"
          value={carbs} unit="g" readout="gramos de carbos"
          max={500} step={5} presets={[150, 200, 250, 300]}
          onChange={setCarbs}
        />
        <DialCard
          onArrastre={setArrastrando}
          icon="flame" title="Grasas" sub="9 kcal por gramo"
          value={fat} unit="g" readout="gramos de grasa"
          max={200} step={5} presets={[50, 65, 80, 95]}
          onChange={setFat}
        />

        <DialCard
          onArrastre={setArrastrando}
          icon="flame" title="Fibra" sub="No suma calorías, pero se cuenta"
          value={fibra} unit="g" readout="gramos de fibra"
          max={60} step={1} presets={[22, 28, 35, 42]}
          onChange={setFibra}
        />

        <Section title="Cómo repartes el día" note={`${comidas} comidas`} />

        <View style={s.card}>
          <Text style={s.splitLbl}>COMIDAS AL DÍA</Text>
          <Text style={s.pista}>
            Es el número de huecos que ZENCRUS te reparte en Nutrición. Cambiarlo
            reparte las mismas kcal en más o menos comidas.
          </Text>
          <View style={s.comidasFila}>
            {[3, 4, 5, 6].map(n => (
              <TouchableOpacity
                key={n}
                style={[s.comidaBtn, comidas === n && s.comidaBtnOn]}
                onPress={() => setComidas(n)}
                activeOpacity={0.8}
              >
                <Text style={[s.comidaTxt, comidas === n && s.comidaTxtOn]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reparto calórico resultante */}
        <View style={s.card}>
          <Text style={s.splitLbl}>DE DÓNDE SALEN TUS KCAL</Text>
          <View style={s.splitBar}>
            <View style={[s.splitSeg, { flex: Math.max(kcalP, 1), backgroundColor: N.white }]} />
            <View style={[s.splitSeg, { flex: Math.max(kcalC, 1), backgroundColor: N.red }]} />
            <View style={[s.splitSeg, { flex: Math.max(kcalF, 1), backgroundColor: N.steelSoft }]} />
          </View>
          <View style={s.splitLeg}>
            <Leg tone={N.white} label={`Prot ${pct(kcalP)} %`} />
            <Leg tone={N.red} label={`Carb ${pct(kcalC)} %`} />
            <Leg tone={N.steelSoft} label={`Grasa ${pct(kcalF)} %`} />
          </View>

          <View style={[s.drift, Math.abs(drift) > 60 && s.driftOff]}>
            <Text style={[s.driftTxt, Math.abs(drift) > 60 && s.driftTxtOff]}>
              {Math.abs(drift) <= 60
                ? `Los macros cuadran con tu meta (${Math.round(kcalMacros).toLocaleString('es-MX')} kcal).`
                : drift > 0
                  ? `Tus macros suman ${drift.toLocaleString('es-MX')} kcal por encima de la meta.`
                  : `Tus macros suman ${Math.abs(drift).toLocaleString('es-MX')} kcal por debajo de la meta.`}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={s.recalc} onPress={recalcular} activeOpacity={0.8}>
          <ZIcon name="target" size={15} color={N.w2} weight={1.9} />
          <Text style={s.recalcTxt}>Recalcular desde mi perfil</Text>
        </TouchableOpacity>

        <Tap onPress={save} busy={saving} />
      </ScrollView>
    </Screen>
  )
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function Section({ title, note }: { title: string; note?: string }) {
  return (
    <View style={s.sec}>
      <Text style={s.secTitle}>{title}</Text>
      {!!note && <Text style={s.secNote}>{note}</Text>}
    </View>
  )
}

function DialCard({
  icon, title, sub, value, unit, readout, max, step, presets, onChange, onArrastre,
}: {
  icon: ZIconName
  title: string
  sub: string
  value: number
  unit: string
  readout: string
  max: number
  step: number
  presets: number[]
  onChange: (v: number) => void
  /** Sube a la pantalla para que deje de desplazarse mientras se gira el dial. */
  onArrastre: (activo: boolean) => void
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={s.cardMark}>
          <ZIcon name={icon} size={14} color={N.red} weight={1.8} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSub}>{sub}</Text>
        </View>
        <Text style={s.cardValue}>
          {Math.round(value).toLocaleString('es-MX')}<Text style={s.cardUnit}> {unit}</Text>
        </Text>
      </View>

      <View style={s.readout}>
        <Text style={s.readoutNum}>{Math.round(value).toLocaleString('es-MX')}</Text>
        <Text style={s.readoutLbl}>{readout.toUpperCase()}</Text>
      </View>

      <PortionDial
        value={value}
        max={max}
        step={step}
        unit={unit}
        unitLabel={unit}
        presets={presets}
        onChange={onChange}
        onArrastre={onArrastre}
      />
    </View>
  )
}

function Leg({ tone, label }: { tone: string; label: string }) {
  return (
    <View style={s.legItem}>
      <View style={[s.legDot, { backgroundColor: tone }]} />
      <Text style={s.legTxt}>{label}</Text>
    </View>
  )
}

function Tap({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  return (
    <View style={s.saveWrap}>
      <Text
        style={[s.save, busy && s.saveBusy]}
        onPress={busy ? undefined : onPress}
        suppressHighlighting
      >
        {busy ? '' : 'Guardar metas'}
      </Text>
      {busy && <ActivityIndicator color="#fff" style={s.saveSpin} />}
    </View>
  )
}

const s = StyleSheet.create({
  pista: { fontSize: 12, lineHeight: 17, color: N.w3, marginTop: 4, marginBottom: 12 },
  comidasFila: { flexDirection: 'row', gap: 8 },
  comidaBtn: {
    flex: 1, height: 48, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: N.edge,
    alignItems: 'center', justifyContent: 'center',
  },
  comidaBtnOn: { backgroundColor: 'rgba(255,31,61,0.18)', borderColor: N.red },
  comidaTxt: { fontSize: 17, fontWeight: '800', color: N.w2 },
  comidaTxtOn: { color: N.white },
  recalc: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 16, height: 46, borderRadius: 14,
    borderWidth: 1, borderColor: N.edge, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  recalcTxt: { fontSize: 13.5, fontWeight: '700', color: N.w2 },

  sec: {
    flexDirection: 'row', alignItems: 'baseline',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 11,
  },
  secTitle: { fontFamily: Typography.fontFamily.display,
    flex: 1, fontSize: 12, fontWeight: '800', letterSpacing: 2,
    textTransform: 'uppercase', color: N.white,
  },
  secNote: { fontSize: 10.5, color: N.w3, fontVariant: ['tabular-nums'] },

  card: {
    marginHorizontal: 20, marginBottom: 10, padding: 15,
    borderRadius: 20, backgroundColor: N.pane,
    borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardMark: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: N.paneHi, borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  cardTitle: { fontFamily: Typography.fontFamily.display,
    fontSize: 12.5, fontWeight: '800', letterSpacing: 1.1,
    textTransform: 'uppercase', color: N.white,
  },
  cardSub: { fontSize: 10.5, color: N.w3, marginTop: 1 },
  cardValue: { fontFamily: Typography.fontFamily.display, fontSize: 16, fontWeight: '800', color: N.white, fontVariant: ['tabular-nums'] },
  cardUnit: { fontFamily: Typography.fontFamily.display, fontSize: 10.5, fontWeight: '700', color: N.w3 },

  readout: { alignItems: 'center', paddingTop: 12, paddingBottom: 2 },
  readoutNum: { fontFamily: Typography.fontFamily.display,
    fontSize: 40, fontWeight: '800', color: N.white,
    letterSpacing: -1, fontVariant: ['tabular-nums'],
  },
  readoutLbl: { fontFamily: Typography.fontFamily.display,
    fontSize: 8.5, fontWeight: '800', letterSpacing: 2.3,
    color: N.w3, marginTop: 6,
  },

  note: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    marginHorizontal: 20, marginTop: 4, padding: 12,
    borderRadius: 12, backgroundColor: N.paneHi,
    borderWidth: StyleSheet.hairlineWidth, borderColor: N.edge,
  },
  noteTxt: { flex: 1, fontSize: 11.5, lineHeight: 17, color: N.w3 },
  noteB: { color: N.w2, fontWeight: '700' },

  splitLbl: { fontFamily: Typography.fontFamily.display,
    fontSize: 8.5, fontWeight: '800', letterSpacing: 2,
    color: N.w3, marginBottom: 10,
  },
  splitBar: { flexDirection: 'row', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden' },
  splitSeg: { height: '100%' },
  splitLeg: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legDot: { width: 7, height: 7, borderRadius: 2 },
  legTxt: { fontFamily: Typography.fontFamily.display, fontSize: 10.5, color: N.w3 },

  drift: {
    marginTop: 12, padding: 10, borderRadius: 10,
    backgroundColor: N.paneHi,
  },
  driftOff: { backgroundColor: N.redDim },
  driftTxt: { fontSize: 11, lineHeight: 16, color: N.w3 },
  driftTxtOff: { color: N.w2 },

  saveWrap: {
    marginHorizontal: 20, marginTop: 18,
    borderRadius: 16, backgroundColor: N.red,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 52,
  },
  save: { fontFamily: Typography.fontFamily.display,
    paddingVertical: 17, textAlign: 'center',
    fontSize: 13, fontWeight: '800', letterSpacing: 1.6,
    textTransform: 'uppercase', color: '#fff',
  },
  saveBusy: { opacity: 0 },
  saveSpin: { position: 'absolute' },
})
