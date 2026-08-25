/**
 * COMUNIDAD · PIEZAS COMPARTIDAS
 * ──────────────────────────────
 * Los ladrillos que salen en más de una pantalla. Están juntos porque son
 * pequeños y porque así una sola lectura enseña el idioma visual de la sección.
 *
 * Todo se escribe en paleta OSCURA. El interceptor de `@/theme/patch` deriva el
 * tema claro en tiempo de render; escribir aquí colores claros lo rompería.
 */

import React, { useMemo, useRef, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Easing, Share,
  Alert,
  ViewStyle, Pressable,
} from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useAppTheme } from '@/context/ThemeContext'

import * as Haptics from 'expo-haptics'
import { blockUser, errorText } from '@/services/socialService'
import type { Profile } from '@/services/socialService'

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── Avatar ───────────────────────────────────────────────────────────────────

/**
 * Foto de perfil, o las iniciales si no hay.
 *
 * El color de fondo se deriva del identificador, no es aleatorio: así la misma
 * persona tiene siempre el mismo color en toda la app y se la reconoce de un
 * vistazo aunque no tenga foto.
 *
 * `expo-image` y no `Image` de React Native porque las direcciones vienen
 * firmadas y caducan: su caché por memoria evita volver a descargar la misma
 * foto al desplazar, y `recyclingKey` impide que al reciclar una fila se vea un
 * instante la cara de otra persona.
 */
const TONOS = ['#FF1F3D', '#FF7A1F', '#C11FFF', '#1F9DFF', '#12B981', '#F5B31F', '#FF1F8C']

export function Avatar({
  profile, size = 42, ring, onPress,
}: {
  profile?: Profile | null
  size?: number
  /** Aro de color alrededor: lo usan las historias sin ver. */
  ring?: string
  onPress?: () => void
}) {
  const T = useAppTheme()
  const nombre = profile?.fullName ?? profile?.username ?? ''
  const inicial = (nombre.trim()[0] ?? '?').toUpperCase()

  const tono = useMemo(() => {
    const id = profile?.id ?? ''
    let suma = 0
    for (let i = 0; i < id.length; i++) suma = (suma + id.charCodeAt(i)) % 997
    return TONOS[suma % TONOS.length]
  }, [profile?.id])

  const cuerpo = (
    <View style={[
      a.wrap,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: `${tono}2A`, borderColor: `${tono}55` },
    ]}>
      {profile?.avatar ? (
        <Image
          source={{ uri: profile.avatar }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          recyclingKey={profile.id}
          transition={160}
        />
      ) : (
        <Text style={[a.txt, { fontSize: size * 0.4, color: tono }]}>{inicial}</Text>
      )}
    </View>
  )

  const conAro = ring ? (
    <View style={[a.ring, { width: size + 7, height: size + 7, borderRadius: (size + 7) / 2, borderColor: ring }]}>
      <View style={{ borderRadius: size / 2, borderWidth: 2, borderColor: T.bg }}>{cuerpo}</View>
    </View>
  ) : cuerpo

  if (!onPress) return conAro
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{conAro}</TouchableOpacity>
  )
}

const a = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
  txt: { fontWeight: '800' },
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
})

// ── Nombre con candado ───────────────────────────────────────────────────────

/** Nombre visible y, debajo, el usuario. El candado marca cuenta cerrada. */
export function NameBlock({
  profile, size = 15, subtitle,
}: { profile?: Profile | null; size?: number; subtitle?: string }) {
  const T = useAppTheme()
  return (
    <View style={{ flex: 1 }}>
      <View style={n.row}>
        <Text style={[n.name, { color: T.ink, fontSize: size }]} numberOfLines={1}>
          {profile?.fullName ?? profile?.username ?? 'Cuenta ZENCRUS'}
        </Text>
        {profile?.isPrivate && (
          <Ionicons name="lock-closed" size={size * 0.72} color={T.ink3} style={{ marginTop: 1 }} />
        )}
      </View>
      {(subtitle || profile?.username) && (
        <Text style={[n.sub, { color: T.ink3 }]} numberOfLines={1}>
          {subtitle ?? `@${profile?.username}`}
        </Text>
      )}
    </View>
  )
}

const n = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontWeight: '700', flexShrink: 1 },
  sub: { fontSize: 12, marginTop: 1 },
})

