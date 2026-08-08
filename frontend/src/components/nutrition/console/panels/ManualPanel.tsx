/**
 * PANEL · MANUAL
 * ──────────────
 * Salida para lo que no está en ningún catálogo. Sólo nombre y calorías son
 * obligatorios; los macros se calculan solos a partir de lo que se rellene y
 * el desajuste se muestra en vivo, para que quien sepa los gramos exactos
 * pueda cuadrarlos y quien no, registre igual sin trabarse.
 */

import { useState } from 'react'
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native'
import { ZIcon } from '@/components/ui/ZencrusIcon'
import { FoodEntry } from '@/store/nutritionStore'
import { CT, numeral, legend } from '../tokens'
import { Tap, Panel, PrimaryAction, Legend, Meter } from '../parts'

const UNITS = ['g', 'ml', 'pza', 'taza', 'porción']

interface ManualPanelProps {
  bottomInset: number
  onCommit: (entry: FoodEntry) => void
}

export function ManualPanel({ bottomInset, onCommit }: ManualPanelProps) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [amount, setAmount] = useState('100')
  const [unit, setUnit] = useState('g')
  const [prot, setProt] = useState('')
  const [carb, setCarb] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')

  const n = (v: string) => {
    const x = parseFloat(v.replace(',', '.'))
    return isNaN(x) ? 0 : x
  }

  const declared = n(kcal)
  // 4 kcal/g de proteína y carbohidrato, 9 kcal/g de grasa.
  const fromMacros = n(prot) * 4 + n(carb) * 4 + n(fat) * 9
  const hasMacros = n(prot) + n(carb) + n(fat) > 0
  const drift = declared > 0 && hasMacros ? Math.abs(fromMacros - declared) / declared : 0
  const ready = name.trim().length > 0 && declared > 0

  const commit = () => {
    if (!ready) return
    onCommit({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      name: name.trim(),
      calories: Math.round(declared),
      protein: n(prot),
      carbs: n(carb),
      fat: n(fat),
      fiber: n(fiber),
      amount: n(amount) || 1,
      unit,
      active: true,
    })
  }

  return (
    <Panel>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Legend>Identificación</Legend>
        <View style={s.group}>
          <Field label="Nombre" value={name} onChange={setName} placeholder="Tacos de canasta" required flex />
        </View>

        <Legend>Porción y energía</Legend>
        <View style={s.group}>
          <View style={s.pair}>
            <Field label="Cantidad" value={amount} onChange={setAmount} placeholder="100" numeric />
            <Field label="Calorías" value={kcal} onChange={setKcal} placeholder="300" numeric required suffix="kcal" />
          </View>
          <View style={s.units}>
            {UNITS.map(u => {
              const on = u === unit
              return (
                <Tap key={u} onPress={() => setUnit(u)} scaleTo={0.92} haptic="none">
                  <View style={[s.unit, on && s.unitOn]}>
                    <Text style={[s.unitTxt, on && s.unitTxtOn]}>{u}</Text>
                  </View>
                </Tap>
              )
            })}
          </View>
        </View>

        <Legend>Macros · opcional</Legend>
        <View style={s.group}>
          <View style={s.pair}>
            <Field label="Proteína" value={prot} onChange={setProt} placeholder="0" numeric suffix="g" />
            <Field label="Carbos" value={carb} onChange={setCarb} placeholder="0" numeric suffix="g" />
          </View>
          <View style={s.pair}>
            <Field label="Grasas" value={fat} onChange={setFat} placeholder="0" numeric suffix="g" />
            <Field label="Fibra" value={fiber} onChange={setFiber} placeholder="0" numeric suffix="g" />
          </View>
        </View>

        {hasMacros && declared > 0 && (
          <View style={[s.check, drift > 0.15 && s.checkWarn]}>
            <ZIcon
              name={drift > 0.15 ? 'warning' : 'check'}
              size={15}
              color={drift > 0.15 ? CT.signalSoft : CT.ink2}
              weight={1.9}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.checkTxt}>
                {drift > 0.15
                  ? `Tus macros suman ${Math.round(fromMacros)} kcal, no ${Math.round(declared)}.`
                  : 'Los macros cuadran con las calorías declaradas.'}
              </Text>
              <View style={{ marginTop: 7 }}>
                <Meter
                  pct={Math.min(fromMacros / Math.max(declared, 1), 1)}
                  height={2}
                  tone={drift > 0.15 ? CT.ink3 : CT.ink2}
                />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <PrimaryAction
        label={ready ? `Añadir ${Math.round(declared)} kcal` : 'Falta nombre y calorías'}
        icon="check"
        onPress={commit}
        disabled={!ready}
        bottomInset={bottomInset}
      />
    </Panel>
  )
}

function Field({ label, value, onChange, placeholder, numeric, required, suffix, flex }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  numeric?: boolean
  required?: boolean
  suffix?: string
  flex?: boolean
}) {
  const [focus, setFocus] = useState(false)
  return (
    <View style={flex ? { flex: 1 } : s.half}>
      <View style={s.labelRow}>
        <Text style={legend}>{label}</Text>
        {required && <View style={s.req} />}
      </View>
      <View style={[s.input, focus && s.inputOn]}>
        <TextInput
          style={[s.inputTxt, numeric && (numeral as object)]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={CT.ink4}
          keyboardType={numeric ? 'decimal-pad' : 'default'}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
        />
        {!!suffix && <Text style={s.suffix}>{suffix}</Text>}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 20 },
  group: { paddingHorizontal: 18, gap: 10, marginBottom: 4 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  req: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: CT.signal },

  input: {
    height: 46, paddingHorizontal: 13, borderRadius: CT.r.sm,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: CT.panel,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent',
  },
  inputOn: { backgroundColor: CT.panelHot, borderColor: CT.signalEdge },
  inputTxt: { flex: 1, fontSize: 14, color: CT.ink, padding: 0 },
  suffix: { fontSize: 10, fontWeight: '800', color: CT.ink3, letterSpacing: 0.6, textTransform: 'uppercase' },

  units: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  unit: {
    height: 30, paddingHorizontal: 12, borderRadius: CT.r.xs,
    alignItems: 'center', justifyContent: 'center', backgroundColor: CT.panel,
  },
  unitOn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  unitTxt: { fontSize: 11.5, fontWeight: '700', color: CT.ink3 },
  unitTxtOn: { color: CT.ink },

  check: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 11,
    marginHorizontal: 18, marginTop: 14, padding: 13,
    borderRadius: CT.r.sm, backgroundColor: CT.panel,
  },
  checkWarn: { backgroundColor: CT.signalWash },
  checkTxt: { fontSize: 11.5, color: CT.ink2, lineHeight: 16.5 },
})
