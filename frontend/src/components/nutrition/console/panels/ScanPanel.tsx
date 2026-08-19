/**
 * PANEL · ESCÁNER
 * ───────────────
 * Dos vías bajo un mismo panel, separadas por submenú:
 *
 *   · Código   — busca el envase por su código de barras en el catálogo
 *   · Foto     — estimación de macros del plato por imagen
 *
 * ── Lo que había aquí antes ─────────────────────────────────────────────────
 * Las dos vías funcionaban de mentira. «Simular lectura» sacaba un código al
 * azar de cinco, y cualquier código tecleado devolvía siempre algo: si no
 * estaba en una lista de nueve productos, el servicio se inventaba un
 * «Producto 3312 · Marca desconocida · 150 kcal» con macros redondos. Y la
 * pestaña de foto esperaba 1,8 segundos con un «Estimando macros…» para
 * devolver uno de cinco platos al azar, sin haber mirado ninguna foto —no hay
 * cámara conectada ni análisis de imagen en ninguna parte del proyecto.
 *
 * Lo grave no era el placeholder: era que esos números se podían añadir a la
 * comida del día con el mismo botón que los reales, y una vez dentro del diario
 * ya no se distinguían. Alguien podía llevar semanas cuadrando un déficit sobre
 * cifras sorteadas.
 *
 * Ahora el código consulta el catálogo de verdad —`getFoodByBarcode`, que es lo
 * que ya usaba el resto de la app— y cuando no hay respuesta lo dice. La foto
 * dice que todavía no sabe hacerlo. Ninguna de las dos rellena el hueco.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ZIcon } from '@/components/ui/ZencrusIcon'
import { VerifiedSeal } from '@/components/ui/VerifiedSeal'
import { Food, getFoodByBarcode } from '@/services/foodApi'
import { scaleMacros, fmtQty } from '@/utils/units'
import { FoodEntry } from '@/store/nutritionStore'
import { CT, numeral, legend } from '../tokens'
import { Tap, Panel, SubTabs, Bracket, Blank } from '../parts'

interface ScanPanelProps {
  onCommit: (entry: FoodEntry) => void
  /** Lleva a la pestaña de búsqueda: es la salida cuando el código no aparece. */
  onBuscar?: () => void
}

export function ScanPanel({ onCommit, onBuscar }: ScanPanelProps) {
  const [tab, setTab] = useState<'codigo' | 'foto'>('codigo')

  return (
    <Panel>
      <SubTabs
        tabs={[{ id: 'codigo', label: 'Código de barras' }, { id: 'foto', label: 'Foto del plato' }]}
        active={tab}
        onSelect={id => setTab(id as 'codigo' | 'foto')}
      />
      {tab === 'codigo'
        ? <BarcodeReader onCommit={onCommit} onBuscar={onBuscar} />
        : <PlateReader onBuscar={onBuscar} />}
    </Panel>
  )
}

// ── Código de barras ──────────────────────────────────────────────────────────