// ── Botón ────────────────────────────────────────────────────────────────────

/**
 * Botón dibujado a mano, no el nativo.
 *
 * Tres pesos: `solid` para la acción principal de la pantalla, `soft` para las
 * secundarias y `ghost` para las que no deben pedir atención. Al pulsar baja de
 * escala con un muelle — `Animated` del propio React Native, nada que no exista
 * de verdad en la plataforma.
 */
export function Btn({
  label, onPress, icon, tone = 'soft', disabled, loading, small, style, full,
}: {
  label: string
  onPress: () => void
  icon?: IconName
  tone?: 'solid' | 'soft' | 'ghost' | 'danger'
  disabled?: boolean
  loading?: boolean
  small?: boolean
  full?: boolean
  style?: ViewStyle
}) {
  const T = useAppTheme()
  const escala = useRef(new Animated.Value(1)).current

  const muelle = (to: number) =>
    Animated.spring(escala, { toValue: to, useNativeDriver: true, tension: 380, friction: 14 }).start()

  const paleta = {
    solid:  { bg: T.accent, br: T.accent, fg: '#FFFFFF' },
    soft:   { bg: T.glass, br: T.glassBorder, fg: T.ink },
    ghost:  { bg: 'transparent', br: 'transparent', fg: T.ink2 },
    danger: { bg: 'rgba(255,31,61,0.12)', br: 'rgba(255,31,61,0.32)', fg: '#FF5871' },
  }[tone]

  const apagado = disabled || loading

  return (
    <Animated.View style={[{ transform: [{ scale: escala }] }, full && { flex: 1 }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => !apagado && muelle(0.955)}
        onPressOut={() => muelle(1)}
        disabled={apagado}
        style={[
          b.btn,
          small && b.small,
          { backgroundColor: paleta.bg, borderColor: paleta.br, opacity: apagado ? 0.5 : 1 },
        ]}
      >
        {loading
          ? <ActivityIndicator size="small" color={paleta.fg} />
          : (
            <>
              {icon && <Ionicons name={icon} size={small ? 14 : 16} color={paleta.fg} />}
              <Text style={[b.txt, small && b.txtSmall, { color: paleta.fg }]} numberOfLines={1}>
                {label}
              </Text>
            </>
          )}
      </Pressable>
    </Animated.View>
  )
}

const b = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 14, borderWidth: 1,
  },
  small: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 11 },
  txt: { fontSize: 14, fontWeight: '700' },
  txtSmall: { fontSize: 12.5 },
})

// ── Contador de avisos ───────────────────────────────────────────────────────

/**
 * El puntito rojo con el número.
 *
 * Aparece con un muelle desde cero para que el ojo lo cace; al llegar a cero
 * simplemente deja de existir. Animar la salida obligaría a preguntarle su
 * valor al `Animated.Value`, que es API privada y no es de fiar.
 */
export function Badge({ count, style }: { count: number; style?: ViewStyle }) {
  const T = useAppTheme()
  const escala = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (count > 0) {
      Animated.spring(escala, {
        toValue: 1, useNativeDriver: true, tension: 300, friction: 11,
      }).start()
    } else {
      escala.setValue(0)
    }
  }, [count > 0])

  if (count <= 0) return null

  return (
    <Animated.View style={[bd.dot, { backgroundColor: T.accent, transform: [{ scale: escala }] }, style]}>
      <Text style={bd.txt}>{count > 99 ? '99+' : count}</Text>
    </Animated.View>
  )
}

