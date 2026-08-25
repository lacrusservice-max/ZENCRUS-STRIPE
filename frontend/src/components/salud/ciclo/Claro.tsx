/**
 * CICLO · LAS PIEZAS DEL TEMA CLARO
 * ═══════════════════════════════════════════════════════════════════════════
 * Los ladrillos que repiten las ocho pantallas del mockup: el fondo, la
 * tarjeta blanca, el chip de selección, el azulejo de icono y la barra de
 * intensidad.
 *
 * ── Por qué están juntos y no dentro de cada pantalla ──────────────────────
 * En el mockup el mismo chip aparece en el registro diario, en la predicción y
 * en la comunidad. Copiado en tres sitios, el día que cambie el radio quedarán
 * dos versiones y la app se verá descosida — que es exactamente lo que
 * distingue una app cuidada de una hecha a trozos.
 *
 * ── La barra de estado ─────────────────────────────────────────────────────
 * El resto de ZENCRUS es negro y pide iconos claros arriba. Aquí el fondo es
 * claro y esos iconos desaparecen. `Pantalla` lo cambia al entrar; volver a
 * ponerlo al salir es cosa del layout del módulo, no de cada pantalla.
 */

import type { ReactNode } from 'react'
import {
  View, Text, StyleSheet, Pressable, Image,
  type ViewStyle, type ImageStyle, type StyleProp,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { ICONO, type NombreIcono } from '@/features/salud/ciclo/iconos'
import {
  SUP, TEXTO, RADIO, SOMBRA, FUENTE, ACENTO, HUECO,
} from '@/theme/salud/cicloClaro'
import { elegir } from '@/utils/haptica'

/* ── El fondo de la pantalla ────────────────────────────────────────────── */

export function Pantalla({ fondo, children, bordes = ['top'] }: {
  fondo: string
  children: ReactNode
  bordes?: ('top' | 'bottom')[]
}) {
  return (
    <View style={[s.raiz, { backgroundColor: fondo }]}>
      <StatusBar style="dark" />
      <SafeAreaView style={s.flex} edges={bordes}>{children}</SafeAreaView>
    </View>
  )
}

/* ── La tarjeta blanca ──────────────────────────────────────────────────── */

export function Tarjeta({ children, style, tono }: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Para las tarjetas de color del mockup (nutrición verde, entrena lila). */
  tono?: string
}) {
  return (
    <View style={[s.tarjeta, tono ? { backgroundColor: tono } : null, style]}>
      {children}
    </View>
  )
}

/* ── El azulejo de icono ────────────────────────────────────────────────── */

/**
 * El cuadrado redondeado con fondo suave que precede a cada título de sección.
 * El icono va con `resizeMode: contain` porque los PNG del mockup no son
 * cuadrados —van de 101×140 a 140×133— y estirarlos los deforma.
 */
export function Azulejo({ icono, fondo, tam = 44, icono_tam }: {
  icono: NombreIcono
  fondo: string
  tam?: number
  icono_tam?: number
}) {
  const dentro = icono_tam ?? Math.round(tam * 0.52)
  return (
    <View style={[s.azulejo, { width: tam, height: tam, backgroundColor: fondo }]}>
      <Image source={ICONO[icono]} style={{ width: dentro, height: dentro }}
             resizeMode="contain" />
    </View>
  )
}

/** Un icono suelto del mockup, sin caja. */
export function Icono({ nombre, tam = 22, style }: {
  nombre: NombreIcono
  tam?: number
  style?: StyleProp<ImageStyle>
}) {
  return (
    <Image source={ICONO[nombre]} style={[{ width: tam, height: tam }, style]}
           resizeMode="contain" />
  )
}

/* ── El chip de selección ───────────────────────────────────────────────── */

export function Chip({ texto, activo, onPress, color = ACENTO.rojo, ancho }: {
  texto: string
  activo: boolean
  onPress: () => void
  /** El color de selección cambia por sección: rojo en síntomas, rosa en vida
      sexual, verde en antojos. Es el mockup, no un capricho. */
  color?: string
  ancho?: ViewStyle['width']
}) {
  return (
    <Pressable
      onPress={() => { elegir(); onPress() }}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={({ pressed }) => [
        s.chip,
        ancho !== undefined && { width: ancho },
        activo ? { backgroundColor: color, borderColor: color } : null,
        pressed && s.pulsado,
      ]}
    >
      <Text style={[s.chipTxt, activo && s.chipTxtOn]} numberOfLines={1}>{texto}</Text>
    </Pressable>
  )
}