function BarcodeReader({ onCommit, onBuscar }: {
  onCommit: (e: FoodEntry) => void
  onBuscar?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [hit, setHit] = useState<Food | null>(null)
  const [miss, setMiss] = useState<string | null>(null)

  const read = async () => {
    const target = code.replace(/\D/g, '')
    if (!target) return
    setBusy(true); setHit(null); setMiss(null)
    const found = await getFoodByBarcode(target)
    setBusy(false)
    if (found) setHit(found)
    else setMiss(target)
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.viewport}>
        <View style={s.viewportGrid} pointerEvents="none">
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={[s.gridLine, { top: `${(i + 1) * 12.5}%` }]} />
          ))}
        </View>
        <Bracket color={CT.signalEdge} inset={14} len={22} />
        {busy
          ? <ActivityIndicator color={CT.signal} />
          : <ZIcon name="barcode" size={40} color={CT.ink4} weight={1.6} />}
        <Text style={s.viewportTxt}>
          {busy ? 'Buscando en el catálogo…' : 'Teclea los dígitos que hay bajo el código'}
        </Text>
        {/* Sin esta línea el visor se lee como una cámara que no enciende. */}
        {!busy && <Text style={s.viewportNote}>La lectura con cámara aún no está conectada</Text>}
      </View>

      <View style={s.entry}>
        <TextInput
          style={s.entryInput}
          value={code}
          onChangeText={setCode}
          placeholder="7501055300057"
          placeholderTextColor={CT.ink3}
          keyboardType="number-pad"
          returnKeyType="search"
          onSubmitEditing={read}
        />
        <Tap onPress={read} disabled={busy || !code.trim()} scaleTo={0.94}>
          <View style={[s.entryBtn, (busy || !code.trim()) && s.entryBtnOff]}>
            <ZIcon name="reticle" size={15} color={CT.ink} weight={1.9} />
          </View>
        </Tap>
      </View>

      {miss && (
        <Animated.View entering={FadeInDown.duration(220)}>
          <Blank
            icon="warning"
            title={`El ${miss} no está en el catálogo`}
            note="El catálogo son alimentos genéricos de fuentes oficiales, no productos de marca, así que casi ningún envase tiene ficha todavía. Búscalo por su nombre."
          />
          {onBuscar && (
            <Tap onPress={onBuscar} scaleTo={0.98}>
              <View style={s.salida}>
                <ZIcon name="arrowRight" size={14} color={CT.ink} weight={1.9} />
                <Text style={s.salidaTxt}>Buscar por nombre</Text>
              </View>
            </Tap>
          )}
        </Animated.View>
      )}

      {hit && (
        <Animated.View entering={FadeInDown.duration(260)}>
          <ResultCard food={hit} onCommit={onCommit} />
        </Animated.View>
      )}
    </ScrollView>
  )
}

// ── Foto del plato ────────────────────────────────────────────────────────────

/**
 * No hay nada que ejecutar aquí, y ese es el punto.
 *
 * No existe reconocimiento de imagen en el proyecto: ni en el móvil, ni en el
 * servidor. Un botón «Analizar plato» que devolviera algo solo podría estar
 * devolviendo un invento, que es exactamente lo que hacía. Mientras no haya
 * modelo detrás, la pestaña explica qué falta y ofrece las dos vías que sí
 * miden de verdad.
 */
function PlateReader({ onBuscar }: { onBuscar?: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.viewport}>
        <Bracket color={CT.edge} inset={14} len={22} />
        <ZIcon name="aperture" size={40} color={CT.ink4} weight={1.5} />
        <Text style={s.viewportTxt}>Todavía no sé leer un plato</Text>
      </View>

      <View style={s.explica}>
        <Text style={s.explicaTxt}>
          Reconocer la comida de una foto y calcular sus macros necesita un modelo
          de visión que aún no está conectado. Hasta que lo esté, esta pestaña no
          va a devolver un número: prefiero decírtelo a darte una cifra inventada
          que acabaría en tu diario mezclada con las buenas.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
        <Text style={legend}>Mientras tanto</Text>
      </View>

      {onBuscar && (
        <Tap onPress={onBuscar} scaleTo={0.98}>
          <View style={s.salida}>
            <ZIcon name="arrowRight" size={14} color={CT.ink} weight={1.9} />
            <Text style={s.salidaTxt}>Buscar el alimento por nombre</Text>
          </View>
        </Tap>
      )}
    </ScrollView>
  )
}

// ── Ficha de resultado ────────────────────────────────────────────────────────

/**
 * La ficha ya no lleva semáforo de salud.
 *
 * El verde/amarillo/rojo salía de una lista de palabras clave («refresco» es
 * rojo, «pollo» es verde) que ni el catálogo ni el servidor conocen: era una
 * opinión de la app disfrazada de dato del producto. En su sitio va la
 * procedencia real —el sello y el nombre de la fuente— que es información que
 * sí existe y que además dice cuánto fiarse de los macros de al lado.
 */