const bd = StyleSheet.create({
  dot: {
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  txt: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
})

// ── Estado vacío ─────────────────────────────────────────────────────────────

/**
 * Lo que se ve cuando no hay nada.
 *
 * Nunca se deja una pantalla en blanco: un vacío sin explicar se lee como una
 * avería. Siempre hay un icono, una frase que dice por qué está vacío y, si
 * hay algo que hacer al respecto, el botón para hacerlo.
 */
export function Empty({
  icon, title, text, action, onAction, tight,
}: {
  icon: IconName
  title: string
  text?: string
  action?: string
  onAction?: () => void
  tight?: boolean
}) {
  const T = useAppTheme()
  return (
    <View style={[e.wrap, tight && { paddingVertical: 34 }]}>
      <View style={[e.iconBox, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
        <Ionicons name={icon} size={26} color={T.ink3} />
      </View>
      <Text style={[e.title, { color: T.ink }]}>{title}</Text>
      {text && <Text style={[e.text, { color: T.ink3 }]}>{text}</Text>}
      {action && onAction && (
        <Btn label={action} onPress={onAction} tone="soft" small style={{ marginTop: 16 }} />
      )}
    </View>
  )
}

const e = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  iconBox: {
    width: 62, height: 62, borderRadius: 21, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  text: { fontSize: 13, textAlign: 'center', marginTop: 7, lineHeight: 19 },
})

// ── Candado de cuenta privada ────────────────────────────────────────────────

/** Lo que sustituye a la rejilla cuando la cuenta está cerrada. */
export function LockedWall({ requested }: { requested: boolean }) {
  const T = useAppTheme()
  return (
    <View style={[lw.wrap, { borderColor: T.glassBorder, backgroundColor: T.glass }]}>
      <View style={[lw.icon, { backgroundColor: `${T.accent}16`, borderColor: `${T.accent}30` }]}>
        <Ionicons name="lock-closed" size={22} color={T.accent} />
      </View>
      <Text style={[lw.title, { color: T.ink }]}>Esta cuenta es privada</Text>
      <Text style={[lw.text, { color: T.ink3 }]}>
        {requested
          ? 'Ya enviaste tu solicitud. Cuando la acepten verás sus publicaciones aquí.'
          : 'Sigue a esta persona para ver lo que publica y quién la sigue.'}
      </Text>
    </View>
  )
}

const lw = StyleSheet.create({
  wrap: {
    alignItems: 'center', paddingVertical: 40, paddingHorizontal: 34,
    marginHorizontal: 20, borderRadius: 22, borderWidth: 1,
  },
  icon: {
    width: 54, height: 54, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  title: { fontSize: 15.5, fontWeight: '700' },
  text: { fontSize: 13, textAlign: 'center', marginTop: 7, lineHeight: 19 },
})

// ── Esqueleto de carga ───────────────────────────────────────────────────────

/**
 * Bloque gris que late mientras carga.
 *
 * Se prefiere a una ruedecita centrada porque enseña la FORMA de lo que va a
 * llegar: el salto visual al aparecer el contenido es mucho menor.
 */
export function Skeleton({ h = 14, w = '100%', r = 8, style }: {
  h?: number; w?: number | string; r?: number; style?: ViewStyle
}) {
  const T = useAppTheme()
  const pulso = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, { toValue: 0.9, duration: 780, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulso, { toValue: 0.4, duration: 780, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    )
    bucle.start()
    return () => bucle.stop()
  }, [])

  return (
    <Animated.View
      style={[{ height: h, width: w as any, borderRadius: r, backgroundColor: T.ink4, opacity: pulso }, style]}
    />
  )
}

/** Tres tarjetas fantasma mientras llega el muro. */
export function FeedSkeleton() {
  const T = useAppTheme()
  return (
    <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 6 }}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[sk.card, { backgroundColor: T.glass, borderColor: T.glassBorder }]}>
          <View style={sk.head}>
            <Skeleton h={40} w={40} r={20} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton h={12} w={'52%'} />
              <Skeleton h={10} w={'28%'} />
            </View>
          </View>
          <Skeleton h={190} r={16} style={{ marginTop: 13 }} />
        </View>
      ))}
    </View>
  )
}

const sk = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 11 },
})

// ── Cabecera de sección ──────────────────────────────────────────────────────

export function Row({
  icon, color, title, sub, right, onPress, badge,
}: {
  icon: IconName
  color?: string
  title: string
  sub?: string
  right?: React.ReactNode
  onPress?: () => void
  badge?: number
}) {
  const T = useAppTheme()
  const c = color ?? T.accent
  return (
    <TouchableOpacity
      style={[r.row, { backgroundColor: T.glass, borderColor: T.glassBorder }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
    >
      <View style={[r.icon, { backgroundColor: `${c}18`, borderColor: `${c}2E` }]}>
        <Ionicons name={icon} size={18} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[r.title, { color: T.ink }]}>{title}</Text>
        {sub && <Text style={[r.sub, { color: T.ink3 }]} numberOfLines={1}>{sub}</Text>}
      </View>
      {!!badge && badge > 0 && <Badge count={badge} />}
      {right ?? (onPress && <Ionicons name="chevron-forward" size={17} color={T.ink3} />)}
    </TouchableOpacity>
  )
}

const r = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13,
    padding: 13, borderRadius: 17, borderWidth: 1,
  },
  icon: {
    width: 38, height: 38, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14.5, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
})

