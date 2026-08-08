/**
 * PANEL · ESCÁNER
 * ───────────────
 * Dos vías de lectura bajo un mismo panel, separadas por submenú:
 *
 *   · Código   — lectura de código de barras del envase
 *   · Foto     — estimación de macros del plato por imagen
 *
 * Comparten panel porque ambas resuelven lo mismo (un alimento reconocido con
 * sus macros ya calculados) y difieren sólo en la fuente. El resultado se
 * presenta con la misma ficha en los dos casos para que la lectura sea igual.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ZIcon } from '@/components/ui/ZencrusIcon'
import {
  lookupBarcode, HEALTH_LEVEL_COLORS, HEALTH_LEVEL_LABELS, ScannedFood,
} from '@/services/barcodeService'
import { analyzePhotoMacros, PhotoMacros } from '@/services/foodPhotoService'
import { FoodEntry } from '@/store/nutritionStore'
import { CT, numeral, legend } from '../tokens'
import { Tap, Panel, SubTabs, Bracket, Blank } from '../parts'

const DEMO_CODES = ['7502005556657', '7501000140131', '0048001348093', '7500478002069', '7500231134090']
const DEMO_PLATES = ['Pollo a la plancha con arroz', 'Tacos de carnitas', 'Ensalada César', 'Bowl de avena con frutas']

/** Los dos servicios etiquetan la salud en idiomas distintos; se unifica aquí. */
const PLATE_TONE: Record<PhotoMacros['healthLevel'], string> = {
  verde: '#30D158', amarillo: '#FFD60A', rojo: '#FF3B30',
}
const PLATE_LABEL: Record<PhotoMacros['healthLevel'], string> = {
  verde: 'Natural', amarillo: 'Procesado', rojo: 'Ultraprocesado',
}

interface ScanPanelProps {
  onCommit: (entry: FoodEntry) => void
}

export function ScanPanel({ onCommit }: ScanPanelProps) {
  const [tab, setTab] = useState<'codigo' | 'foto'>('codigo')

  return (
    <Panel>
      <SubTabs
        tabs={[{ id: 'codigo', label: 'Código de barras' }, { id: 'foto', label: 'Foto del plato' }]}
        active={tab}
        onSelect={id => setTab(id as 'codigo' | 'foto')}
      />
      {tab === 'codigo'
        ? <BarcodeReader onCommit={onCommit} />
        : <PlateReader onCommit={onCommit} />}
    </Panel>
  )
}

// ── Código de barras ──────────────────────────────────────────────────────────

function BarcodeReader({ onCommit }: { onCommit: (e: FoodEntry) => void }) {
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [hit, setHit] = useState<ScannedFood | null>(null)
  const [miss, setMiss] = useState(false)

  const read = async (value?: string) => {
    const target = value ?? DEMO_CODES[Math.floor(Math.random() * DEMO_CODES.length)]
    setBusy(true); setHit(null); setMiss(false)
    const found = await lookupBarcode(target)
    setBusy(false)
    if (found) setHit(found)
    else setMiss(true)
  }

  const commit = () => {
    if (!hit) return
    onCommit({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      name: hit.name,
      calories: hit.calories,
      protein: hit.protein,
      carbs: hit.carbs,
      fat: hit.fat,
      fiber: hit.fiber ?? 0,
      amount: hit.amount,
      unit: hit.unit,
      active: true,
    })
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
          {busy ? 'Leyendo…' : 'Apunta al código del envase'}
        </Text>
      </View>

      <View style={s.entry}>
        <TextInput
          style={s.entryInput}
          value={code}
          onChangeText={setCode}
          placeholder="O escribe el código"
          placeholderTextColor={CT.ink3}
          keyboardType="number-pad"
        />
        <Tap onPress={() => read(code || undefined)} disabled={busy} scaleTo={0.94}>
          <View style={s.entryBtn}>
            <ZIcon name="reticle" size={15} color={CT.ink} weight={1.9} />
          </View>
        </Tap>
      </View>

      <Tap onPress={() => read()} disabled={busy} scaleTo={0.98}>
        <View style={s.simulate}>
          <ZIcon name="bolt" size={14} color={CT.ink2} />
          <Text style={s.simulateTxt}>Simular lectura</Text>
        </View>
      </Tap>

      {miss && (
        <Blank icon="warning" title="Código no reconocido" note="No está en el catálogo. Prueba con otro o regístralo a mano." />
      )}

      {hit && (
        <Animated.View entering={FadeInDown.duration(260)}>
          <ResultCard
            title={hit.name}
            sub={hit.brand}
            tone={HEALTH_LEVEL_COLORS[hit.healthLevel]}
            badge={HEALTH_LEVEL_LABELS[hit.healthLevel]}
            portion={`${hit.amount} ${hit.unit}`}
            kcal={hit.calories}
            protein={hit.protein}
            carbs={hit.carbs}
            fat={hit.fat}
            onCommit={commit}
          />
        </Animated.View>
      )}
    </ScrollView>
  )
}

// ── Foto del plato ────────────────────────────────────────────────────────────

