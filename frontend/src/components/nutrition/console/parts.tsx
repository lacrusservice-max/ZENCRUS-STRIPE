/**
 * CONSOLA DE ALIMENTOS — PIEZAS BASE
 * ──────────────────────────────────
 * Primitivas compartidas por todos los paneles. Cada banda fija declara su
 * altura desde `Band`, de modo que ninguna puede estirarse sola y taparse con
 * la siguiente.
 */

import React, { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, ScrollView, ViewStyle, StyleProp,
  LayoutChangeEvent, ActivityIndicator,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { ZIcon, ZIconName } from '@/components/ui/ZencrusIcon'
import { Band, Motion } from '@/constants/layout'
import { CT, numeral, legend } from './tokens'

const AnimatedView = Animated.createAnimatedComponent(View)

// ── Realimentación táctil ─────────────────────────────────────────────────────

/**
 * Pulsable con respuesta de escala. Todo lo que se toca en la consola pasa por
 * aquí para que la respuesta sea idéntica en cada superficie.
 */
export function Tap({
  children, onPress, style, disabled, haptic = 'light', scaleTo = 0.965,
}: {
  children: React.ReactNode
  onPress?: () => void
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  haptic?: 'light' | 'medium' | 'none'
  scaleTo?: number
}) {
  const scale = useSharedValue(1)
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const fire = useCallback(() => {
    if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress?.()
  }, [haptic, onPress])

  return (
    <Pressable
      onPressIn={() => { scale.value = withTiming(scaleTo, { duration: Motion.tap }) }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 340 }) }}
      onPress={fire}
      disabled={disabled}
      style={style}
    >
      {/* `flexGrow` deja que la capa animada herede el alto del pulsable cuando
          éste lo tiene definido (segmentos del riel), sin estirar los que se
          dimensionan por contenido (chips, botones sueltos). */}
      <AnimatedView style={[anim, { flexGrow: 1 }]}>{children}</AnimatedView>
    </Pressable>
  )
}

// ── Corchetes de selección ────────────────────────────────────────────────────

/**
 * Cuatro vértices en las esquinas del contenedor. Es la marca de selección de
 * la consola: pesa mucho menos que un relleno y deja respirar el contenido.
 */
export function Bracket({ color = CT.signal, inset = 0, len = 9 }: {
  color?: string
  inset?: number
  len?: number
}) {
  const arm: ViewStyle = { position: 'absolute', width: len, height: len, borderColor: color }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { margin: inset }]}>
      <View style={[arm, { top: 0, left: 0, borderTopWidth: 1.4, borderLeftWidth: 1.4, borderTopLeftRadius: 3 }]} />
      <View style={[arm, { top: 0, right: 0, borderTopWidth: 1.4, borderRightWidth: 1.4, borderTopRightRadius: 3 }]} />
      <View style={[arm, { bottom: 0, left: 0, borderBottomWidth: 1.4, borderLeftWidth: 1.4, borderBottomLeftRadius: 3 }]} />
      <View style={[arm, { bottom: 0, right: 0, borderBottomWidth: 1.4, borderRightWidth: 1.4, borderBottomRightRadius: 3 }]} />
    </View>
  )
}

// ── Lectura de instrumento ────────────────────────────────────────────────────

/** Cifra grande con unidad en versalitas. El dato primario de cada bloque. */
export function Readout({ value, unit, size = 28, tone = CT.ink, align = 'flex-end' }: {
  value: string | number
  unit: string
  size?: number
  tone?: string
  align?: 'flex-start' | 'flex-end' | 'center'
}) {
  return (
    <View style={{ alignItems: align }}>
      <Text style={[numeral, { fontSize: size, color: tone, lineHeight: size * 1.08 }]}>{value}</Text>
      <Text style={[legend, { marginTop: 1 }]}>{unit}</Text>
    </View>
  )
}

// ── Medidor ───────────────────────────────────────────────────────────────────

/**
 * Barra de progreso de un solo trazo. Cuando se rebasa el 100 % el excedente
 * se dibuja en rojo sobre el mismo carril en vez de desbordar el contenedor.
 */
export function Meter({ pct, over = 0, height = 3, tone = CT.ink, spillTone = CT.signal }: {
  /** 0–1 de la parte dentro de presupuesto. */
  pct: number
  /** 0–1 del segundo tramo, medido sobre el mismo carril. */
  over?: number
  height?: number
  tone?: string
  /**
   * Color del segundo tramo. Rojo sólo cuando de verdad hay exceso: el rojo
   * significa lo mismo en toda la app y perdería sentido si también pintara
   * lo que aún cabe en el presupuesto.
   */
  spillTone?: string
}) {
  const fill = useSharedValue(0)
  const spill = useSharedValue(0)

  React.useEffect(() => {
    fill.value = withTiming(Math.max(0, Math.min(pct, 1)), { duration: 520, easing: Easing.out(Easing.cubic) })
    spill.value = withTiming(Math.max(0, Math.min(over, 1)), { duration: 520, easing: Easing.out(Easing.cubic) })
  }, [pct, over])

  const a = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }))
  const b = useAnimatedStyle(() => ({ width: `${spill.value * 100}%` }))

  return (
    <View style={[p.meterTrack, { height, borderRadius: height }]}>
      <AnimatedView style={[a, { height, backgroundColor: tone, borderRadius: height }]} />
      <AnimatedView style={[b, { height, backgroundColor: spillTone, borderRadius: height }]} />
    </View>
  )
}

