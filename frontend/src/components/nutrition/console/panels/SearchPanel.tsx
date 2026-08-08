/**
 * PANEL · BUSCAR
 * ──────────────
 * Catálogo con báscula en línea. Al elegir un alimento la fila se abre en el
 * sitio en vez de empujar a otra pantalla: se ve la unidad, la porción, el
 * impacto sobre el presupuesto de la comida y el reparto de macros sin perder
 * el contexto de la búsqueda.
 *
 * Los alimentos vienen de Open Food Facts —millones de productos reales— con la
 * base local como respaldo sin conexión. Ese buscador limita las peticiones de
 * forma agresiva, así que no se consulta en cada tecla: se espera a que la
 * persona deje de escribir, y las respuestas se cachean en `@/services/foodApi`.
 */

import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator, Image } from 'react-native'
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { ZIcon } from '@/components/ui/ZencrusIcon'
import { Food, searchFoods } from '@/services/foodApi'
import { FoodEntry } from '@/store/nutritionStore'
import {
  unitsFor, scaleMacros, stepFor, presetsFor, fmtAmount, resolveUnit,
} from '@/utils/units'
import { CT, numeral, legend } from '../tokens'
import { Tap, Meter, Blank } from '../parts'
import { PortionDial } from '@/components/nutrition/PortionDial'

/** Tiempo sin teclear antes de salir a la red. */
const DEBOUNCE = 550

interface SearchPanelProps {
  /** Kcal ya consumidas en la comida destino. */
  consumed: number
  /** Presupuesto de la comida destino. */
  budget: number
  onCommit: (entry: FoodEntry) => void
}