function PlateReader({ onCommit }: { onCommit: (e: FoodEntry) => void }) {
  const [busy, setBusy] = useState(false)
  const [hit, setHit] = useState<PhotoMacros | null>(null)

  const analyze = async (hint?: string) => {
    setBusy(true); setHit(null)
    setHit(await analyzePhotoMacros(hint ? `demo:${hint}` : 'demo:random'))
    setBusy(false)
  }

  const commit = () => {
    if (!hit) return
    onCommit({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      name: hit.foodName,
      calories: hit.calories,
      protein: hit.protein,
      carbs: hit.carbs,
      fat: hit.fat,
      fiber: hit.fiber ?? 0,
      amount: 1,
      unit: hit.servingSize,
      active: true,
    })
  }

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.viewport}>
        <Bracket color={CT.signalEdge} inset={14} len={22} />
        {busy
          ? <ActivityIndicator color={CT.signal} />
          : <ZIcon name="aperture" size={40} color={CT.ink4} weight={1.5} />}
        <Text style={s.viewportTxt}>
          {busy ? 'Estimando macros…' : 'Encuadra el plato completo'}
        </Text>
      </View>

      <Tap onPress={() => analyze()} disabled={busy} scaleTo={0.98}>
        <View style={s.capture}>
          <ZIcon name="aperture" size={16} color="#fff" weight={1.8} />
          <Text style={s.captureTxt}>Analizar plato</Text>
        </View>
      </Tap>

      <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
        <Text style={legend}>Ejemplos rápidos</Text>
      </View>
      <View style={s.chips}>
        {DEMO_PLATES.map(plate => (
          <Tap key={plate} onPress={() => analyze(plate)} disabled={busy} scaleTo={0.94}>
            <View style={s.chip}>
              <Text style={s.chipTxt}>{plate}</Text>
            </View>
          </Tap>
        ))}
      </View>

      {hit && (
        <Animated.View entering={FadeInDown.duration(260)}>
          <ResultCard
            title={hit.foodName}
            sub={`${Math.round(hit.confidence * 100)} % de confianza`}
            tone={PLATE_TONE[hit.healthLevel]}
            badge={PLATE_LABEL[hit.healthLevel]}
            portion={hit.servingSize}
            kcal={hit.calories}
            protein={hit.protein}
            carbs={hit.carbs}
            fat={hit.fat}
            onCommit={commit}
          />
        </Animated.View>
      )}
    </ScrollView>
  )
}

// ── Ficha de resultado ────────────────────────────────────────────────────────

function ResultCard({ title, sub, tone, badge, portion, kcal, protein, carbs, fat, onCommit }: {
  title: string
  sub?: string
  tone: string
  badge: string
  portion: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  onCommit: () => void
}) {
  return (
    <View style={s.card}>
      <View style={[s.cardStripe, { backgroundColor: tone }]} />

      <View style={s.cardHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{title}</Text>
          {!!sub && <Text style={s.cardSub}>{sub}</Text>}
        </View>
        <View style={[s.badge, { borderColor: tone + '66', backgroundColor: tone + '18' }]}>
          <Text style={[s.badgeTxt, { color: tone }]}>{badge}</Text>
        </View>
      </View>

      <View style={s.cardBody}>
        <View>
          <Text style={[numeral, { fontSize: 30, lineHeight: 33 }]}>{kcal}</Text>
          <Text style={legend}>kcal · {portion}</Text>
        </View>
        <View style={s.cardMacros}>
          {[['P', protein], ['C', carbs], ['G', fat]].map(([k, v]) => (
            <View key={k as string} style={s.cardMacro}>
              <Text style={s.cardMacroVal}>{Math.round(v as number)}</Text>
              <Text style={s.cardMacroKey}>{k as string}</Text>
            </View>
          ))}
        </View>
      </View>

      <Tap onPress={onCommit} haptic="medium" scaleTo={0.98}>
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
    alignItems: 'center', justifyContent: 'center', gap: 12, overflow: 'hidden',
  },
  viewportGrid: { ...StyleSheet.absoluteFillObject },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.05)' },
  viewportTxt: { fontSize: 11.5, color: CT.ink3, fontWeight: '600' },

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

  simulate: {
    height: 40, marginHorizontal: 18, marginTop: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: CT.r.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: CT.edge,
  },
  simulateTxt: { fontSize: 12, fontWeight: '700', color: CT.ink2 },

  capture: {
    height: 46, marginHorizontal: 18, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
    borderRadius: CT.r.sm, backgroundColor: CT.signal,
  },
  captureTxt: { fontSize: 13.5, fontWeight: '800', color: '#fff' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 18, paddingTop: 9 },
  chip: { height: 30, paddingHorizontal: 12, borderRadius: CT.r.xs, justifyContent: 'center', backgroundColor: CT.panel },
  chipTxt: { fontSize: 11.5, fontWeight: '600', color: CT.ink2 },

  card: {
    marginHorizontal: 18, marginTop: 16, borderRadius: CT.r.md,
    backgroundColor: CT.panelHot, overflow: 'hidden',
  },
  cardStripe: { height: 2.5, width: '100%' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, paddingBottom: 10 },
  cardTitle: { fontSize: 14.5, fontWeight: '800', color: CT.ink, lineHeight: 19 },
  cardSub: { fontSize: 11, color: CT.ink3, marginTop: 3 },
  badge: { paddingHorizontal: 9, height: 22, borderRadius: 11, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  badgeTxt: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },

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
