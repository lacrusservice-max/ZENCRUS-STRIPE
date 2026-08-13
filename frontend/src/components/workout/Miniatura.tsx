/**
 * MINIATURAS DE EJERCICIO
 * ───────────────────────
 * La imagen real de un ejercicio, en pequeño. Es la pieza que sustituye a los
 * puntos de color por toda la sección.
 *
 * ── Por qué un punto de color no valía ──────────────────────────────────────
 * Un punto obliga a LEER el nombre para saber de qué ejercicio se habla, y
 * encima hay que aprenderse qué significa cada color. La foto se reconoce antes
 * de leer nada: quien ha hecho press banca cien veces identifica la postura de
 * un vistazo. Es el mismo motivo por el que una lista de canciones lleva
 * carátulas y no doce puntos de colores.
 *
 * ── El hueco vacío también dice algo ────────────────────────────────────────
 * Cuando no hay póster —un ejercicio escrito a mano, una máquina rara del
 * gimnasio— sale el hueco con su icono, NO la foto de otro ejercicio parecido.
 * Inventarse una imagen sería mentir sobre lo que se hizo.
 *
 * ── Y nunca hay un rectángulo gris parpadeando ──────────────────────────────
 * Las URL vienen firmadas y tardan lo que tarde la red. El fondo del hueco es
 * el mismo tono del marco, así que mientras la imagen no llega se ve una pieza
 * acabada y no un agujero.
 */

import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Spacing } from '@/constants/theme'

interface Props {
  poster?: string | null
  /** Lado en píxeles. El radio se calcula solo para que no se deforme. */
  tam?: number
  icono?: keyof typeof Ionicons.glyphMap
  estilo?: StyleProp<ViewStyle>
}

export function Miniatura({ poster, tam = 46, icono = 'barbell-outline', estilo }: Props) {
  // Radio proporcional: un 24 % del lado. Fijarlo en 12 px haría que una
  // miniatura de 28 px pareciera un círculo y una de 72 px, un cuadrado.
  const radio = Math.round(tam * 0.24)

  return (
    <View style={[m.marco, { width: tam, height: tam, borderRadius: radio }, estilo]}>
      {poster ? (
        <Image
          source={{ uri: poster }}
          style={m.img}
          contentFit="cover"
          transition={180}
        />
      ) : (
        <View style={m.vacia}>
          <Ionicons name={icono} size={Math.round(tam * 0.38)} color={Colors.neon.w4} />
        </View>
      )}
    </View>
  )
}

/**
 * Varias miniaturas superpuestas, como un mazo de cartas.
 *
 * Para las tarjetas que resumen un conjunto —una sesión del historial, una
 * rutina guardada—. Se solapan a propósito: en fila ocuparían el ancho entero
 * y competirían con el texto; en mazo ocupan un tercio.
 *
 * ── `restantes` va por defecto a cero, y no se calcula solo ─────────────────
 * La tentación es deducirlo de la lista («tengo 6 y enseño 3, luego +3»), pero
 * casi siempre sería MENTIRA: las miniaturas de una sesión del historial vienen
 * ya recortadas a cuatro por el servidor, así que la lista no sabe cuántos
 * ejercicios hubo de verdad. Un «+1» donde hubo nueve es peor que no decir
 * nada. Solo debe pasarlo quien tenga el total auténtico delante.
 */
export function MazoMiniaturas({ posters, tam = 38, max = 4, restantes = 0 }: {
  posters: (string | null | undefined)[]
  tam?: number
  max?: number
  /** Cuántos hay de más, si de verdad se sabe. */
  restantes?: number
}) {
  const usables = posters.slice(0, max)
  const sobran = restantes
  const solape = Math.round(tam * 0.3)

  if (usables.length === 0) return null

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {usables.map((p, i) => (
        <Miniatura
          key={i}
          poster={p}
          tam={tam}
          estilo={[
            i > 0 && { marginLeft: -solape },
            // Borde del color del fondo, no una línea clara: es lo que separa
            // una carta de la de debajo sin dibujar un marco encima de la foto.
            { borderColor: Colors.neon.void, borderWidth: 2, zIndex: max - i },
          ]}
        />
      ))}
      {sobran > 0 && (
        <View
          style={[
            mz.mas,
            { width: tam, height: tam, borderRadius: Math.round(tam * 0.24), marginLeft: -solape },
          ]}
        >
          <Text style={[mz.masTxt, { fontSize: Math.round(tam * 0.3) }]}>+{sobran}</Text>
        </View>
      )}
    </View>
  )
}

const m = StyleSheet.create({
  marco: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  img: { width: '100%', height: '100%' },
  vacia: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})

const mz = StyleSheet.create({
  mas: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.paneHi,
    borderWidth: 2, borderColor: Colors.neon.void,
  },
  masTxt: { fontWeight: '800', color: Colors.neon.w2 },
})

/**
 * Una fila de ejercicio: número, miniatura, nombre y lo que sea que vaya a la
 * derecha.
 *
 * Se repite igual en las tres pantallas —rutinas, sesión activa, historial— y
 * tenerla escrita tres veces garantizaba que en un mes tuvieran tres alturas
 * distintas y tres tamaños de miniatura distintos.
 */
export function FilaEjercicio({ n, poster, nombre, sub, derecha, borde = true }: {
  n?: number
  poster?: string | null
  nombre: string
  sub?: string
  derecha?: React.ReactNode
  borde?: boolean
}) {
  return (
    <View style={[fe.fila, borde && fe.conBorde]}>
      {n !== undefined && <Text style={fe.num}>{n}</Text>}
      <Miniatura poster={poster} tam={44} />
      <View style={{ flex: 1 }}>
        <Text style={fe.nombre} numberOfLines={1}>{nombre}</Text>
        {sub ? <Text style={fe.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {derecha}
    </View>
  )
}

const fe = StyleSheet.create({
  fila: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[2] + 2,
  },
  conBorde: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.055)' },
  num: { width: 14, fontSize: 11, fontWeight: '800', color: Colors.neon.w4 },
  nombre: { fontSize: 14, fontWeight: '700', color: Colors.neon.white },
  sub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
})
