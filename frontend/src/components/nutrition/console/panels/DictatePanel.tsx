/**
 * PANEL · LISTA
 * ─────────────
 * El camino rápido: se escribe lo que se comió, una línea por alimento, y ZENA
 * lo convierte en registros. Dos modos:
 *
 *   POR COMIDA   un campo por momento del día — control exacto del reparto
 *   DÍA COMPLETO un solo campo en lenguaje natural — ZENA infiere la comida
 *
 * ── Lectura en vivo ─────────────────────────────────────────────────────────
 * El catálogo local resuelve sin red, así que cada línea se muestra resuelta
 * mientras se teclea. Antes había que pulsar el botón para descubrir qué se
 * había entendido; ahora se ve al escribir y el backend solo afina al confirmar.
 *
 * ── Lo no reconocido no bloquea ─────────────────────────────────────────────
 * Una línea sin coincidencia se marca «por estimar» y sigue adelante. El
 * servicio ya la devuelve con macros en cero precisamente para completarla en
 * revisión, que es donde el usuario tiene el contexto para resolverla.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import {
  MealTextInput, ParsedFood, ParsedFoodsByMeal, parseFoodList, localParseFoodList,
} from '@/services/foodListService'
import { CT } from '../tokens'
import { Tap, Panel, PrimaryAction } from '../parts'

type Mode = 'meal' | 'day'

/**
 * Pistas de momento del día para el modo libre.
 *
 * Se evalúan por línea y en orden: la primera que aparezca decide la comida. Sin
 * pista, la línea hereda la comida de la anterior, que es como se escribe de
 * corrido («desayuné huevos / y café» → ambas al desayuno).
 */
const DAY_HINTS: { re: RegExp; meal: string }[] = [
  { re: /desayun|en la ma(ñ|n)ana|temprano/i, meal: 'breakfast' },
  { re: /almor|de comer|comida|medio ?d(í|i)a/i, meal: 'lunch' },
  { re: /cen(é|e|ar)|en la noche|noche/i, meal: 'dinner' },
  { re: /snack|colaci(ó|o)n|en la tarde|merien/i, meal: 'snack1' },
]

interface DictatePanelProps {
  mode: 'lista' | 'voz'
  targets: { id: string; label: string; icon: ZIconName }[]
  focusMeal?: string | null
  bottomInset: number
  onParsed: (parsed: ParsedFoodsByMeal) => void
}