// ── Riel de métodos ───────────────────────────────────────────────────────────

export interface Method {
  id: string
  icon: ZIconName
  label: string
}

/**
 * Selector de método de captura. El indicador es un corchete que se desliza
 * bajo el método activo — no una píldora rellena que compita con el contenido.
 * El botón de overflow abre los métodos secundarios en un submenú.
 */
export function MethodRail({ methods, active, onSelect }: {
  methods: Method[]
  active: string
  onSelect: (id: string) => void
}) {
  const [track, setTrack] = useState(0)
  const idx = Math.max(0, methods.findIndex(m => m.id === active))
  const seg = track / Math.max(methods.length, 1)

  const x = useSharedValue(0)
  React.useEffect(() => {
    if (!track) return
    x.value = withSpring(idx * seg, { damping: 20, stiffness: 220, mass: 0.7 })
  }, [idx, seg, track])

  const marker = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  const measure = (e: LayoutChangeEvent) => setTrack(e.nativeEvent.layout.width)

  return (
    <View style={p.rail}>
      <View style={p.railTrack} onLayout={measure}>
        {methods.map(mth => {
          const on = mth.id === active
          return (
            <Tap
              key={mth.id}
              style={p.railSeg}
              onPress={() => onSelect(mth.id)}
              scaleTo={0.93}
            >
              <View style={p.railInner}>
                <ZIcon
                  name={mth.icon}
                  size={19}
                  color={on ? CT.ink : CT.ink3}
                  weight={on ? 1.9 : 1.6}
                />
                <Text style={[p.railLbl, on && p.railLblOn]} numberOfLines={1}>
                  {mth.label}
                </Text>
              </View>
            </Tap>
          )
        })}

        {track > 0 && (
          <AnimatedView style={[p.marker, marker, { width: seg }]} pointerEvents="none">
            <View style={p.markerBar} />
          </AnimatedView>
        )}
      </View>

    </View>
  )
}

// ── Selector de comida destino ────────────────────────────────────────────────

export interface Target {
  id: string
  label: string
  icon: ZIconName
  free: number
}

/**
 * Franja de comidas. Altura fija y `flexGrow: 0` explícito: sin ambas cosas el
 * carril horizontal se estira hasta llenar el hueco y deforma a sus hijos.
 */
export function TargetStrip({ targets, active, onSelect }: {
  targets: Target[]
  active: string
  onSelect: (id: string) => void
}) {
  const ref = useRef<ScrollView>(null)

  return (
    <View style={p.strip}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={p.stripScroll}
        contentContainerStyle={p.stripContent}
      >
        {targets.map(t => {
          const on = t.id === active
          return (
            <Tap key={t.id} onPress={() => onSelect(t.id)} scaleTo={0.94}>
              <View style={[p.chip, on && p.chipOn]}>
                <ZIcon name={t.icon} size={13} color={on ? CT.ink : CT.ink3} weight={1.7} />
                <Text style={[p.chipTxt, on && p.chipTxtOn]} numberOfLines={1}>{t.label}</Text>
                <Text style={[p.chipFree, on && p.chipFreeOn]}>{t.free}</Text>
                {on && <Bracket len={7} />}
              </View>
            </Tap>
          )
        })}
      </ScrollView>
    </View>
  )
}

// ── Contenedores de panel ─────────────────────────────────────────────────────

/** Envoltura de todo panel de captura: puede encogerse, nunca desborda. */
export function Panel({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[p.panel, style]}>{children}</View>
}

/** Encabezado de sección dentro de un panel. */
export function Legend({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View style={p.legendRow}>
      <Text style={legend}>{children}</Text>
      {right}
    </View>
  )
}

/** Submenú horizontal dentro de un panel — segundo nivel de organización. */
export function SubTabs({ tabs, active, onSelect }: {
  tabs: { id: string; label: string }[]
  active: string
  onSelect: (id: string) => void
}) {
  return (
    <View style={p.subTabs}>
      {tabs.map(t => {
        const on = t.id === active
        return (
          <Tap key={t.id} style={{ flex: 1 }} onPress={() => onSelect(t.id)} scaleTo={0.96}>
            <View style={[p.subTab, on && p.subTabOn]}>
              <Text style={[p.subTabTxt, on && p.subTabTxtOn]}>{t.label}</Text>
            </View>
          </Tap>
        )
      })}
    </View>
  )
}

