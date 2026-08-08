import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Colors, Typography, Spacing } from '@/constants/theme'
import { useAppTheme } from '@/context/ThemeContext'

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── Screen ────────────────────────────────────────────────────────────────────
// Fondo ambiental compartido por TODA la app. Reemplaza el negro plano #080808
// que hacía que cada pantalla se viera idéntica y sin profundidad.

interface ScreenProps {
  children: React.ReactNode
  style?: ViewStyle
  /** Tinte del resplandor superior. Por defecto el azul de marca. */
  tint?: string
}

export function Screen({ children, style, tint }: ScreenProps) {
  const T = useAppTheme()
  const accent = tint ?? T.accent
  return (
    <View style={[sc.root, { backgroundColor: T.bg }]}>
      <LinearGradient
        colors={[`${accent}22`, `${accent}06`, 'transparent']}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.85, y: 0.55 }}
        style={sc.glowTop}
        pointerEvents="none"
      />
      {T.isDark && (
        <LinearGradient
          colors={['transparent', 'rgba(0,194,192,0.07)', 'transparent']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.2, y: 0.7 }}
          style={sc.glowRight}
          pointerEvents="none"
        />
      )}
      <SafeAreaView style={[sc.safe, style]} edges={['top']}>
        {children}
      </SafeAreaView>
    </View>
  )
}

const sc = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  glowTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  glowRight: { position: 'absolute', top: 0, right: 0, width: 260, height: 560 },
})

// ── ScreenHeader ──────────────────────────────────────────────────────────────
// Jerarquía tipográfica única para toda la app: eyebrow de marca + título
// display grande + subtítulo opcional. Antes cada pantalla usaba su propio
// tamaño (sm/base/lg/2xl) y por eso nada se leía como "la misma app".

interface ScreenHeaderProps {
  /** Texto pequeño en mayúsculas sobre el título. Ej: "NUTRICIÓN" */
  eyebrow?: string
  title: string
  subtitle?: string
  /** Ionicon mostrado en un cuadro de color a la izquierda del título. */
  icon?: IconName
  /** Color del icono y del eyebrow. Por defecto azul de marca. */
  color?: string
  /** Muestra flecha de regreso. */
  back?: boolean
  /** Contenido a la derecha (botón de acción, badge, etc). */
  right?: React.ReactNode
}

export function ScreenHeader({
  eyebrow, title, subtitle, icon, color, back, right,
}: ScreenHeaderProps) {
  const T = useAppTheme()
  const c = color ?? T.accent
  return (
    <View style={sh.wrap}>
      {back && (
        <TouchableOpacity
          style={[sh.backBtn, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={T.ink2} />
        </TouchableOpacity>
      )}
      <View style={sh.row}>
        <View style={sh.left}>
          {eyebrow && <Text style={[sh.eyebrow, { color: c }]}>{eyebrow.toUpperCase()}</Text>}
          <View style={sh.titleRow}>
            {icon && (
              <View style={[sh.iconBox, { backgroundColor: `${c}1f`, borderColor: `${c}30` }]}>
                <Ionicons name={icon} size={19} color={c} />
              </View>
            )}
            <Text style={[sh.title, { color: T.ink }]} numberOfLines={2}>{title}</Text>
          </View>
          {subtitle && <Text style={[sh.subtitle, { color: T.ink3 }]}>{subtitle}</Text>}
        </View>
        {right && <View style={sh.right}>{right}</View>}
      </View>
    </View>
  )
}

const sh = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing[5], paddingTop: Spacing[3], paddingBottom: Spacing[4] },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing[3],
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  left: { flex: 1 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 3, marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  iconBox: {
    width: 40, height: 40, borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: Typography.fontFamily.display,
    fontSize: 32,
    letterSpacing: 0.2,
  },
  subtitle: { fontSize: Typography.fontSize.xs, marginTop: 7, lineHeight: 18 },
  right: { paddingTop: 2 },
})
