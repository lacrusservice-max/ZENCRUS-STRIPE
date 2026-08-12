/**
 * REGIONES DEL CUERPO
 * ───────────────────
 * La rejilla de «qué quiero entrenar hoy»: ocho figuras pequeñas, cada una con
 * su zona encendida.
 *
 * ── La diferencia con las de cualquier otra app ─────────────────────────────
 * En las demás esto son imágenes: ocho PNG con el músculo pintado de azul,
 * iguales para todo el mundo y para siempre. Aquí son los MISMOS trazos que el
 * mapa anatómico grande, así que:
 *
 *   · Se tiñen con TUS datos. La región que llevas dos semanas sin tocar se ve
 *     apagada, y la de ayer se ve caliente. El icono deja de ser una etiqueta y
 *     pasa a ser información.
 *   · Cambian de vista solas. «Espalda» y «Glúteos» se dibujan de espaldas,
 *     porque de frente no se ven. Un PNG de espalda etiquetado «espalda» es lo
 *     que hace que la rejilla del competidor tenga dos iconos casi idénticos.
 *   · No pesan nada y se ven nítidos en cualquier pantalla.
 *
 * ── Ocho, no doce ───────────────────────────────────────────────────────────
 * El catálogo clasifica en doce grupos musculares, pero nadie decide entrenar
 * «antebrazos» un martes. Estas ocho son las que la gente usa para elegir, y
 * cada una agrupa los grupos que de verdad se trabajan juntos.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import Svg, { Path, G, Defs, LinearGradient, Stop } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { LIENZO, ESPEJO, SILUETA, TRAZOS, Vista } from './anatomy'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export interface Region {
  id: string
  label: string
  /** Grupos del catálogo que enciende. */
  grupos: string[]
  /** De frente o de espaldas: se elige la vista donde la zona SE VE. */
  vista: Vista
  /** Filtro que se manda a la biblioteca al tocarla. */
  consulta: { muscle?: string; pattern?: string }
}

export const REGIONES: Region[] = [
  {
    id: 'fullbody', label: 'Todo el cuerpo', vista: 'frente',
    grupos: ['chest', 'shoulders', 'biceps', 'forearms', 'core', 'quads', 'calves'],
    consulta: {},
  },
  {
    id: 'upper', label: 'Tren superior', vista: 'frente',
    grupos: ['chest', 'shoulders', 'biceps', 'forearms'],
    consulta: {},
  },
  {
    id: 'arms', label: 'Brazos', vista: 'frente',
    grupos: ['biceps', 'forearms'],
    consulta: { muscle: 'biceps' },
  },
  {
    id: 'chest', label: 'Pecho', vista: 'frente',
    grupos: ['chest'],
    consulta: { muscle: 'chest' },
  },
  {
    id: 'legs', label: 'Glúteos y piernas', vista: 'espalda',
    grupos: ['glutes', 'hamstrings', 'calves'],
    consulta: { muscle: 'glutes' },
  },
  {
    id: 'back', label: 'Espalda', vista: 'espalda',
    grupos: ['back'],
    consulta: { muscle: 'back' },
  },
  {
    id: 'shoulders', label: 'Hombros', vista: 'espalda',
    grupos: ['shoulders', 'triceps'],
    consulta: { muscle: 'shoulders' },
  },
  {
    id: 'core', label: 'Core', vista: 'frente',
    grupos: ['core'],
    consulta: { muscle: 'core' },
  },
]

// ── La figurita ──────────────────────────────────────────────────────────────

/**
 * Cuánto se ha entrenado cada región, de 0 a 1.
 *
 * Opcional: sin datos, todas las zonas se encienden igual y la rejilla sigue
 * sirviendo para elegir. Con datos, además cuenta algo.
 */
export type CargaPorGrupo = Record<string, number>