export function DictatePanel({ mode, targets, focusMeal, bottomInset, onParsed }: DictatePanelProps) {
  const [tab, setTab] = useState<Mode>('meal')
  const [texts, setTexts] = useState<MealTextInput>({})
  const [dayText, setDayText] = useState('')
  const [open, setOpen] = useState<string | null>(targets[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const fields = useRef<Record<string, TextInput | null>>({})

  // En dictado, el teclado debe abrirse solo sobre la comida de origen.
  useEffect(() => {
    if (mode !== 'voz' || !focusMeal) return
    setOpen(focusMeal)
    const t = setTimeout(() => fields.current[focusMeal]?.focus(), 420)
    return () => clearTimeout(t)
  }, [mode, focusMeal])

  /** Texto libre repartido en comidas según las pistas de cada línea. */
  const dayAsMeals = useMemo<MealTextInput>(() => {
    const out: MealTextInput = {}
    let current = targets[0]?.id ?? 'breakfast'
    for (const raw of dayText.split('\n')) {
      const line = raw.trim()
      if (!line) continue
      const hit = DAY_HINTS.find(h => h.re.test(line))
      if (hit && targets.some(t => t.id === hit.meal)) current = hit.meal
      const key = current as keyof MealTextInput
      out[key] = out[key] ? `${out[key]}\n${line}` : line
    }
    return out
  }, [dayText, targets])

  const source = tab === 'day' ? dayAsMeals : texts
  const preview = useMemo(() => localParseFoodList(source), [source])

  const lines = (id: string) =>
    (texts[id as keyof MealTextInput] ?? '').split('\n').filter(l => l.trim()).length

  const dayLines = dayText.split('\n').filter(l => l.trim()).length
  const total = tab === 'day' ? dayLines : targets.reduce((n, t) => n + lines(t.id), 0)

  const kcalOf = (id: string) =>
    Math.round((preview[id] ?? []).reduce((a, f) => a + f.calories, 0))
  const dayKcal = Math.round(
    Object.values(preview).flat().reduce((a, f) => a + f.calories, 0),
  )

  const run = async () => {
    if (total === 0) return
    setBusy(true)
    setFailed(false)
    try {
      onParsed(await parseFoodList(source))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel>
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Conmutador de modo */}
        <View style={s.modes}>
          {([['meal', 'Por comida'], ['day', 'Día completo']] as const).map(([id, label]) => {
            const on = tab === id
            return (
              <Tap key={id} onPress={() => setTab(id)} scaleTo={0.97} haptic="light">
                <View style={[s.mode, on && s.modeOn]}>
                  <Text style={[s.modeTxt, on && s.modeTxtOn]}>{label}</Text>
                </View>
              </Tap>
            )
          })}
        </View>

        {tab === 'meal' ? (
          <>
            {/* Sintaxis: qué escribir, con un ejemplo real */}
            {total === 0 && (
              <View style={s.syntax}>
                <Text style={s.syntaxLbl}>CÓMO ESCRIBIRLO</Text>
                <Text style={s.code}>2 huevos revueltos</Text>
                <Text style={s.code}>1 taza de avena</Text>
                <Text style={s.code}>
                  <Text style={s.codeHot}>150 g</Text> de pechuga
                </Text>
                <Text style={s.code}>café con leche</Text>
              </View>
            )}

            {targets.map(t => {
              const n = lines(t.id)
              const isOpen = open === t.id
              const rows = preview[t.id] ?? []
              return (
                <Animated.View
                  key={t.id}
                  layout={LinearTransition.duration(200)}
                  style={[s.block, isOpen && s.blockOn]}
                >
                  <Tap onPress={() => setOpen(isOpen ? null : t.id)} scaleTo={0.995}>
                    <View style={s.blockHead}>
                      <View style={[s.blockMark, isOpen && s.blockMarkOn]}>
                        <ZIcon name={t.icon} size={13} color={isOpen ? CT.signal : CT.ink3} weight={1.7} />
                      </View>
                      <Text style={[s.blockLbl, n > 0 && { color: CT.ink }]}>{t.label}</Text>
                      {n > 0 ? (
                        <>
                          <Text style={s.blockCount}>{n} {n === 1 ? 'línea' : 'líneas'}</Text>
                          <Text style={s.blockKcal}>{kcalOf(t.id)}</Text>
                        </>
                      ) : (
                        <Text style={s.blockCount}>vacío</Text>
                      )}
                      <ZIcon
                        name={isOpen ? 'chevronUp' : 'chevronDown'}
                        size={13} color={CT.ink3} weight={1.9}
                      />
                    </View>
                  </Tap>

                  {isOpen && (
                    <Animated.View entering={FadeIn.duration(140)}>
                      <TextInput
                        ref={r => { fields.current[t.id] = r }}
                        style={s.buffer}
                        value={texts[t.id as keyof MealTextInput] ?? ''}
                        onChangeText={v => setTexts(prev => ({ ...prev, [t.id]: v }))}
                        placeholder={'ej. 2 huevos\n1 taza de avena'}
                        placeholderTextColor={CT.ink4}
                        multiline
                        textAlignVertical="top"
                      />
                      {rows.length > 0 && <Reading rows={rows} kcal={kcalOf(t.id)} />}
                    </Animated.View>
                  )}
                </Animated.View>
              )
            })}
          </>
        ) : (
          <View style={[s.block, s.blockOn]}>
            <View style={s.blockHead}>
              <View style={[s.blockMark, s.blockMarkOn]}>
                <ZIcon name="spark" size={13} color={CT.signal} weight={1.8} />
              </View>
              <Text style={[s.blockLbl, { color: CT.ink }]}>Todo el día</Text>
              {dayLines > 0 && (
                <>
                  <Text style={s.blockCount}>
                    {dayLines} {dayLines === 1 ? 'línea' : 'líneas'}
                  </Text>
                  <Text style={s.blockKcal}>{dayKcal}</Text>
                </>
              )}
            </View>

            <TextInput
              style={[s.buffer, s.bufferTall]}
              value={dayText}
              onChangeText={setDayText}
              placeholder={'desayuné dos huevos con avena y café\nde comer pechuga con arroz\ncené salmón con brócoli'}
              placeholderTextColor={CT.ink4}
              multiline
              textAlignVertical="top"
            />

            {dayLines > 0 && (
              <DayReading preview={preview} targets={targets} kcal={dayKcal} />
            )}

            <Text style={s.dayNote}>
              Escribe de corrido. ZENA reconoce «desayuné», «de comer», «en la tarde»
              o «cené» y reparte cada línea en su comida.
            </Text>
          </View>
        )}

        {failed && (
          <Animated.View entering={FadeIn} style={s.error}>
            <ZIcon name="warning" size={15} color={CT.signalSoft} weight={1.8} />
            <Text style={s.errorTxt}>
              No se pudo interpretar la lista. Revisa tu conexión e inténtalo otra vez.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      <PrimaryAction
        label={total > 0
          ? `Interpretar ${total} ${total === 1 ? 'línea' : 'líneas'}`
          : 'Escribe algo para continuar'}
        icon="spark"
        onPress={run}
        disabled={total === 0}
        busy={busy}
        bottomInset={bottomInset}
      />
    </Panel>
  )
}

// ── Lectura en vivo ───────────────────────────────────────────────────────────

function Reading({ rows, kcal }: { rows: ParsedFood[]; kcal: number }) {
  return (
    <Animated.View entering={FadeIn.duration(150)} style={s.read}>
      <View style={s.readHead}>
        <ZIcon name="spark" size={11} color={CT.signal} weight={2} />
        <Text style={s.readLbl}>Zena está leyendo</Text>
        <Text style={s.readTot}>{kcal} kcal</Text>
      </View>
      {rows.map((f, i) => <ReadRow key={i} food={f} />)}
    </Animated.View>
  )
}

/** En modo libre cada línea muestra además a qué comida fue a parar. */
function DayReading({ preview, targets, kcal }: {
  preview: ParsedFoodsByMeal
  targets: { id: string; label: string }[]
  kcal: number
}) {
  return (
    <Animated.View entering={FadeIn.duration(150)} style={s.read}>
      <View style={s.readHead}>
        <ZIcon name="spark" size={11} color={CT.signal} weight={2} />
        <Text style={s.readLbl}>Zena está leyendo</Text>
        <Text style={s.readTot}>{kcal} kcal</Text>
      </View>
      {targets.map(t => (preview[t.id] ?? []).map((f, i) => (
        <ReadRow key={`${t.id}-${i}`} food={f} where={t.label.toLowerCase()} />
      )))}
    </Animated.View>
  )
}

function ReadRow({ food, where }: { food: ParsedFood; where?: string }) {
  const unknown = food.calories === 0
  return (
    <View style={s.readRow}>
      <View style={[s.readDot, unknown && s.readDotOff]} />
      <Text style={s.readEmoji}>{food.emoji}</Text>
      <Text style={[s.readName, unknown && s.readNameOff]} numberOfLines={1}>{food.name}</Text>
      {!!where && <Text style={s.readWhere}>{where}</Text>}
      <Text style={[s.readKcal, unknown && s.readKcalOff]}>
        {unknown ? 'por estimar' : Math.round(food.calories)}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { padding: 18, paddingBottom: 26 },

  // Conmutador de modo
  modes: {
    flexDirection: 'row', gap: 4, padding: 4, marginBottom: 14,
    borderRadius: CT.r.pill, backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: CT.hairline,
  },
  mode: { paddingVertical: 9, paddingHorizontal: 22, borderRadius: CT.r.pill },
  modeOn: { backgroundColor: CT.ink },
  modeTxt: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.1,
    textTransform: 'uppercase', color: CT.ink3,
  },
  modeTxtOn: { color: '#0A0A0D' },

  // Sintaxis
  syntax: {
    padding: 13, borderRadius: CT.r.sm, marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1, borderColor: CT.hairline, borderStyle: 'dashed',
  },
  syntaxLbl: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.9,
    color: CT.ink3, marginBottom: 8,
  },
  code: { fontSize: 12.5, lineHeight: 21, color: CT.ink2, fontVariant: ['tabular-nums'] },
  codeHot: { color: CT.signal, fontWeight: '700' },

  // Bloque por comida
  block: {
    borderRadius: CT.r.md, marginBottom: 9, overflow: 'hidden',
    backgroundColor: CT.panel, borderWidth: 1, borderColor: CT.hairline,
  },
  blockOn: { borderColor: CT.signalEdge },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11 },
  blockMark: {
    width: 26, height: 26, borderRadius: CT.r.xs,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: CT.panelHot, borderWidth: 1, borderColor: CT.hairline,
  },
  blockMarkOn: { backgroundColor: CT.signalWash, borderColor: CT.signalEdge },
  blockLbl: {
    flex: 1, fontSize: 12.5, fontWeight: '800', letterSpacing: 1.1,
    textTransform: 'uppercase', color: CT.ink3,
  },
  blockCount: { fontSize: 10.5, color: CT.ink3 },
  blockKcal: { fontSize: 12.5, fontWeight: '800', color: CT.ink, fontVariant: ['tabular-nums'] },

  buffer: {
    marginHorizontal: 11, marginBottom: 11, padding: 11,
    minHeight: 78, borderRadius: CT.r.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1, borderColor: CT.hairline,
    fontSize: 13.5, lineHeight: 20, color: CT.ink,
  },
  bufferTall: { minHeight: 118 },
  dayNote: {
    paddingHorizontal: 11, paddingBottom: 12,
    fontSize: 11, lineHeight: 16, color: CT.ink3,
  },

  // Lectura en vivo
  read: {
    marginHorizontal: 11, marginBottom: 11, padding: 10,
    borderRadius: CT.r.sm, backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1, borderColor: CT.hairline,
  },
  readHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  readLbl: {
    flex: 1, fontSize: 9, fontWeight: '800', letterSpacing: 1.8,
    textTransform: 'uppercase', color: CT.ink3,
  },
  readTot: { fontSize: 12, fontWeight: '800', color: CT.ink, fontVariant: ['tabular-nums'] },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  readDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: CT.ink },
  readDotOff: { backgroundColor: CT.ink4 },
  readEmoji: { fontSize: 12, width: 17, textAlign: 'center' },
  readName: { flex: 1, minWidth: 0, fontSize: 11.5, color: CT.ink2 },
  readNameOff: { color: CT.ink3 },
  readWhere: { fontSize: 10, color: CT.ink3 },
  readKcal: { fontSize: 11.5, fontWeight: '800', color: CT.ink, fontVariant: ['tabular-nums'] },
  readKcalOff: { fontSize: 9.5, fontWeight: '700', color: CT.ink3 },

  error: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    marginTop: 4, padding: 12,
    borderRadius: CT.r.sm, backgroundColor: CT.signalWash,
  },
  errorTxt: { flex: 1, fontSize: 11.5, color: CT.ink2, lineHeight: 16.5 },
})