export function SearchPanel({ consumed, budget, onCommit }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [foods, setFoods] = useState<Food[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  // Una búsqueda en vuelo se cancela si llega otra: así la respuesta lenta de
  // una consulta vieja no puede pisar los resultados de la nueva.
  const inflight = useRef<AbortController | null>(null)

  useEffect(() => {
    const wait = query.trim().length < 2 ? 0 : DEBOUNCE
    const t = setTimeout(async () => {
      inflight.current?.abort()
      const ctl = new AbortController()
      inflight.current = ctl
      setLoading(true)
      const res = await searchFoods(query, ctl.signal)
      if (ctl.signal.aborted) return
      setFoods(res.foods)
      setOffline(res.offline)
      setLoading(false)
    }, wait)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => () => inflight.current?.abort(), [])

  return (
    <View style={s.root}>
      <View style={s.searchBox}>
        <ZIcon name="reticle" size={16} color={CT.ink3} weight={1.7} />
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Busca cualquier alimento o marca"
          placeholderTextColor={CT.ink4}
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading
          ? <ActivityIndicator size="small" color={CT.ink3} />
          : query.length > 0 && (
            <Tap onPress={() => setQuery('')} scaleTo={0.9}>
              <ZIcon name="close" size={15} color={CT.ink3} weight={1.7} />
            </Tap>
          )}
      </View>

      {offline && (
        <Animated.View entering={FadeIn.duration(180)} style={s.offline}>
          <Text style={s.offlineTxt}>Sin conexión · mostrando los alimentos básicos</Text>
        </Animated.View>
      )}

      <FlatList
        data={foods}
        keyExtractor={f => f.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={loading ? null : (
          <Blank
            icon="reticle"
            title="Sin resultados"
            note={`No encontramos "${query.trim()}". Prueba con otro nombre o escanea el código de barras.`}
          />
        )}
        renderItem={({ item }) => (
          <FoodRow
            food={item}
            expanded={open === item.id}
            onToggle={() => setOpen(o => (o === item.id ? null : item.id))}
            consumed={consumed}
            budget={budget}
            onCommit={entry => { onCommit(entry); setOpen(null) }}
          />
        )}
      />
    </View>
  )
}

// ── Fila de alimento ──────────────────────────────────────────────────────────

function FoodRow({ food, expanded, onToggle, consumed, budget, onCommit }: {
  food: Food
  expanded: boolean
  onToggle: () => void
  consumed: number
  budget: number
  onCommit: (entry: FoodEntry) => void
}) {
  const [unit, setUnit] = useState(food.defaultUnit)
  const [amount, setAmount] = useState(food.defaultAmount)

  const options = unitsFor(unit, food.gramsPerPiece)
  const macros = scaleMacros(food.per100, amount, unit, food.gramsPerPiece)
  const step = stepFor(unit)

  /**
   * Tope del dial. Sale del atajo más alto de la unidad, duplicado, para que el
   * recorrido deje margen por encima de la porción habitual sin volverse
   * inmanejable: con 100 g de referencia el arco llega a 300 g, no a 5 kg.
   */
  const dialMax = Math.max(...presetsFor(unit), amount) * 1.5

  /** Al cambiar de unidad se reencuadra la cantidad: 250 g no son 250 lb. */
  const switchUnit = (next: string) => {
    if (next === unit) return
    const presets = presetsFor(next)
    setUnit(next)
    setAmount(presets[Math.floor(presets.length / 2)])
  }

  const basePct = budget > 0 ? Math.min(1, consumed / budget) : 0
  const addPct = budget > 0 ? Math.min(1 - basePct, macros.calories / budget) : 0
  const over = budget > 0 && consumed + macros.calories > budget

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={s.row}>
      <Tap onPress={onToggle} scaleTo={0.99}>
        <View style={s.rowHead}>
          {food.imageUrl
            ? <Image source={{ uri: food.imageUrl }} style={s.thumb} />
            : <View style={s.emojiBox}><Text style={s.emoji}>{food.emoji}</Text></View>}

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name} numberOfLines={1}>{food.name}</Text>
            <Text style={s.meta} numberOfLines={1}>
              {food.brand ? `${food.brand} · ` : ''}{food.per100.calories} kcal / 100 g
              {food.verified && food.sourceLabel ? ` · Verificado · ${food.sourceLabel}` : ''}
            </Text>
          </View>

          {food.verified && (
            <View style={s.verified}>
              <ZIcon name="check" size={10} color="#22c55e" weight={2.6} />
            </View>
          )}
          <ZIcon name={expanded ? 'minus' : 'plus'} size={16} color={CT.ink3} weight={1.8} />
        </View>
      </Tap>

      {expanded && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(110)} style={s.body}>
          {/* Báscula: la cifra de energía manda, el dial la gobierna */}
          <View style={s.scale}>
            <Text style={[numeral, s.scaleKcal]}>{macros.calories}</Text>
            <Text style={s.scaleUnit}>
              KCAL EN {fmtAmount(amount)} {resolveUnit(unit).short.toUpperCase()}
            </Text>
          </View>

          <PortionDial
            value={amount}
            max={dialMax}
            step={step}
            unit={resolveUnit(unit).short}
            unitLabel={resolveUnit(unit).label.toLowerCase()}
            presets={presetsFor(unit)}
            onChange={next => setAmount(Math.max(step, next))}
          />

          {/* Unidad como control segmentado: son opciones excluyentes de la
              misma magnitud, no etiquetas sueltas. */}
          <View style={s.units}>
            {options.map(u => {
              const on = u.id === unit
              return (
                <Tap key={u.id} onPress={() => switchUnit(u.id)} scaleTo={0.96} haptic="light">
                  <View style={[s.unit, on && s.unitOn]}>
                    <Text style={[s.unitTxt, on && s.unitTxtOn]}>{u.short.toUpperCase()}</Text>
                  </View>
                </Tap>
              )
            })}
          </View>

          <View style={s.impact}>
            <View style={s.impactHead}>
              <Text style={s.grams}>{macros.grams} g totales</Text>
              <View style={{ flex: 1 }} />
              <Text style={[s.grams, over && { color: CT.signalSoft }]}>
                {over ? 'excede el presupuesto' : 'cabe en la comida'}
              </Text>
            </View>
            <Meter pct={basePct} over={addPct} spillTone={over ? CT.signal : CT.ink} />
            <View style={s.macros}>
              <Macro label="Proteína" value={macros.protein} />
              <Macro label="Carbos" value={macros.carbs} />
              <Macro label="Grasas" value={macros.fat} />
              <Macro label="Fibra" value={macros.fiber} />
            </View>

            {/* De dónde salen las kcal de esta porción */}
            <View style={s.splitBar}>
              <View style={[s.splitSeg, { flex: Math.max(macros.protein * 4, 1), backgroundColor: CT.ink }]} />
              <View style={[s.splitSeg, { flex: Math.max(macros.carbs * 4, 1), backgroundColor: CT.signal }]} />
              <View style={[s.splitSeg, { flex: Math.max(macros.fat * 9, 1), backgroundColor: CT.ink3 }]} />
            </View>
            <View style={s.splitLeg}>
              <Text style={s.splitTxt}>Prot {kcalPct(macros.protein * 4, macros)} %</Text>
              <Text style={s.splitTxt}>Carb {kcalPct(macros.carbs * 4, macros)} %</Text>
              <Text style={s.splitTxt}>Grasa {kcalPct(macros.fat * 9, macros)} %</Text>
            </View>
          </View>

          <Tap
            onPress={() => onCommit({
              id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              timestamp: Date.now(),
              name: food.name,
              calories: macros.calories,
              protein: macros.protein,
              carbs: macros.carbs,
              fat: macros.fat,
              fiber: macros.fiber,
              amount,
              unit,
              active: true,
              emoji: food.emoji,
            })}
            scaleTo={0.97}
            haptic="medium"
          >
            <View style={s.add}>
              <ZIcon name="check" size={15} color="#fff" weight={2.2} />
              <Text style={s.addTxt}>Añadir a la bandeja</Text>
            </View>
          </Tap>
        </Animated.View>
      )}
    </Animated.View>
  )
}

