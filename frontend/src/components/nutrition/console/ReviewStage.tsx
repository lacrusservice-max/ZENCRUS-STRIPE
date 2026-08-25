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
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native'
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

/** Los cinco números que se pueden escribir a mano. */
type CampoMacro = 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber'

/**
 * FIJAR UN MACRO A MANO
 * ═════════════════════
 * Escribe el valor Y REESCRIBE LA BASE. Los dos, siempre.
 *
 * ── Por qué, y qué pasaba antes ─────────────────────────────────────────────
 * Un alimento que la IA no reconoce llega aquí con los macros en cero. El panel
 * de Lista lo dice por escrito —«se marca por estimar y se completa en
 * revisión»—, pero en revisión no había con qué completarlo: el único control
 * era el dial de porción, y `rescale` multiplica sobre `_base`. Con la base en
 * cero, cero por lo que sea sigue siendo cero. Por mucho que se girara el dial,
 * el alimento se quedaba en 0 kcal para siempre y entraba así en el diario.
 *
 * El agujero se abrió al retirar el panel de entrada manual, que era la única
 * pantalla de la app con campos de macros. Esto lo devuelve donde hace falta.
 *
 * La base se ancla a la CANTIDAD ACTUAL, no a la original: si alguien ya movió
 * el dial a 150 g y entonces teclea 300 kcal, está diciendo que sus 150 g son
 * 300 kcal. Anclarlo a la cantidad de origen convertiría eso en otra cifra
 * distinta en cuanto tocara el dial otra vez.
 */
function fijarMacro(d: Draft, campo: CampoMacro, valor: number): Draft {
  const v = campo === 'calories' ? Math.round(valor) : r1(valor)
  return {
    ...d,
    [campo]: v,
    _base: { ...d._base, amount: d.amount || 1, [campo]: v },
  }
}

/** Un alimento que llegó sin energía: hay que ponerle un número. */
const porEstimar = (d: Draft) => d.calories <= 0

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
  /* Mientras se gira un dial, esta lista no se desplaza. En iOS es lo único que
     lo impide: el UIScrollView cancela por su cuenta los toques que empiezan en
     una vista hija. Ver la nota del gesto en `PortionDial`. */
  const [arrastrando, setArrastrando] = useState(false)

  const totals = useMemo(() => drafts.reduce(
    (a, d) => ({
      kcal: a.kcal + d.calories,
      prot: a.prot + d.protein,
      carbs: a.carbs + d.carbs,
      fat: a.fat + d.fat,
    }),
    { kcal: 0, prot: 0, carbs: 0, fat: 0 },
  ), [drafts])

  /*
   * LA ESCALA CRECE PARA QUE EL EXCESO QUEPA
   *
   * Antes el segundo tramo se medía como «lo que sobra del carril»
   * (`Math.min(1 - basePct, …)`). Eso lo estrangulaba justo en el caso para el
   * que existe: al llegar lo consumido al presupuesto, su ancho valía cero y el
   * medidor se pintaba entero del gris de fondo mientras el texto de al lado
   * decía «excede el presupuesto». El único tramo que puede avisar del exceso
   * desaparecía exactamente cuando había exceso.
   *
   * Ahora la escala es lo previsto —lo comido más lo que estás a punto de
   * apuntar— o el presupuesto, lo que sea mayor. Así el rojo siempre tiene
   * sitio donde dibujarse, y cuánto ocupa dice cuánto te pasas.
   */
  const free = Math.max(0, dailyTarget - dailyConsumed)
  const over = totals.kcal > free
  const escala = Math.max(dailyTarget, dailyConsumed + totals.kcal)
  const basePct = escala > 0 ? dailyConsumed / escala : 0
  const addPct = escala > 0 ? totals.kcal / escala : 0

  /** Los que la captura no supo poner en números. */
  const sinEnergia = drafts.filter(porEstimar)

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
            over={addPct}
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

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!arrastrando}
      >
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
                    onArrastre={setArrastrando}
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

      {/*
        NO SE BLOQUEA, SE DICE.

        Registrar algo a cero es legítimo —el agua, un café solo, un té— así que
        el botón sigue vivo: la app no decide por nadie. Lo que no puede pasar
        es que un alimento que la IA no supo leer se cuele en el día como un
        cero sin que se note, y luego cuadre uno el déficit sobre esa cifra.
      */}
      {sinEnergia.length > 0 && (
        <View style={s.faltan}>
          <ZIcon name="warning" size={13} color={CT.signal} weight={2} />
          <Text style={s.faltanTxt}>
            {sinEnergia.length === 1
              ? `«${sinEnergia[0].name}» va sin calorías. Ábrelo y ponle sus valores.`
              : `${sinEnergia.length} alimentos van sin calorías. Ábrelos y ponles sus valores.`}
          </Text>
        </View>
      )}

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