function Figurita({ region, tam, carga }: {
  region: Region
  tam: number
  carga?: CargaPorGrupo
}) {
  const alto = tam
  const ancho = (LIENZO.ancho / LIENZO.alto) * alto

  const encendidos = new Set(region.grupos)

  /**
   * El color de cada trazo.
   *
   * Fuera de la región, gris de silueta. Dentro, del rojo tenue al rojo pleno
   * según lo entrenado: así una región «fría» se ve encendida pero apagada, que
   * es exactamente el matiz que hace falta —sigue siendo el icono de pecho
   * aunque lleves un mes sin hacer pecho.
   */
  const color = (grupo: string | null): string => {
    if (!grupo || !encendidos.has(grupo)) return 'rgba(255,255,255,0.07)'
    if (!carga) return Colors.neon.red
    const t = Math.max(0, Math.min(1, carga[grupo] ?? 0))
    return `rgba(255,31,61,${0.42 + t * 0.58})`
  }

  const trazos = TRAZOS[region.vista]
  const silueta = SILUETA[region.vista]

  return (
    <Svg width={ancho} height={alto} viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`}>
      <Defs>
        <LinearGradient id={`piel-${region.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#17171C" />
          <Stop offset="55%" stopColor="#212128" />
          <Stop offset="100%" stopColor="#17171C" />
        </LinearGradient>
      </Defs>

      {/* Silueta, sin contorno: espejada deja costura por el eje. */}
      <G>
        {silueta.map((t, i) => <Path key={`s${i}`} d={t.d} fill={`url(#piel-${region.id})`} />)}
        <G transform={ESPEJO}>
          {silueta.map((t, i) => <Path key={`se${i}`} d={t.d} fill={`url(#piel-${region.id})`} />)}
        </G>
      </G>

      {/* Músculos. A este tamaño el contorno emborrona: se quita. */}
      <G>
        {trazos.map((t, i) => <Path key={`m${i}`} d={t.d} fill={color(t.grupo)} />)}
        <G transform={ESPEJO}>
          {trazos.filter(t => t.par).map((t, i) => <Path key={`me${i}`} d={t.d} fill={color(t.grupo)} />)}
        </G>
      </G>
    </Svg>
  )
}

// ── La rejilla ───────────────────────────────────────────────────────────────

export function RegionGrid({ carga, onElegir, columnas = 4 }: {
  carga?: CargaPorGrupo
  onElegir: (r: Region) => void
  columnas?: number
}) {
  const tocar = (r: Region) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onElegir(r)
  }

  return (
    <View style={s.rejilla}>
      {REGIONES.map((r, i) => (
        <Animated.View
          key={r.id}
          entering={FadeInDown.delay(i * 45).duration(340)}
          style={{ width: `${100 / columnas}%` }}
        >
          <TouchableOpacity style={s.celda} onPress={() => tocar(r)} activeOpacity={0.75}>
            <View style={s.disco}>
              <Figurita region={r} tam={54} carga={carga} />
            </View>
            <Text style={s.etiqueta} numberOfLines={2}>{r.label}</Text>
          </TouchableOpacity>
        </Animated.View>
      ))}
    </View>
  )
}

/** Una sola figurita, para la ficha de un día o de un programa. */
export function RegionChip({ regionId, tam = 46, carga }: {
  regionId: string
  tam?: number
  carga?: CargaPorGrupo
}) {
  const r = REGIONES.find(x => x.id === regionId)
  if (!r) return null
  return (
    <View style={{ alignItems: 'center', gap: 5 }}>
      <View style={[s.disco, { width: tam + 22, height: tam + 22 }]}>
        <Figurita region={r} tam={tam} carga={carga} />
      </View>
      <Text style={s.etiquetaChip} numberOfLines={2}>{r.label}</Text>
    </View>
  )
}

/**
 * De los grupos musculares que toca un ejercicio a la región que los contiene.
 *
 * Sirve para que la ficha de un día enseñe «Pecho · Brazos · Tren superior» a
 * partir de los músculos reales de sus ejercicios, sin que nadie lo etiquete a
 * mano en el plan.
 */
export function regionesDe(grupos: string[]): string[] {
  const set = new Set(grupos)
  return REGIONES
    .filter(r => r.id !== 'fullbody' && r.grupos.some(g => set.has(g)))
    .map(r => r.id)
    .slice(0, 3)
}

const s = StyleSheet.create({
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { alignItems: 'center', gap: 7, paddingVertical: Spacing[3], paddingHorizontal: 2 },
  disco: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  etiqueta: {
    fontSize: 11, fontWeight: '700', color: Colors.neon.w2,
    textAlign: 'center', lineHeight: 14,
  },
  etiquetaChip: {
    fontSize: 10, fontWeight: '700', color: Colors.neon.w3,
    textAlign: 'center', lineHeight: 13, maxWidth: 70,
  },
})
