/**
 * MENÚ DE LA SECCIÓN ENTRENA
 * ──────────────────────────
 * El índice de la sección: cuatro sitios, siempre visibles, siempre en el mismo
 * orden y en el mismo lugar de la pantalla.
 *
 * ── Por qué un menú propio y no más pestañas abajo ──────────────────────────
 * La barra inferior es de la APP —Inicio, Nutrición, Entrena, Progreso,
 * Comunidad, Perfil— y meterle cuatro destinos más de una sola sección la
 * convertiría en un listado. Este menú vive dentro de Entrena y solo habla de
 * Entrena: al salir de la sección desaparece, que es lo que se espera.
 *
 * ── Los cuatro caben sin desplegar ──────────────────────────────────────────
 * Nada de «más…» ni de menú hamburguesa. Un destino que hay que buscar detrás
 * de un botón es un destino que no se visita: la biblioteca de 206 ejercicios
 * lleva meses construida y sin una entrada visible casi nadie llegaría a ella.
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { BotonIA } from '@/constants/layout'

export type Destino = 'hoy' | 'descubre' | 'progreso' | 'records'

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
/**
 * La elección de Entrena —gimnasio, running o casa—, que es el PADRE de las tres
 * portadas y de todo lo que cuelga de ellas.
 *
 * El respaldo apuntaba a `/workout/gym`, y eso creaba un callejón sin salida:
 * estando EN la portada de gimnasio sin historial detrás, `replace` la
 * sustituía por sí misma. Pulsabas volver, no pasaba nada, y no había forma de
 * salir sin reiniciar la app. Desde casa o running era menos grave pero también
 * falso: te dejaba en el gimnasio, que no es de donde venías.
 *
 * Ninguna pantalla de dentro de Entrena ES la elección, así que apuntando aquí
 * el reemplazo nunca puede caer sobre sí mismo.
 */
const ELECCION_ENTRENA = '/(tabs)/workout'

/**
 * Un «volver» que nunca se queda mudo, para pantallas con otro padre natural.
 *
 * Devuelve el manejador en vez de aceptar el destino como argumento: pasado
 * directo a `onPress`, un parámetro se comería el evento del toque y acabaría
 * intentando navegar a un `GestureResponderEvent`.
 */
export function volverA(destino: string): () => void {
  return () => {
    if (router.canGoBack()) { router.back(); return }
    router.replace(destino as never)
  }
}

export function volverAEntrena(): void {
  /* Sin argumentos A PROPÓSITO: se pasa tal cual a `onPress`, que le enchufaría
     el evento del toque como primer parámetro. Un destino configurable aquí
     acabaría siendo un `GestureResponderEvent` convertido en ruta. */
  if (router.canGoBack()) { router.back(); return }
  router.replace(ELECCION_ENTRENA as never)
}

/**
 * El menú es el mismo en gimnasio y en casa; lo único que cambia es a dónde
 * vuelve «Hoy». Sin esto, quien entrena en casa y toca Progreso y luego Hoy
 * acaba en la portada de gimnasio sin haber pedido cambiar de sitio.
 */
export type LugarEntreno = 'gym' | 'home' | 'outdoor'

const RUTA_DEL_LUGAR: Record<LugarEntreno, string> = {
  gym: '/workout/gym',
  home: '/workout/casa',
  // Exterior dejó de ser una portada de Entrena: ahora es su propio módulo,
  // con cuatro deportes y su propia navegación.
  outdoor: '/aire-libre',
}

export type DestinoDeSeccion = { id: Destino; label: string; icono: keyof typeof Ionicons.glyphMap; ruta: string }

/**
 * Los cuatro sitios de la sección, en un solo lugar.
 *
 * Se exporta porque ahora los pinta también `BarraDeSeccion`, la píldora de
 * abajo. Tenerlos escritos dos veces era garantizar que un día el riel y la
 * barra llevaran a sitios distintos.
 */
export const destinosDeSeccion = (modo: LugarEntreno): DestinoDeSeccion[] => DESTINOS(modo)