/* ── La barra de intensidad ─────────────────────────────────────────────── */

/**
 * Cinco tramos con una palabra en cada extremo: «Leve ▬▬▬░░ Intenso».
 *
 * Se toca un tramo y se rellenan ese y los anteriores, como una puntuación.
 * Tocar el tramo que ya está seleccionado lo APAGA: sin esa salida, marcar un
 * síntoma por error dejaría un dato falso que no hay manera de retirar, y en
 * un historial que alimenta correlaciones un dato falso es peor que un hueco.
 */
export function Intensidad({ valor, onValor, color, izquierda, derecha }: {
  /** 0 = sin marcar. 1..5 = tramos rellenos. */
  valor: number
  onValor: (v: number) => void
  color: string
  izquierda: string
  derecha: string
}) {
  return (
    <View style={s.intensidad}>
      <Text style={s.intExtremo}>{izquierda}</Text>
      <View style={s.intTramos}>
        {[1, 2, 3, 4, 5].map(n => (
          <Pressable
            key={n}
            onPress={() => { elegir(); onValor(valor === n ? 0 : n) }}
            accessibilityRole="adjustable"
            accessibilityLabel={`${izquierda} a ${derecha}, nivel ${n} de 5`}
            hitSlop={{ top: 12, bottom: 12 }}
            style={s.intGolpe}
          >
            <View style={[s.intBarra, n <= valor && { backgroundColor: color }]} />
          </Pressable>
        ))}
      </View>
      <Text style={s.intExtremo}>{derecha}</Text>
    </View>
  )
}

/* ── El rótulo de sección: azulejo + título ─────────────────────────────── */

export function Seccion({ icono, fondo, titulo, derecha }: {
  icono: NombreIcono
  fondo: string
  titulo: string
  derecha?: ReactNode
}) {
  return (
    <View style={s.seccion}>
      <Azulejo icono={icono} fondo={fondo} />
      {/* Dos líneas, no una: «Síntomas más frecuentes» con el contador al lado
          no cabe a 19 px en un iPhone de 375 pt, y cortado con puntos
          suspensivos parece que la app se quedó a medias. */}
      <Text style={s.seccionTxt} numberOfLines={2}>{titulo}</Text>
      {derecha ? <View style={s.seccionDer}>{derecha}</View> : null}
    </View>
  )
}

/* ── El botón negro de avanzar ──────────────────────────────────────────── */

export function BotonPrincipal({ texto, onPress, desactivado }: {
  texto: string
  onPress: () => void
  desactivado?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desactivado}
      accessibilityRole="button"
      style={({ pressed }) => [s.principal, desactivado && s.principalOff, pressed && s.pulsado]}
    >
      <Text style={s.principalTxt}>{texto}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  raiz: { flex: 1 },
  flex: { flex: 1 },

  tarjeta: {
    backgroundColor: SUP.tarjeta,
    borderRadius: RADIO.tarjeta,
    padding: 20,
    ...SOMBRA,
  },

  azulejo: {
    borderRadius: RADIO.icono,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chip: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: RADIO.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUP.tarjeta,
    borderWidth: 1.5,
    borderColor: SUP.bordeChip,
  },
  chipTxt: { fontFamily: FUENTE.medio, fontSize: 14.5, color: TEXTO.medio },
  chipTxtOn: { color: TEXTO.sobreColor },

  intensidad: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  intExtremo: { fontFamily: FUENTE.medio, fontSize: 12.5, color: TEXTO.suave },
  intTramos: { flex: 1, flexDirection: 'row', gap: 7 },
  intGolpe: { flex: 1, justifyContent: 'center' },
  intBarra: {
    height: 11,
    borderRadius: 6,
    backgroundColor: '#E4DCF2',
  },

  seccion: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  seccionTxt: {
    flex: 1,
    fontFamily: FUENTE.titulo,
    fontSize: 19,
    color: TEXTO.fuerte,
    letterSpacing: -0.3,
  },
  seccionDer: { marginLeft: HUECO.sm },

  principal: {
    height: 62,
    borderRadius: RADIO.boton,
    backgroundColor: '#1F1A22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  principalOff: { backgroundColor: '#C9C2D6' },
  principalTxt: {
    fontFamily: FUENTE.fuerte,
    fontSize: 17.5,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  pulsado: { opacity: 0.72, transform: [{ scale: 0.985 }] },
})
