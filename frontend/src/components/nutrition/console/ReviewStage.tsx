/**
 * ETAPA · REVISIÓN
 * ────────────────
 * Última parada antes de escribir en el día. Todo lo capturado se agrupa por
 * comida y sigue siendo editable: cantidad, comida destino y permanencia.
 *
 * No es un modal: es una etapa dentro de la misma consola. Esa decisión es
 * deliberada — montar un `Modal` dentro de otro y cerrarlos en el mismo
 * fotograma deja en iOS un controlador huérfano y la pantalla se queda en
 * negro bloqueando los toques. Con una sola capa, ese fallo no puede existir.
 */

import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { FoodEntry } from '@/store/nutritionStore'
import { emojiForFood } from '@/data/foodEmoji'
import { CT, numeral, legend } from './tokens'
import { Tap, Meter, PrimaryAction, Blank, Bracket } from './parts'
import { PortionDial } from '@/components/nutrition/PortionDial'

/** Entrada en revisión: conserva su base para poder reescalar sin perder precisión. */
export interface Draft extends FoodEntry {
  _mealId: string
  _base: { amount: number; calories: number; protein: number; carbs: number; fat: number; fiber: number }
}

export function toDraft(entry: FoodEntry, mealId: string): Draft {
  return {
    ...entry,
    _mealId: mealId,
    _base: {
      amount: entry.amount || 1,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      fiber: entry.fiber,
    },
  }
}

function rescale(d: Draft, amount: number): Draft {
  const f = d._base.amount > 0 ? amount / d._base.amount : 1
  return {
    ...d,
    amount,
    calories: Math.round(d._base.calories * f),
    protein: r1(d._base.protein * f),
    carbs: r1(d._base.carbs * f),
    fat: r1(d._base.fat * f),
    fiber: r1(d._base.fiber * f),
  }
}

interface ReviewStageProps {
  drafts: Draft[]
  targets: { id: string; label: string; icon: ZIconName }[]
  dailyConsumed: number
  dailyTarget: number
  bottomInset: number
  onChange: (drafts: Draft[]) => void
  onAddMore: (mealId: string) => void
  onCommit: (byMeal: Record<string, FoodEntry[]>) => void
}

export function ReviewStage({
  drafts, targets, dailyConsumed, dailyTarget, bottomInset, onChange, onAddMore, onCommit,
}: ReviewStageProps) {
  const [open, setOpen] = useState<string | null>(null)

  const totals = useMemo(() => drafts.reduce(
    (a, d) => ({
      kcal: a.kcal + d.calories,
      prot: a.prot + d.protein,
      carbs: a.carbs + d.carbs,
      fat: a.fat + d.fat,
    }),
    { kcal: 0, prot: 0, carbs: 0, fat: 0 },
  ), [drafts])

  const free = Math.max(0, dailyTarget - dailyConsumed)
  const over = totals.kcal > free
  const basePct = dailyTarget > 0 ? Math.min(dailyConsumed / dailyTarget, 1) : 0
  const addPct = dailyTarget > 0 ? Math.min(totals.kcal / dailyTarget, 1 - basePct) : 0

  const patch = (id: string, next: Draft | null) => {
    onChange(next
      ? drafts.map(d => d.id === id ? next : d)
      : drafts.filter(d => d.id !== id))
  }

  const commit = () => {
    const byMeal: Record<string, FoodEntry[]> = {}
    for (const t of targets) byMeal[t.id] = []
    for (const d of drafts) {
      const { _mealId, _base, ...entry } = d
      ;(byMeal[_mealId] ??= []).push(entry)
    }
    onCommit(byMeal)
  }

  return (
    <View style={s.root}>
      {/* Instrumento de totales */}
      <View style={s.hud}>
        <View style={s.hudTop}>
          <View>
            <Text style={[numeral, { fontSize: 38, lineHeight: 41 }]}>{Math.round(totals.kcal)}</Text>
            <Text style={legend}>kcal a registrar</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[numeral, { fontSize: 19, color: over ? CT.signalSoft : CT.ink2 }]}>
              {over ? `+${Math.round(totals.kcal - free)}` : Math.round(free - totals.kcal)}
            </Text>
            <Text style={legend}>{over ? 'kcal de más' : 'kcal libres'}</Text>
          </View>
        </View>

        <View style={{ marginTop: 13 }}>
          <Meter
            pct={basePct}
            over={over ? 1 - basePct : addPct}
            tone={CT.ink4}
            spillTone={over ? CT.signal : CT.ink}
          />
        </View>

        <View style={s.hudMacros}>
          <Split label="Proteína" value={totals.prot} />
          <View style={s.hudSep} />
          <Split label="Carbos" value={totals.carbs} />
          <View style={s.hudSep} />
          <Split label="Grasas" value={totals.fat} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {targets.map(t => {
          const group = drafts.filter(d => d._mealId === t.id)
          if (group.length === 0) return null
          const kcal = Math.round(group.reduce((a, d) => a + d.calories, 0))

          return (
            <Animated.View key={t.id} layout={LinearTransition.duration(220)} style={s.group}>
              <View style={s.groupHead}>
                <View style={s.groupMark}>
                  <ZIcon name={t.icon} size={14} color={CT.ink} weight={1.7} />
                </View>
                <Text style={s.groupLbl}>{t.label}</Text>
                <Text style={s.groupKcal}>{kcal} kcal</Text>
              </View>

              <View style={s.groupBody}>
                {group.map(d => (
                  <DraftRow
                    key={d.id}
                    draft={d}
                    open={open === d.id}
                    targets={targets}
                    onToggle={() => setOpen(open === d.id ? null : d.id)}
                    onPatch={next => patch(d.id, next)}
                  />
                ))}

                <Tap onPress={() => onAddMore(t.id)} scaleTo={0.98}>
                  <View style={s.more}>
                    <ZIcon name="plus" size={13} color={CT.signal} weight={2.1} />
                    <Text style={s.moreTxt}>Añadir más a {t.label.toLowerCase()}</Text>
                  </View>
                </Tap>
              </View>
            </Animated.View>
          )
        })}

        {drafts.length === 0 && (
          <Blank
            icon="stack"
            title="No queda nada por registrar"
            note="Vuelve atrás para capturar alimentos."
          />
        )}
      </ScrollView>

      <PrimaryAction
        label={drafts.length > 0
          ? `Registrar ${drafts.length} ${drafts.length === 1 ? 'alimento' : 'alimentos'}`
          : 'Nada que registrar'}
        icon="check"
        onPress={commit}
        disabled={drafts.length === 0}
        bottomInset={bottomInset}
      />
    </View>
  )
}