const DESTINOS = (modo: LugarEntreno): DestinoDeSeccion[] => [
  { id: 'hoy',      label: 'Hoy',      icono: 'today-outline',    ruta: RUTA_DEL_LUGAR[modo] },
  // Descubre sustituye a Biblioteca en el menú y la contiene: el camino corto
  // es que te monten la sesión, no recorrer 206 fichas. Los 206 siguen a un
  // toque desde dentro, pero dejan de ser lo primero que se ofrece.
  /* Descubre entra con el lugar puesto: sin él, desde el gimnasio se podía
     elegir «en casa» y montar una sesión que no es de esta página. */
  { id: 'descubre', label: 'Descubre', icono: 'compass-outline',  ruta: `/workout/descubre?mode=${modo}` },
  { id: 'progreso', label: 'Progreso', icono: 'trending-up',      ruta: '/workout/stats' },
  { id: 'records',  label: 'Récords',  icono: 'trophy-outline',   ruta: '/workout/records' },
]

export function MenuSeccion({ activo, modo = 'gym' }: { activo: Destino; modo?: LugarEntreno }) {
  const destinos = DESTINOS(modo)
  const ir = (d: { id: Destino; ruta: string }) => {
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
      {destinos.map(d => {
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

/**
 * LA CABECERA DE UNA PORTADA DE LUGAR
 * ───────────────────────────────────
 * La comparten Gimnasio, En casa y Running. Vivía dentro de la portada de
 * fuerza, y mientras solo hubiera una daba igual; con tres, tenerla escrita
 * tres veces garantiza que dos se queden atrás. Ya pasó con la flecha de
 * volver: la portada dejó de ser raíz de pestaña y se quedó sin salida.
 *
 * El saludo por hora se calcula AQUÍ y no lo pasa cada pantalla: tres copias de
 * la misma cadena de ternarios es donde acaban apareciendo tres franjas
 * horarias distintas.
 */
export function CabeceraPortada({ titulo, historialHref }: {
  titulo: string
  /** A dónde va el reloj. Cada lugar filtra su propio historial. */
  historialHref: string
}) {
  const hora = new Date().getHours()
  const saludo = hora < 6 ? 'De madrugada' : hora < 13 ? 'Buenos días' : hora < 21 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <View style={cp.wrap}>
      {/* Estas portadas se abren desde la elección de Entrena, no son raíz de
          pestaña: sin barra abajo y sin flecha arriba se quedan sin salida. */}
      <TouchableOpacity
        style={cp.atras}
        onPress={volverAEntrena}
        activeOpacity={0.7}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Volver a Entrena"
      >
        <Ionicons name="chevron-back" size={24} color={Colors.neon.w2} />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text style={cp.saludo}>{saludo.toUpperCase()}</Text>
        <Text style={cp.titulo}>{titulo}</Text>
      </View>

      <TouchableOpacity
        style={cp.historial}
        onPress={() => router.push(historialHref as never)}
        activeOpacity={0.8}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Ver el historial de entrenamientos"
      >
        <Ionicons name="time-outline" size={19} color={Colors.neon.w2} />
      </TouchableOpacity>
    </View>
  )
}

const cp = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing[4], paddingTop: Spacing[2], paddingBottom: Spacing[1],
  },
  /* Alineada con el saludo, no con el título: pegada al título queda a la
     altura de la equis y parece caída. */
  atras: { marginLeft: -6, marginRight: 2, paddingTop: 1 },
  saludo: { fontSize: 10, fontWeight: '800', color: Colors.neon.red, letterSpacing: 2 },
  titulo: { fontSize: 30, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.8, marginTop: 2 },
  historial: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.pane,
    borderWidth: 1, borderColor: Colors.neon.edge,
    /* ZENA y el icono de racha flotan sobre esta esquina desde `_layout.tsx`.
       Sin apartarse, este botón se ve pero no se puede tocar. */
    marginRight: BotonIA.reservaConRacha,
  },
})

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
  chipOn: { borderColor: 'rgba(255,92,0,0.45)', backgroundColor: Colors.neon.redDim },
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