// ── Tiempo relativo ──────────────────────────────────────────────────────────

/** «ahora», «5 m», «3 h», «2 d», y a partir de la semana la fecha. */
export function timeAgo(iso: string): string {
  const seg = (Date.now() - new Date(iso).getTime()) / 1000
  if (seg < 45) return 'ahora'
  if (seg < 3600) return `${Math.floor(seg / 60)} m`
  if (seg < 86400) return `${Math.floor(seg / 3600)} h`
  if (seg < 604800) return `${Math.floor(seg / 86400)} d`
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/** Cuánto le queda a una historia antes de desaparecer. */
export function timeLeft(iso: string): string {
  const seg = (new Date(iso).getTime() - Date.now()) / 1000
  if (seg <= 0) return 'caducada'
  if (seg < 3600) return `${Math.max(1, Math.floor(seg / 60))} min`
  return `${Math.floor(seg / 3600)} h`
}

// ── Compartir ────────────────────────────────────────────────────────────────

/**
 * Abre la hoja de compartir del sistema con una publicación.
 *
 * ── Se manda el ENLACE, nunca la foto ───────────────────────────────────────
 * Las direcciones de los archivos vienen firmadas y caducan en una hora: quien
 * recibiera una hoy se encontraría un enlace roto mañana. Y aunque no
 * caducaran, mandar el archivo saca la foto del modelo de privacidad —quien la
 * recibe la ve aunque la cuenta sea cerrada—. El enlace lo respeta: al abrirlo,
 * el servidor vuelve a preguntar si esa persona puede ver eso.
 *
 * Cancelar la hoja no es un error, así que no se cuenta.
 */
export async function compartirPost(post: {
  id: string
  content: string | null
  author: Profile | null
}): Promise<void> {
  const quien = post.author?.username ?? post.author?.fullName ?? 'alguien'
  const enlace = `https://zencrus.com/p/${post.id}`
  try {
    await Share.share({
      message: post.content
        ? `«${post.content}» — ${quien} en ZENCRUS\n${enlace}`
        : `Mira lo que ha publicado ${quien} en ZENCRUS\n${enlace}`,
    })
  } catch { /* cancelar no es un fallo */ }
}

// ── Bloquear ─────────────────────────────────────────────────────────────────

/**
 * El aviso antes de bloquear, con lo que de verdad pasa.
 *
 * Vive aquí, y no en cada menú que lo ofrece, para que el texto sea el mismo en
 * los tres sitios desde los que se llega: es una acción que la gente hace
 * enfadada y deprisa, y dos redacciones distintas de lo que implica acaban
 * significando cosas distintas.
 *
 * Se dice lo que se deshace (el seguimiento), lo que NO pasa (no se le avisa) y
 * dónde se deshace — porque al perfil de alguien bloqueado ya no se puede
 * volver, así que sin esa frase el bloqueo parece definitivo.
 */
export function confirmarBloqueo(userId: string, nombre?: string, alHacerlo?: () => void) {
  Alert.alert(
    nombre ? `\u00bfBloquear a @${nombre}?` : '\u00bfBloquear a esta persona?',
    'Dejar\u00e9is de veros: ni perfil, ni publicaciones, ni mensajes, ni en las '
      + 'b\u00fasquedas. Si os segu\u00edais, se deshace. No se le avisa de nada.\n\n'
      + 'Podr\u00e1s deshacerlo desde Mi perfil \u203a Cuentas bloqueadas.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Bloquear',
        style: 'destructive',
        onPress: async () => {
          try {
            await blockUser(userId)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
            alHacerlo?.()
          } catch (e) {
            Alert.alert('No pudimos bloquear', errorText(e))
          }
        },
      },
    ],
  )
}

// ── Degradado de marca ───────────────────────────────────────────────────────

/** El aro de las historias sin ver. Se usa también en acentos puntuales. */
export function BrandRing({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={['#FF1F3D', '#FF7A1F', '#FF1F8C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size, height: size, borderRadius: size / 2,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </LinearGradient>
  )
}