function DraftRow({ draft, open, targets, onToggle, onPatch, onArrastre }: {
  draft: Draft
  open: boolean
  targets: { id: string; label: string; icon: ZIconName }[]
  onToggle: () => void
  onPatch: (next: Draft | null) => void
  /** Sube hasta la lista para que deje de desplazarse mientras se gira el dial. */
  onArrastre: (activo: boolean) => void
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
            {/* Sin energía la fila no puede limitarse a decir «0»: eso se lee
                como un dato, no como un hueco. */}
            {porEstimar(draft)
              ? <Text style={s.rowFalta}>Falta ponerle las calorías</Text>
              : <Text style={s.rowSub}>{r1(draft.amount)} {draft.unit}</Text>}
          </View>
          {porEstimar(draft)
            ? <View style={s.avisoPunto}><ZIcon name="warning" size={12} color={CT.signal} weight={2} /></View>
            : <Text style={s.rowKcal}>{Math.round(draft.calories)}</Text>}
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
                onArrastre={onArrastre}
              />
            </View>

            <View style={s.macroList}>
              <MacroBar label="Proteína" value={draft.protein} max={60} tone={CT.ink} />
              <MacroBar label="Carbos" value={draft.carbs} max={90} tone={CT.signal} />
              <MacroBar label="Grasas" value={draft.fat} max={40} tone={CT.ink3} />
              <MacroBar label="Fibra" value={draft.fiber} max={30} tone={CT.ink4} />
            </View>
          </View>

          {/* ── A mano ──
              Abierto de par en par cuando falta la energía, plegado cuando ya
              hay cifras: quien viene del catálogo no necesita ver cinco campos,
              pero tiene que poder abrirlos. Control manual total, que es la
              regla de la casa. */}
          <Manual draft={draft} onPatch={onPatch} />

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

// ── Macros a mano ─────────────────────────────────────────────────────────────

const CAMPOS: { id: CampoMacro; label: string; sufijo: string }[] = [
  { id: 'calories', label: 'Calorías', sufijo: 'kcal' },
  { id: 'protein',  label: 'Proteína', sufijo: 'g' },
  { id: 'carbs',    label: 'Carbos',   sufijo: 'g' },
  { id: 'fat',      label: 'Grasas',   sufijo: 'g' },
  { id: 'fiber',    label: 'Fibra',    sufijo: 'g' },
]

function Manual({ draft, onPatch }: { draft: Draft; onPatch: (d: Draft) => void }) {
  const falta = porEstimar(draft)
  const [abierto, setAbierto] = useState(falta)

  /* De los macros salen unas kcal; el alimento declara otras. Cuando no
     cuadran, quien manda es lo que la persona escribió — aquí solo se dice,
     no se corrige por su cuenta. */
  const deMacros = draft.protein * 4 + draft.carbs * 4 + draft.fat * 9
  const desvio = draft.calories > 0 ? Math.abs(deMacros - draft.calories) / draft.calories : 0
  const descuadra = !falta && deMacros > 0 && desvio > 0.15

  if (!abierto) {
    return (
      <Tap onPress={() => setAbierto(true)} scaleTo={0.98} haptic="light">
        <View style={s.manualAbrir}>
          <ZIcon name="pen" size={12} color={CT.ink3} weight={1.9} />
          <Text style={s.manualAbrirTxt}>Escribir los macros a mano</Text>
        </View>
      </Tap>
    )
  }

  return (
    <View style={s.manual}>
      <Text style={legend}>{falta ? 'Ponle sus valores' : 'A mano'}</Text>

      {falta && (
        <Text style={s.manualNota}>
          No reconocimos «{draft.name}». Sin calorías entraría en tu día como un
          cero, y el resto de la pantalla contaría mal.
        </Text>
      )}

      <View style={s.manualGrid}>
        {CAMPOS.map(c => (
          <CampoNum
            key={c.id}
            label={c.label}
            sufijo={c.sufijo}
            valor={draft[c.id]}
            destacado={c.id === 'calories' && falta}
            onChange={v => onPatch(fijarMacro(draft, c.id, v))}
          />
        ))}
      </View>

      {descuadra && (
        <View style={s.descuadre}>
          <ZIcon name="warning" size={12} color={CT.signalSoft} weight={1.9} />
          <Text style={s.descuadreTxt}>
            Tus macros suman {Math.round(deMacros)} kcal, no {Math.round(draft.calories)}.
          </Text>
        </View>
      )}
    </View>
  )
}

/**
 * Campo numérico.
 *
 * Guarda su propio texto mientras está enfocado. Sin eso, teclear «12.» se
 * convertía en 12 y el punto desaparecía bajo el dedo; y borrar el contenido
 * para escribir otra cifra ponía un 0 delante que había que quitar antes.
 */
function CampoNum({ label, sufijo, valor, destacado, onChange }: {
  label: string
  sufijo: string
  valor: number
  destacado?: boolean
  onChange: (v: number) => void
}) {
  const [texto, setTexto] = useState<string | null>(null)
  const mostrado = texto ?? (valor > 0 ? String(r1(valor)) : '')

  return (
    <View style={s.campo}>
      <Text style={s.campoLbl}>{label}</Text>
      <View style={[s.campoCaja, destacado && s.campoCajaOjo]}>
        <TextInput
          style={[s.campoTxt, numeral as object]}
          value={mostrado}
          onChangeText={t => {
            // Coma decimal: en el teclado español es la tecla que sale.
            const limpio = t.replace(',', '.').replace(/[^0-9.]/g, '')
            setTexto(limpio)
            const n = parseFloat(limpio)
            onChange(Number.isFinite(n) ? n : 0)
          }}
          onBlur={() => setTexto(null)}
          placeholder="0"
          placeholderTextColor={CT.ink4}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text style={s.campoSuf}>{sufijo}</Text>
      </View>
    </View>
  )
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
  rowFalta: { fontSize: 10.5, color: CT.signalSoft, marginTop: 2, fontWeight: '600' },
  avisoPunto: {
    width: 24, height: 24, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: CT.signalWash,
  },

  // A mano
  manualAbrir: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 36, borderRadius: CT.r.sm, backgroundColor: CT.panel,
  },
  manualAbrirTxt: { fontSize: 11.5, fontWeight: '700', color: CT.ink3 },
  manual: { padding: 12, borderRadius: CT.r.sm, backgroundColor: CT.panelHot, gap: 10 },
  manualNota: { fontSize: 11.5, color: CT.ink2, lineHeight: 16.5 },
  manualGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  campo: { flexGrow: 1, flexBasis: '30%', minWidth: 92 },
  campoLbl: {
    fontSize: 8.5, fontWeight: '800', letterSpacing: 1.3,
    color: CT.ink4, marginBottom: 5, textTransform: 'uppercase',
  },
  campoCaja: {
    height: 42, paddingHorizontal: 11, borderRadius: CT.r.xs,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CT.panel,
    borderWidth: 1, borderColor: 'transparent',
  },
  campoCajaOjo: { borderColor: CT.signalEdge, backgroundColor: CT.signalWash },
  campoTxt: { flex: 1, minWidth: 0, fontSize: 15, color: CT.ink, padding: 0 },
  campoSuf: { fontSize: 9, fontWeight: '800', color: CT.ink4, letterSpacing: 0.5 },

  descuadre: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  descuadreTxt: { flex: 1, fontSize: 11, color: CT.ink3, lineHeight: 15.5 },

  faltan: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginHorizontal: 18, marginBottom: 4, padding: 11,
    borderRadius: CT.r.sm, backgroundColor: CT.signalWash,
    borderWidth: 1, borderColor: CT.signalEdge,
  },
  faltanTxt: { flex: 1, fontSize: 11.5, color: CT.ink2, lineHeight: 16 },

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