function ResultCard({ food, onCommit }: { food: Food; onCommit: (e: FoodEntry) => void }) {
  const amount = food.defaultAmount
  const unit = food.defaultUnit
  const macros = scaleMacros(food.per100, amount, unit, food.gramsPerPiece)

  const commit = () => onCommit({
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
  })

  return (
    <View style={s.card}>
      <View style={s.cardStripe} />

      <View style={s.cardHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{food.name}</Text>
          {!!food.brand && <Text style={s.cardSub}>{food.brand}</Text>}
        </View>
        {food.verified && (
          <View style={s.fuente}>
            <VerifiedSeal size={14} color={CT.ink} checkColor={CT.panelHot} />
            <Text style={s.fuenteTxt} numberOfLines={1}>{food.sourceLabel ?? 'Verificado'}</Text>
          </View>
        )}
      </View>

      <View style={s.cardBody}>
        <View>
          <Text style={[numeral, { fontSize: 30, lineHeight: 33 }]}>{macros.calories}</Text>
          <Text style={legend}>kcal · {fmtQty(amount, unit)}</Text>
        </View>
        <View style={s.cardMacros}>
          {([['P', macros.protein], ['C', macros.carbs], ['G', macros.fat]] as const).map(([k, v]) => (
            <View key={k} style={s.cardMacro}>
              <Text style={s.cardMacroVal}>{Math.round(v)}</Text>
              <Text style={s.cardMacroKey}>{k}</Text>
            </View>
          ))}
        </View>
      </View>

      <Tap onPress={commit} haptic="medium" scaleTo={0.98}>
        <View style={s.cardCta}>
          <ZIcon name="check" size={15} color="#fff" weight={2.2} />
          <Text style={s.cardCtaTxt}>Añadir a la comida</Text>
        </View>
      </Tap>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 28 },

  viewport: {
    height: 168, marginHorizontal: 18, marginTop: 14,
    borderRadius: CT.r.md, backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center', gap: 10, overflow: 'hidden',
  },
  viewportGrid: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.05)' },
  viewportTxt: { fontSize: 11.5, color: CT.ink3, fontWeight: '600' },
  viewportNote: { fontSize: 10, color: CT.ink4, marginTop: -4 },

  entry: { flexDirection: 'row', gap: 8, marginHorizontal: 18, marginTop: 12 },
  entryInput: {
    flex: 1, height: 44, paddingHorizontal: 13, borderRadius: CT.r.sm,
    backgroundColor: CT.panel, color: CT.ink, fontSize: 13.5,
    fontVariant: ['tabular-nums'],
  },
  entryBtn: {
    width: 46, height: 44, borderRadius: CT.r.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  entryBtnOff: { opacity: 0.4 },

  explica: { paddingHorizontal: 18, paddingTop: 14 },
  explicaTxt: { fontSize: 12.5, lineHeight: 19, color: CT.ink3 },

  salida: {
    height: 44, marginHorizontal: 18, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: CT.r.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: CT.edge,
    backgroundColor: CT.panel,
  },
  salidaTxt: { fontSize: 12.5, fontWeight: '700', color: CT.ink },

  card: {
    marginHorizontal: 18, marginTop: 16, borderRadius: CT.r.md,
    backgroundColor: CT.panelHot, overflow: 'hidden',
  },
  cardStripe: { height: 2.5, width: '100%', backgroundColor: CT.signal },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, paddingBottom: 10 },
  cardTitle: { fontSize: 14.5, fontWeight: '800', color: CT.ink, lineHeight: 19 },
  cardSub: { fontSize: 11, color: CT.ink3, marginTop: 3 },
  fuente: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 118 },
  fuenteTxt: { fontSize: 9.5, fontWeight: '700', color: CT.ink3, letterSpacing: 0.2 },

  cardBody: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 14,
  },
  cardMacros: { flexDirection: 'row', gap: 8 },
  cardMacro: {
    width: 42, height: 42, borderRadius: CT.r.xs, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardMacroVal: { fontSize: 13.5, fontWeight: '800', color: CT.ink, fontVariant: ['tabular-nums'] },
  cardMacroKey: { fontSize: 8.5, fontWeight: '800', color: CT.ink3, letterSpacing: 0.6 },

  cardCta: {
    height: 46, margin: 14, marginTop: 0, borderRadius: CT.r.sm, backgroundColor: CT.signal,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  cardCtaTxt: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
})