/** Estado vacío discreto. */
export function Blank({ icon, title, note }: { icon: ZIconName; title: string; note?: string }) {
  return (
    <View style={p.blank}>
      <View style={p.blankIcon}>
        <ZIcon name={icon} size={22} color={CT.ink4} weight={1.5} />
      </View>
      <Text style={p.blankTitle}>{title}</Text>
      {!!note && <Text style={p.blankNote}>{note}</Text>}
    </View>
  )
}

/** Acción principal del pie. Es el único bloque rojo sólido de la consola. */
export function PrimaryAction({ label, onPress, disabled, busy, icon = 'arrowRight', bottomInset = 0 }: {
  label: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
  icon?: ZIconName
  bottomInset?: number
}) {
  return (
    <View style={[p.footer, { paddingBottom: 16 + bottomInset }]}>
      <Tap onPress={onPress} disabled={disabled || busy} haptic="medium" scaleTo={0.98}>
        <View style={[p.cta, (disabled || busy) && p.ctaOff]}>
          {busy
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <>
                <Text style={p.ctaTxt}>{label}</Text>
                <ZIcon name={icon} size={17} color="#fff" weight={2} />
              </>
            )}
        </View>
      </Tap>
    </View>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const p = StyleSheet.create({
  // Medidor
  meterTrack: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },

  // Riel de métodos
  rail: {
    height: Band.rail,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CT.hairline,
  },
  railTrack: { flex: 1, flexDirection: 'row' },
  railSeg: { flex: 1 },
  railInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 2 },
  railLbl: {
    fontSize: 9.5, fontWeight: '700', color: CT.ink3, letterSpacing: 0.4,
  },
  railLblOn: { color: CT.ink, fontWeight: '800' },
  marker: { position: 'absolute', bottom: 0, height: 8, alignItems: 'center', justifyContent: 'flex-end' },
  markerBar: {
    width: 24, height: 2, borderRadius: 1, backgroundColor: CT.signal,
    shadowColor: CT.signal, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
  },

  railDivider: { width: StyleSheet.hairlineWidth, backgroundColor: CT.hairline, marginVertical: 14 },
  overflow: { width: 46 },
  overflowInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3.5 },
  dot: { width: 3.4, height: 3.4, borderRadius: 2, backgroundColor: CT.ink3 },
  dotOn: { backgroundColor: CT.signal },

  // Franja de comidas
  strip: { height: Band.target, flexGrow: 0, flexShrink: 0 },
  stripScroll: { flexGrow: 0 },
  stripContent: { paddingHorizontal: 18, gap: 7, alignItems: 'center', height: Band.target },
  chip: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    borderRadius: CT.r.xs,
    backgroundColor: CT.panel,
  },
  chipOn: { backgroundColor: CT.signalWash },
  chipTxt: { fontSize: 11.5, fontWeight: '700', color: CT.ink3 },
  chipTxtOn: { color: CT.ink },
  chipFree: {
    fontSize: 10, fontWeight: '800', color: CT.ink4,
    fontVariant: ['tabular-nums'],
  },
  chipFreeOn: { color: CT.signalSoft },

  // Panel
  panel: { flex: 1, minHeight: 0 },
  legendRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8,
  },

  // Submenú
  subTabs: {
    flexDirection: 'row', gap: 6, marginHorizontal: 18, marginTop: 12,
    padding: 3, borderRadius: CT.r.sm, backgroundColor: 'rgba(255,255,255,0.045)',
  },
  subTab: { height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: CT.r.xs },
  subTabOn: { backgroundColor: 'rgba(255,255,255,0.10)' },
  subTabTxt: { fontSize: 11.5, fontWeight: '700', color: CT.ink3 },
  subTabTxtOn: { color: CT.ink, fontWeight: '800' },

  // Vacío
  blank: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 40, gap: 10 },
  blankIcon: {
    width: 48, height: 48, borderRadius: CT.r.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: CT.edge,
  },
  blankTitle: { fontSize: 13, fontWeight: '700', color: CT.ink2, textAlign: 'center' },
  blankNote: { fontSize: 11.5, color: CT.ink3, textAlign: 'center', lineHeight: 17 },

  // Pie
  footer: {
    paddingHorizontal: 18, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CT.hairline,
    backgroundColor: CT.base,
  },
  cta: {
    height: 52, borderRadius: CT.r.md, backgroundColor: CT.signal,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
  },
  ctaOff: { backgroundColor: 'rgba(255,255,255,0.09)' },
  ctaTxt: { fontSize: 14.5, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
})