/**
 * Porcentaje de la energía que aporta un macro.
 *
 * Se calcula sobre la suma de los tres y no sobre `calories`: en muchos
 * productos del catálogo las kilocalorías declaradas no cuadran exactamente con
 * los macros, y dividir por ellas haría que los tres porcentajes no sumaran 100.
 */
function kcalPct(part: number, m: { protein: number; carbs: number; fat: number }) {
  const total = m.protein * 4 + m.carbs * 4 + m.fat * 9
  return total > 0 ? Math.round((part / total) * 100) : 0
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.macro}>
      <Text style={[numeral, s.macroVal]}>{value}</Text>
      <Text style={s.macroLbl}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 44, marginHorizontal: 18, paddingHorizontal: 14,
    borderRadius: CT.r.md, backgroundColor: CT.panel,
    borderWidth: 1, borderColor: CT.hairline,
  },
  input: { flex: 1, fontSize: 15, color: CT.ink, padding: 0 },

  offline: { marginHorizontal: 18, marginTop: 8 },
  offlineTxt: { fontSize: 11, color: CT.ink3 },

  list: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 8 },

  row: {
    borderRadius: CT.r.md, backgroundColor: CT.panel,
    borderWidth: 1, borderColor: CT.hairline, overflow: 'hidden',
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  thumb: { width: 38, height: 38, borderRadius: CT.r.xs, backgroundColor: CT.panelHot },
  emojiBox: {
    width: 38, height: 38, borderRadius: CT.r.xs, backgroundColor: CT.panelHot,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 19 },
  name: { fontSize: 14, fontWeight: '700', color: CT.ink },
  meta: { fontSize: 11, color: CT.ink3, marginTop: 2 },
  verified: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },

  body: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  sectionLbl: { marginTop: 4 },

  // Unidad: control segmentado
  units: {
    flexDirection: 'row', gap: 4, padding: 4, marginTop: 12,
    borderRadius: CT.r.pill, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: CT.hairline,
  },
  unit: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: CT.r.pill },
  unitOn: { backgroundColor: CT.ink },
  unitTxt: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1, color: CT.ink3 },
  unitTxtOn: { color: '#0A0A0D' },

  // Reparto calórico
  splitBar: { flexDirection: 'row', gap: 2, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  splitSeg: { height: '100%' },
  splitLeg: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  splitTxt: { fontSize: 9.5, color: CT.ink3 },

  // Báscula: energía como dato dominante, sobre el dial
  scale: { alignItems: 'center', paddingTop: 6 },
  scaleKcal: { fontSize: 44, lineHeight: 46, color: CT.ink },
  scaleUnit: {
    fontSize: 9.5, fontWeight: '800', letterSpacing: 2.4,
    color: CT.ink3, marginTop: 7,
  },

  impact: {
    marginTop: 4, padding: 11, borderRadius: CT.r.sm,
    backgroundColor: CT.panelHot, gap: 9,
  },
  impactHead: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  kcal: { fontSize: 22, color: CT.ink },
  kcalUnit: { fontSize: 12, color: CT.ink3, fontWeight: '700' },
  grams: { fontSize: 11, color: CT.ink3 },
  macros: { flexDirection: 'row', gap: 8 },
  macro: { flex: 1, alignItems: 'center' },
  macroVal: { fontSize: 14, color: CT.ink },
  macroLbl: { fontSize: 9, color: CT.ink4, marginTop: 1 },

  add: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: CT.r.sm, backgroundColor: CT.signal,
  },
  addTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
})