// ── Fila editable ─────────────────────────────────────────────────────────────

function DraftRow({ draft, open, targets, onToggle, onPatch }: {
  draft: Draft
  open: boolean
  targets: { id: string; label: string; icon: ZIconName }[]
  onToggle: () => void
  onPatch: (next: Draft | null) => void
}) {
  const dial = dialRange(draft)

  return (
    <Animated.View layout={LinearTransition.duration(200)} style={[s.row, open && s.rowOpen]}>
      <Tap onPress={onToggle} scaleTo={open ? 1 : 0.99} haptic="light">
        <View style={s.rowHead}>
          {/* Lo capturado por lista o escáner puede no traer emoji: se deduce
              del nombre para que la revisión no muestre huecos. */}
          <Text style={s.rowEmoji}>{draft.emoji ?? emojiForFood(draft.name)}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.rowName} numberOfLines={1}>{draft.name}</Text>
            <Text style={s.rowSub}>{r1(draft.amount)} {draft.unit}</Text>
          </View>
          <Text style={s.rowKcal}>{Math.round(draft.calories)}</Text>
          <ZIcon name={open ? 'chevronUp' : 'chevronDown'} size={13} color={CT.ink3} weight={1.9} />
        </View>
      </Tap>

      {open && (
        <Animated.View entering={FadeIn.duration(160)} style={s.rowBody}>
          <Bracket inset={-1} len={9} />

          {/* Dial de porción: mismo control que en el resto de la app */}
          <View style={s.dialBlock}>
            <Text style={[numeral, { fontSize: 34, lineHeight: 36 }]}>
              {Math.round(draft.calories)}
            </Text>
            <Text style={legend}>kcal en {r1(draft.amount)} {draft.unit}</Text>

            <View style={{ marginTop: 8 }}>
              <PortionDial
                value={draft.amount}
                max={dial.max}
                step={dial.step}
                unit={draft.unit}
                unitLabel={dial.label}
                presets={dial.presets}
                onChange={next => onPatch(rescale(draft, Math.max(dial.step, next)))}
              />
            </View>

            <View style={s.macroList}>
              <MacroBar label="Proteína" value={draft.protein} max={60} tone={CT.ink} />
              <MacroBar label="Carbos" value={draft.carbs} max={90} tone={CT.signal} />
              <MacroBar label="Grasas" value={draft.fat} max={40} tone={CT.ink3} />
              <MacroBar label="Fibra" value={draft.fiber} max={30} tone={CT.ink4} />
            </View>
          </View>

          <View style={s.rowCtrl}>
            <Text style={legend}>Mover a</Text>
            <View style={s.moveRow}>
              {targets.map(t => {
                const on = t.id === draft._mealId
                return (
                  <Tap key={t.id} onPress={() => onPatch({ ...draft, _mealId: t.id })} scaleTo={0.9} haptic="none">
                    <View style={[s.move, on && s.moveOn]}>
                      <ZIcon name={t.icon} size={12} color={on ? CT.ink : CT.ink3} weight={1.7} />
                    </View>
                  </Tap>
                )
              })}
            </View>
          </View>

          <Tap onPress={() => onPatch(null)} scaleTo={0.97} haptic="medium">
            <View style={s.remove}>
              <ZIcon name="trash" size={13} color={CT.signalSoft} weight={1.8} />
              <Text style={s.removeTxt}>Quitar de la lista</Text>
            </View>
          </Tap>
        </Animated.View>
      )}
    </Animated.View>
  )
}

