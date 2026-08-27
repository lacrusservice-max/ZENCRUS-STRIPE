/**
 * AL AIRE LIBRE · MATERIAL
 * ════════════════════════
 * Las piezas que se repiten en las veintitantas pantallas del módulo. Están
 * aquí y no sueltas por cada fichero porque el vidrio son TRES capas y basta
 * con que una pantalla se olvide de la del filo para que se note que no es la
 * misma app.
 *
 * ── Por qué no vale `GlassCard` ─────────────────────────────────────────────
 * La tarjeta de `components/ui/Glass` es de una capa: un fondo translúcido y
 * un borde. Sirve para el resto de ZENCRUS, donde las tarjetas están quietas
 * sobre un fondo casi negro. Aquí van encima de un mapa o de un fondo teñido
 * por la zona de esfuerzo, y sin el degradado diagonal y el filo superior se
 * leen como un rectángulo gris pegado encima.
 */

import { View, Text, StyleSheet, Pressable, ViewStyle, StyleProp, TextStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Canvas, Rect, RadialGradient, vec } from '@shopify/react-native-skia'
import {
  RunningColors, OutdoorMaterial, OutdoorAura, OutdoorZones, OutdoorZona,
} from '@/constants/running-tokens'

// ── Tarjeta ──────────────────────────────────────────────────────────────────

/**
 * El vidrio. `brasa` la enciende para lo que se toca o lo que urge.
 *
 * `plana` quita el relleno para las tarjetas que empiezan con un mapa o una
 * gráfica a sangre: el hijo se encarga de su propio margen.
 */
export function Tarjeta({
  children, brasa, plana, style,
}: {
  children: React.ReactNode
  brasa?: boolean
  plana?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const m = brasa ? OutdoorMaterial.brasa : OutdoorMaterial.vidrio
  return (
    <View style={[t.sombra, style]}>
      <View style={[t.recorte, { borderColor: m.borde }]}>
        <LinearGradient
          colors={m.degradado as unknown as [string, string, string]}
          locations={m.paradas as unknown as [number, number, number]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* La luz que entra por el canto. Es la capa que hace el efecto. */}
        <View style={[t.filo, { backgroundColor: m.filo }]} />
        <View style={plana ? undefined : t.relleno}>{children}</View>
      </View>
    </View>
  )
}

const t = StyleSheet.create({
  sombra: { ...OutdoorMaterial.sombra, borderRadius: OutdoorMaterial.radio },
  recorte: {
    borderRadius: OutdoorMaterial.radio,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  filo: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  relleno: { paddingVertical: 14, paddingHorizontal: 15 },
})

// ── Aura ─────────────────────────────────────────────────────────────────────

/**
 * El fondo teñido por la zona de esfuerzo.
 *
 * Dos focos: uno grande arriba —donde vive la cifra— y otro menor abajo a la
 * derecha, que evita que la mitad inferior se vea muerta cuando la tarjeta de
 * mandos no llega hasta el borde.
 *
 * Se dibuja con Skia porque `expo-linear-gradient` no hace radiales, y un
 * radial falso a base de capas cuesta más de lo que parece: se ven los bordes.
 */
export function Aura({
  zona, pausado, ancho, alto,
}: {
  /** Índice 0-4. Si falta, tiñe con el rojo de marca. */
  zona?: OutdoorZona
  /** En pausa el color de zona se retira: se ve que ya no cuenta. */
  pausado?: boolean
  ancho: number
  alto: number
}) {
  const base = pausado
    ? OutdoorAura.pausado
    : zona != null
      ? OutdoorZones[zona].color
      : RunningColors.signal.base

  const conAlfa = (hex: string, a: number) => {
    const n = hex.replace('#', '')
    const v = n.length === 3 ? n.split('').map(c => c + c).join('') : n
    const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width: ancho, height: alto }]} pointerEvents="none">
      <Rect x={0} y={0} width={ancho} height={alto}>
        <RadialGradient
          c={vec(ancho / 2, -alto * 0.1)}
          r={ancho * 1.18}
          colors={[conAlfa(base, OutdoorAura.opacidadArriba), conAlfa(base, 0)]}
        />
      </Rect>
      <Rect x={0} y={0} width={ancho} height={alto}>
        <RadialGradient
          c={vec(ancho * 0.86, alto * 1.06)}
          r={ancho * 0.86}
          colors={[conAlfa(base, OutdoorAura.opacidadAbajo), conAlfa(base, 0)]}
        />
      </Rect>
    </Canvas>
  )
}

// ── Etiqueta, divisor, chip y botón ──────────────────────────────────────────

/**
 * El rótulo en versalitas que va encima de cada dato.
 *
 * Las mayúsculas las pone `textTransform`, NO `String(children).toUpperCase()`.
 * Con más de un hijo —«de {meta}», o un texto con salto de línea— `String()`
 * recibe un array y lo une con comas: en pantalla salía «SIN, ,REGISTRAR».
 */
export function Etiqueta({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[p.etiqueta, style]}>{children}</Text>
}

/** Separador que se apaga en los extremos: una línea a sangre corta la tarjeta. */
export function Divisor({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
      locations={[0, 0.18, 0.82, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[p.divisor, style]}
    />
  )
}

export function Chip({
  children, activo, tono, style,
}: {
  children: React.ReactNode
  activo?: boolean
  /** Un color de zona o de estado. Tiñe fondo, borde y texto a la vez. */
  tono?: string
  style?: StyleProp<ViewStyle>
}) {
  const teñido = tono
    ? { backgroundColor: tono + '2E', borderColor: tono + '7A' }
    : null
  return (
    <View style={[p.chip, activo && p.chipActivo, teñido, style]}>
      <Text style={[p.chipTexto, activo && p.chipTextoActivo, tono ? { color: tono } : null]}>
        {children}
      </Text>
    </View>
  )
}

export function Boton({
  children, rojo, onPress, style,
}: {
  children: React.ReactNode
  rojo?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [p.boton, rojo && p.botonSombra, pressed && { opacity: 0.82 }, style]}
    >
      <LinearGradient
        colors={rojo ? ['#FF7A1F', RunningColors.signal.base, '#FF5C00'] : ['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.06)']}
        locations={rojo ? [0, 0.54, 1] : [0, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[p.botonFilo, { backgroundColor: rojo ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.2)' }]} />
      <Text style={p.botonTexto}>{children}</Text>
    </Pressable>
  )
}

const p = StyleSheet.create({
  etiqueta: {
    textTransform: 'uppercase',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.42)',
  },
  divisor: { height: 1, marginVertical: 11 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.13)',
    alignSelf: 'flex-start',
  },
  chipActivo: { backgroundColor: '#fff', borderColor: '#fff' },
  chipTexto: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.62)', letterSpacing: -0.05 },
  chipTextoActivo: { color: '#0D0D10' },
  boton: {
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  botonSombra: {
    borderColor: 'transparent',
    shadowColor: RunningColors.signal.base,
    shadowOpacity: 0.85,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  botonFilo: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  botonTexto: { fontSize: 14.5, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
})
