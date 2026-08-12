/**
 * MENÚ DE LA SECCIÓN ENTRENA
 * ──────────────────────────
 * El índice de la sección: cinco sitios, siempre visibles, siempre en el mismo
 * orden y en el mismo lugar de la pantalla.
 *
 * ── Por qué un menú propio y no más pestañas abajo ──────────────────────────
 * La barra inferior es de la APP —Inicio, Nutrición, Entrena, Progreso,
 * Comunidad, Perfil— y meterle cinco destinos más de una sola sección la
 * convertiría en un listado. Este menú vive dentro de Entrena y solo habla de
 * Entrena: al salir de la sección desaparece, que es lo que se espera.
 *
 * ── Los cinco caben sin desplegar ───────────────────────────────────────────
 * Nada de «más…» ni de menú hamburguesa. Un destino que hay que buscar detrás
 * de un botón es un destino que no se visita: la biblioteca de 206 ejercicios
 * lleva meses construida y sin una entrada visible casi nadie llegaría a ella.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

export type Destino = 'hoy' | 'cuerpo' | 'biblioteca' | 'progreso' | 'records'

/**
 * Volver, venga uno de donde venga.
 *
 * El menú navega con `replace` para no apilar pantallas, y eso deja a la de
 * destino SIN historial: un `router.back()` a secas revienta con «GO_BACK was
 * not handled by any navigator» y el botón de atrás no hace nada. Pasó con la
 * biblioteca en cuanto se entró por el menú en vez de por la portada.
 *
 * Preguntar primero cubre los dos caminos: si se llegó apilando, se vuelve; si
 * se llegó reemplazando, se sale a la portada de la sección, que es a donde
 * espera ir cualquiera que pulse atrás dentro de Entrena.
 */
export function volverAEntrena(): void {
  if (router.canGoBack()) router.back()
  else router.replace('/(tabs)/workout')
}

const DESTINOS: { id: Destino; label: string; icono: keyof typeof Ionicons.glyphMap; ruta: string }[] = [
  { id: 'hoy',        label: 'Hoy',        icono: 'today-outline',    ruta: '/(tabs)/workout' },
  { id: 'cuerpo',     label: 'Cuerpo',     icono: 'body-outline',     ruta: '/workout/cuerpo' },
  { id: 'biblioteca', label: 'Biblioteca', icono: 'library-outline',  ruta: '/workout/library' },
  { id: 'progreso',   label: 'Progreso',   icono: 'trending-up',      ruta: '/workout/stats' },
  { id: 'records',    label: 'Récords',    icono: 'trophy-outline',   ruta: '/workout/records' },
]

export function MenuSeccion({ activo }: { activo: Destino }) {
  const ir = (d: typeof DESTINOS[number]) => {
    if (d.id === activo) return
    void Haptics.selectionAsync()
    // `replace` y no `push`: el menú navega entre hermanos, no baja un nivel.
    // Con `push`, ir de Hoy a Cuerpo y de ahí a Progreso dejaría tres pantallas
    // apiladas y el botón de atrás recorrería el menú al revés.
    router.replace(d.ruta as never)
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // flexGrow:0 o el scroll horizontal crece dentro de la columna y aplasta
      // a sus hijos hasta dejar las pastillas sin texto.
      style={s.scroll}
      contentContainerStyle={s.contenido}
    >
      {DESTINOS.map(d => {
        const on = d.id === activo
        return (
          <TouchableOpacity
            key={d.id}
            style={[s.chip, on && s.chipOn]}
            onPress={() => ir(d)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={d.icono}
              size={14}
              color={on ? Colors.neon.white : Colors.neon.w3}
            />
            <Text style={[s.txt, on && s.txtOn]}>{d.label}</Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

/** Cabecera corta para las pantallas de dentro de la sección. */
export function CabeceraSeccion({ titulo, subtitulo, derecha }: {
  titulo: string
  subtitulo?: string
  derecha?: React.ReactNode
}) {
  return (
    <View style={cs.wrap}>
      <TouchableOpacity onPress={volverAEntrena} hitSlop={10} style={cs.atras}>
        <Ionicons name="chevron-back" size={22} color={Colors.neon.w2} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={cs.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={cs.sub}>{subtitulo}</Text> : null}
      </View>
      {derecha}
    </View>
  )
}

const s = StyleSheet.create({
  /**
   * Las DOS propiedades, no una.
   *
   * `flexGrow: 0` impide que el scroll horizontal se estire y aplaste a sus
   * hijos. `flexShrink: 0` impide lo contrario: que el contenido de debajo lo
   * COMPRIMA y corte las pastillas por la mitad. Con solo la primera, el menú
   * salía recortado a media altura en la portada, que es la pantalla con más
   * cosas debajo.
   *
   * Es el mismo tropiezo que los filtros invisibles de la biblioteca, una
   * propiedad más allá.
   */
  scroll: { flexGrow: 0, flexShrink: 0 },
  contenido: {
    gap: Spacing[2], alignItems: 'center',
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing[3], paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.neon.edge,
    backgroundColor: Colors.neon.pane,
  },
  chipOn: { borderColor: 'rgba(255,31,61,0.45)', backgroundColor: Colors.neon.redDim },
  txt: { fontSize: 12, fontWeight: '700', color: Colors.neon.w3 },
  txtOn: { color: Colors.neon.white },
})

const cs = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    paddingHorizontal: Spacing[4], paddingTop: Spacing[2], paddingBottom: Spacing[3],
  },
  atras: { padding: 2 },
  titulo: { fontSize: 22, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.4 },
  sub: { fontSize: 12, color: Colors.neon.w3, marginTop: 1 },
})