/**
 * Recorrido del dial según la unidad del alimento.
 *
 * El tope no es la porción base sino un múltiplo suyo: el dial debe permitir
 * subir, no solo bajar. Los atajos replican los del catálogo web para que la
 * misma comida ofrezca las mismas cantidades en móvil y en escritorio.
 */
function dialRange(d: Draft): { max: number; step: number; presets: number[]; label: string } {
  const base = d._base.amount > 0 ? d._base.amount : 1

  if (d.unit === 'pza' || d.unit.includes('ación')) {
    return { max: Math.max(4, Math.ceil(base) * 4), step: 0.25, presets: [1, 2, 3, 4], label: 'piezas' }
  }
  if (base >= 100) {
    return { max: 400, step: 5, presets: [30, 50, 100, 150], label: unitWord(d.unit) }
  }
  if (base >= 30) {
    return { max: 300, step: 5, presets: [15, 30, 60, 90], label: unitWord(d.unit) }
  }
  const half = Math.round(base / 2)
  return {
    max: Math.max(60, Math.ceil(base) * 5),
    step: 1,
    presets: [half, Math.round(base), Math.round(base * 2), Math.round(base * 3)],
    label: unitWord(d.unit),
  }
}

function unitWord(unit: string) {
  if (unit === 'g') return 'gramos'
  if (unit === 'ml') return 'mililitros'
  return unit
}

function MacroBar({ label, value, max, tone }: {
  label: string; value: number; max: number; tone: string
}) {
  const pct = Math.min(Math.max(value, 0) / max, 1)
  return (
    <View style={s.macroRow}>
      <Text style={s.macroLbl}>{label}</Text>
      <View style={s.macroTrack}>
        <View style={[s.macroFill, { width: `${pct * 100}%`, backgroundColor: tone }]} />
      </View>
      <Text style={s.macroVal}>{r1(value)} g</Text>
    </View>
  )
}

function Split({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.split}>
      <Text style={[numeral, { fontSize: 15 }]}>{Math.round(value)}<Text style={s.splitUnit}>g</Text></Text>
      <Text style={[legend, { fontSize: 8.5 }]}>{label}</Text>
    </View>
  )
}

const r1 = (v: number) => Math.round(v * 10) / 10

const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },

  hud: {
    marginHorizontal: 18, marginTop: 12, padding: 16,
    borderRadius: CT.r.lg, backgroundColor: CT.panel,
  },
  hudTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  hudMacros: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  hudSep: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: CT.hairline },
  split: { flex: 1, alignItems: 'center', gap: 3 },
  splitUnit: { fontSize: 9.5, fontWeight: '700', color: CT.ink3 },

  scroll: { paddingTop: 18, paddingBottom: 20 },

  group: { marginBottom: 18 },
  groupHead: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 18, marginBottom: 9,
  },
  groupMark: {
    width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  groupLbl: { flex: 1, fontSize: 12.5, fontWeight: '800', color: CT.ink, letterSpacing: 0.2 },
  groupKcal: { fontSize: 11.5, fontWeight: '700', color: CT.ink3, fontVariant: ['tabular-nums'] },
  groupBody: { paddingHorizontal: 18, gap: 6 },

  row: { borderRadius: CT.r.sm, backgroundColor: CT.panel, overflow: 'hidden' },
  rowOpen: { backgroundColor: CT.panelHot },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, height: 52 },
  rowEmoji: { fontSize: 16, width: 22, textAlign: 'center' },
  rowName: { fontSize: 13, fontWeight: '700', color: CT.ink },
  rowSub: { fontSize: 10.5, color: CT.ink3, marginTop: 2, fontVariant: ['tabular-nums'] },
  rowKcal: { fontSize: 13, fontWeight: '800', color: CT.ink2, fontVariant: ['tabular-nums'] },

  rowBody: { paddingHorizontal: 13, paddingBottom: 13, gap: 11 },
  rowCtrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },

  // Bloque del dial de porción
  dialBlock: { alignItems: 'center', paddingTop: 4 },
  macroList: { alignSelf: 'stretch', marginTop: 14, gap: 8 },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  macroLbl: { width: 58, fontSize: 11.5, color: CT.ink2 },
  macroTrack: {
    flex: 1, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  macroFill: { height: '100%', borderRadius: 3 },
  macroVal: { width: 52, textAlign: 'right', fontSize: 12, fontWeight: '800', color: CT.ink },

  moveRow: { flexDirection: 'row', gap: 5 },
  move: {
    width: 32, height: 32, borderRadius: CT.r.xs, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  moveOn: { backgroundColor: CT.signalWash },

  remove: {
    height: 36, borderRadius: CT.r.xs, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: CT.signalWash,
  },
  removeTxt: { fontSize: 11.5, fontWeight: '700', color: CT.signalSoft },

  more: {
    height: 40, borderRadius: CT.r.xs, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: StyleSheet.hairlineWidth, borderColor: CT.hairline, borderStyle: 'dashed',
  },
  moreTxt: { fontSize: 11.5, fontWeight: '700', color: CT.ink2 },
})
