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
import { VerifiedSeal } from '@/components/ui/VerifiedSeal'
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
  /* Mientras un dedo gira el dial, la lista NO se desplaza. Es lo único que
     lo impide en iOS: el UIScrollView de debajo cancela por su cuenta los
     toques que empiezan en una vista hija, y eso ocurre en la capa nativa,
     donde el PanResponder de JavaScript no llega. Ver `PortionDial`. */
  const [arrastrando, setArrastrando] = useState(false)

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
        scrollEnabled={!arrastrando}
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
            onArrastre={setArrastrando}
          />
        )}
      />
    </View>
  )
}

// ── Fila de alimento ──────────────────────────────────────────────────────────

function FoodRow({ food, expanded, onToggle, consumed, budget, onCommit, onArrastre }: {
  food: Food
  expanded: boolean
  onToggle: () => void
  consumed: number
  budget: number
  onCommit: (entry: FoodEntry) => void
  /** Sube hasta la lista para que deje de desplazarse mientras se gira el dial. */
  onArrastre: (activo: boolean) => void
}) {
  const [unit, setUnit] = useState(food.defaultUnit)
  const [amount, setAmount] = useState(food.defaultAmount)

  const options = unitsFor(unit, food.gramsPerPiece)
  const macros = scaleMacros(food.per100, amount, unit, food.gramsPerPiece)
  const step = stepFor(unit)

  /**
   * TOPE DEL DIAL — Y POR QUÉ NO SALE DE `amount`
   * ═════════════════════════════════════════════
   * Sale del atajo más alto de la unidad, duplicado, para que el recorrido deje
   * margen por encima de la porción habitual sin volverse inmanejable: con
   * 100 g de referencia el arco llega a 300 g, no a 5 kg.
   *
   * ── La cifra que se escapaba sola ───────────────────────────────────────────
   * Aquí ponía `Math.max(...presetsFor(unit), amount)`, con la cantidad EN VIVO
   * dentro. Eso es una pescadilla que se muerde la cola: al llevar el dial al
   * tope, `amount` iguala a `dialMax`; en el siguiente fotograma `dialMax` pasa
   * a valer `amount * 1.5`, o sea más; y como el dedo sigue apoyado en el
   * extremo, el siguiente evento del MISMO arrastre vuelve a marcar el 100 % —
   * del tope nuevo. Medido en el simulador: 280 g → 420 → 630 en un solo gesto,
   * con el knob quieto en el sitio y el número disparándose.
   *
   * Se veía poco porque llegar al extremo pedía un arrastre casi vertical, y
   * esos se los quedaba el scroll (ver `PortionDial`). Arreglado aquello, esto
   * quedó a un dedo de distancia.
   *
   * El anclaje es la porción POR DEFECTO del alimento, que no cambia mientras
   * se arrastra. Y solo cuenta si la unidad sigue siendo la suya: `defaultAmount`
   * está expresado en `defaultUnit`, así que colarlo al pasar a kilos pondría el
   * tope en 280 kg.
   */
  const anclaje = unit === food.defaultUnit ? food.defaultAmount : 0
  const dialMax = Math.max(...presetsFor(unit), anclaje) * 1.5

  /** Al cambiar de unidad se reencuadra la cantidad: 250 g no son 250 lb. */
  const switchUnit = (next: string) => {
    if (next === unit) return
    const presets = presetsFor(next)
    setUnit(next)
    setAmount(presets[Math.floor(presets.length / 2)])
  }

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
  const escala = Math.max(budget, consumed + macros.calories)
  const basePct = escala > 0 ? consumed / escala : 0
  const addPct = escala > 0 ? macros.calories / escala : 0
  const over = budget > 0 && consumed + macros.calories > budget

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={s.row}>
      {/* Filo encendido a la izquierda: marca la fila como tocable sin rodearla
          de neón, que a veinte resultados en pantalla sería demasiado ruido. */}
      <View style={[s.edge, expanded && s.edgeOn]} pointerEvents="none" />

      <Tap onPress={onToggle} scaleTo={0.99}>
        <View style={s.rowHead}>
          <View>
            {food.imageUrl
              ? <Image source={{ uri: food.imageUrl }} style={s.thumb} />
              : <View style={s.emojiBox}><Text style={s.emoji}>{food.emoji}</Text></View>}

            {/* El sello va montado en la esquina de la miniatura. En la línea
                del nombre gastaba 29 px y truncaba los nombres corrientes;
                aquí no cuesta ancho y es donde se espera una insignia. */}
            {food.verified && (
              <View style={s.sealSlot}>
                <VerifiedSeal size={16} color={CT.ink} checkColor={CT.base} />
              </View>
            )}
          </View>

          {/* Sin `numberOfLines`: el nombre nunca se recorta. Los largos —hay
              alimentos de 96 caracteres— reparten en varias líneas y la fila
              crece con ellos. Por eso la miniatura se alinea arriba. */}
          <Text style={s.name}>{food.name}</Text>

          {/* Las kilocalorías NO salen aquí: dependen de la porción, y la
              porción se elige abajo. Enseñar el valor por 100 g en la lista
              solo invita a confundirlo con lo que se va a registrar. */}
          <View style={[s.plusRing, expanded && s.plusRingOn]}>
            <ZIcon name={expanded ? 'minus' : 'plus'} size={15} color={CT.signal} weight={2.2} />
          </View>
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
            onArrastre={onArrastre}
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
    borderRadius: CT.r.lg, backgroundColor: CT.panel,
    borderWidth: 1, borderColor: CT.hairline, overflow: 'hidden',
  },

  // Filo neón. Va absoluto y sin capturar toques para no partir la fila en dos
  // zonas pulsables; el `Tap` sigue cubriéndola entera.
  edge: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: CT.neonEdgeWidth, backgroundColor: CT.signal,
    // Halo: iOS lo pinta, Android lo ignora y se queda con el filo a secas.
    shadowColor: CT.signal, shadowOpacity: 0.9, shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 1,
  },
  edgeOn: { shadowRadius: 12 },

  // `flex-start`: con un nombre de tres o cuatro líneas, la miniatura centrada
  // quedaría flotando en mitad del bloque.
  rowHead: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingLeft: 16, paddingRight: 12, paddingVertical: 13,
  },
  thumb: { width: 44, height: 44, borderRadius: CT.r.sm, backgroundColor: CT.panelHot },
  emojiBox: {
    width: 44, height: 44, borderRadius: CT.r.sm, backgroundColor: CT.panelHot,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  // El halo del color del fondo despega el sello de la miniatura.
  sealSlot: {
    position: 'absolute', right: -5, bottom: -5,
    borderRadius: 999, backgroundColor: CT.base, padding: 1.5,
  },
  name: {
    // '650' es peso de fuente variable: vale en CSS pero React Native solo
    // admite los múltiplos de 100.
    flex: 1, minWidth: 0, fontSize: 15, fontWeight: '600',
    color: CT.ink, lineHeight: 20, paddingTop: 3,
  },

  // Aro de añadir. El icono va centrado por el contenedor, no por su métrica
  // tipográfica, que es lo que descuadraba el signo dentro del círculo.
  plusRing: {
    width: 34, height: 34, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: CT.neonLine,
    shadowColor: CT.signal, shadowOpacity: 0.55, shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  plusRingOn: { borderColor: CT.neonLineHot, shadowRadius: 10 },

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
  unitTxtOn: { color: '#0D0D10' },

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
