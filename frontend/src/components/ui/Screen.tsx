import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Colors, Typography, Spacing } from '@/constants/theme'
import { BotonIA } from '@/constants/layout'
import { useAppTheme } from '@/context/ThemeContext'

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── Screen ────────────────────────────────────────────────────────────────────
/**
 * Fondo ambiental compartido por TODA la app.
 *
 * UN SOLO degradado, vertical y a pantalla completa: del acento arriba a
 * transparente abajo. En tema oscuro eso es negro con rojo; en claro, el
 * interceptor de `@/theme/remap` gira el rojo al azul de marca y queda blanco
 * con azul. Un único color de tinte, no dos.
 *
 * ── Por qué se quitaron los dos resplandores de antes ───────────────────────
 * Había un degradado rojo arriba (alto fijo de 420) y otro turquesa a la
 * derecha (ancho fijo de 260), los dos en rectángulos MÁS PEQUEÑOS que la
 * pantalla. Un degradado que no acaba en transparente justo en el borde de su
 * caja se corta en seco ahí, y eso dibujaba dos costuras rectas visibles en
 * todas las pantallas: una vertical a 260 px del lado derecho —donde moría el
 * turquesa— y otra horizontal a 420 px de arriba. La app parecía partida en un
 * cuadrante rojizo y otro azulado.
 *
 * Las dos reglas que lo evitan, y que hay que respetar si algún día se añade
 * otra capa aquí:
 *   1. La caja del degradado es la PANTALLA ENTERA, no un trozo.
 *   2. El último color es `transparent`, para que el borde no se note.
 */

interface ScreenProps {
  children: React.ReactNode
  style?: ViewStyle
  /** Tinte del fondo. Por defecto el acento de marca. */
  tint?: string
}

export function Screen({ children, style, tint }: ScreenProps) {
  const T = useAppTheme()
  const accent = tint ?? T.accent
  return (
    <View style={[sc.root, { backgroundColor: T.bg }]}>
      <LinearGradient
        colors={[`${accent}1F`, `${accent}0A`, 'transparent']}
        // Se apaga en el primer 55 % de la altura: lo que se busca es que la
        // cabecera tenga temperatura, no teñir la pantalla entera.
        locations={[0, 0.22, 0.55]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={[sc.safe, style]} edges={['top']}>
        {children}
      </SafeAreaView>
    </View>
  )
}

const sc = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
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
  /**
   * A dónde va esa flecha. Por defecto vuelve atrás, y si NO HAY atrás sale a
   * la portada de la app.
   *
   * Esa comprobación no es un lujo: una pantalla a la que se llega con
   * `router.replace` —como las del menú de Entrena, que reemplaza para no
   * apilar— se queda sin historial, y un `router.back()` a secas revienta con
   * «GO_BACK was not handled by any navigator» dejando el botón muerto.
   */
  onBack?: () => void
  /** Contenido a la derecha (botón de acción, badge, etc). */
  right?: React.ReactNode
}

export function ScreenHeader({
  eyebrow, title, subtitle, icon, color, back, onBack, right,
}: ScreenHeaderProps) {
  const T = useAppTheme()
  const c = color ?? T.accent
  const volver = onBack ?? (() => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  })
  return (
    <View style={sh.wrap}>
      {back && (
        <TouchableOpacity
          style={[sh.backBtn, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
          onPress={volver}
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
  /**
   * El margen derecho reserva la esquina para el botón de ZENA, que flota sobre
   * todas las pantallas desde `_layout`.
   *
   * Sin él, las doce pantallas que ya ponen algo aquí —añadir una meta, marcar
   * todo como leído— acaban con dos botones pisados uno encima del otro, y el
   * de abajo deja de poder tocarse.
   */
  right: { paddingTop: 2, marginRight: BotonIA.reserva },
})
