/**
 * LOS MENÚS DE SECCIÓN
 * ════════════════════
 * Qué enseña la barra flotante cuando se toca el galón, en cada pantalla.
 *
 * Un menú por DESTINO, no uno por pantalla: las seis pantallas de Entrena
 * comparten los mismos cuatro sitios, y lo único que cambia entre ellas es
 * cuál queda marcado. Lo mismo en los otros tres. Un menú por pantalla sería
 * un árbol de submenús que esta app no tiene.
 *
 * ── La regla de los cuatro ──────────────────────────────────────────────────
 * Cuatro entradas como máximo. Con cinco el carril se desliza y se pierde el
 * «lo veo todo de un vistazo», que era la razón de bajar el menú a la barra.
 * Tres es una respuesta válida; cinco no.
 *
 * ── La portada del destino no lleva menú ────────────────────────────────────
 * `(tabs)/workout`, `(tabs)/salud` y `(tabs)/social` son raíz de pestaña y sus
 * secciones ya están en tarjetas en pantalla: repetirlas en la barra sería
 * decir dos veces lo mismo. `(tabs)/nutrition` es la excepción y sí entra en
 * el menú como «Hoy», porque no es un selector sino el diario al que se vuelve
 * desde Recetas y desde Compras.
 */

import { Ionicons } from '@expo/vector-icons'
import type { User } from '@/store/authStore'
import { tieneCiclo } from '@/features/salud/acceso'
import { destinosDeSeccion, type LugarEntreno } from '@/components/workout/MenuSeccion'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export type EntradaDeMenu = {
  id: string
  label: string
  icono: IconName
  ruta: string
  /**
   * `tab` significa que el destino es raíz de pestaña y hay que NAVEGAR, no
   * reemplazar. Reemplazar una ruta del stack por una pestaña deja la pila en
   * un estado del que no se sale con el gesto de atrás.
   *
   * `accion` no es un sitio, es algo que se hace y de lo que se vuelve
   * —publicar—, así que se APILA y nunca queda marcada: marcar «estás en
   * publicar» sería mentir sobre dónde estás.
   */
  tipo?: 'tab' | 'accion'
  /**
   * Qué contador lleva encima, si lleva alguno.
   *
   * Es un NOMBRE y no el número: este fichero es una tabla de constantes y no
   * puede suscribirse a nada. Quien lo dibuja mira el store y traduce. Así el
   * contador de la barra y el de la cabecera del Muro salen del mismo sitio y
   * no pueden decir cosas distintas.
   */
  contador?: 'avisos' | 'mensajes'
}

/** Cuál de los cuatro destinos de la app queda marcado mientras estás aquí. */
export type DestinoApp = 'nutricion' | 'entrena' | 'salud' | 'social'

type Contexto = { user: User | null | undefined; lugar: LugarEntreno }

/* ── Nutrición ───────────────────────────────────────────────────────────────
   Cinco, y tres de ellas son la CONSOLA DE CAPTURA.

   Buscar, Lista y Scanner no son pantallas: son tres de los cuatro métodos de
   `FoodConsole`, que hasta ahora vivían en un riel dentro de la propia consola.
   Bajarlos aquí es lo que se pidió — sacar los menús de arriba de las páginas y
   ponerlos en la barra— y no duplica nada: el parámetro `captura` abre la
   consola ya puesta en ese método. Las mismas pantallas y las mismas
   funciones, alcanzables desde el pulgar.

   «Lista» es donde se van acumulando las comidas antes de confirmarlas; es el
   método `lista` de la consola, con su mismo nombre.

   Scanner abre el panel que ya trae las dos vías: código de barras y foto del
   plato.

   `book-outline` y no `restaurant-outline` para Recetas: el del restaurante es
   el icono de la pestaña Nutrición, y reusarlo para una sección de dentro es
   decir dos cosas con el mismo dibujo. */
const NUTRICION: EntradaDeMenu[] = [
  { id: 'buscar',  label: 'Buscar',  icono: 'search-outline',       ruta: '/(tabs)/nutrition?captura=buscar',   tipo: 'tab' },
  { id: 'recetas', label: 'Recetas', icono: 'book-outline',         ruta: '/recipes' },
  { id: 'lista',   label: 'Lista',   icono: 'layers-outline',       ruta: '/(tabs)/nutrition?captura=lista',    tipo: 'tab' },
  { id: 'scanner', label: 'Scanner', icono: 'scan-outline',         ruta: '/(tabs)/nutrition?captura=escanear', tipo: 'tab' },
  { id: 'compras', label: 'Compras', icono: 'cart-outline',         ruta: '/grocery' },
]

/* ── Salud ───────────────────────────────────────────────────────────────────
   Son exactamente las cuatro puertas de la portada de Salud, con sus mismos
   iconos: la sección ya tenía su índice escrito, solo le faltaba estar abajo
   y poder abrirse desde dentro.

   Ciclo se filtra con la misma llave que la portada. Sin acceso el menú son
   tres, y tres está bien. */
const SALUD = (user: User | null | undefined): EntradaDeMenu[] => [
  { id: 'hoy',     label: 'Hoy',     icono: 'sunny-outline',           ruta: '/salud/recuperacion' },
  { id: 'habitos', label: 'Hábitos', icono: 'checkmark-done-outline',  ruta: '/salud/habitos' },
  ...(tieneCiclo(user)
    ? [{ id: 'ciclo', label: 'Ciclo', icono: 'contrast-outline' as IconName, ruta: '/salud/ciclo' }]
    : []),
  { id: 'cuerpo',  label: 'Cuerpo',  icono: 'body-outline',            ruta: '/salud/cuerpo' },
]

/* ── Social ──────────────────────────────────────────────────────────────────
   Aquí la barra tapa un agujero real: las subpantallas NO se enlazan entre sí.
   Desde Buscar no había forma de llegar a Mensajes sin volver al Muro.

   Y aquí el menú empieza en el Muro, no un nivel más abajo: Social no tiene
   portada con tarjetas que enseñen sus secciones —tiene un muro—, así que sin
   el galón desde el primer momento sus cuatro sitios seguirían sin verse.

   «Publicar» no es un sitio: es lo que se viene a hacer. Va en el menú porque
   es la acción principal de la sección, pero nunca queda marcada.

   «Perfil» aquí es el perfil público —el que ve la gente—, no la cuenta: esa
   salió de la barra al botón de la esquina.

   Avisos se quedó fuera y sigue en la cabecera del Muro, con su contador: es
   lo único que quedó arriba cuando los otros tres bajaron. */
const SOCIAL: EntradaDeMenu[] = [
  { id: 'mensajes', label: 'Mensajes', icono: 'chatbubble-outline', ruta: '/social/messages', contador: 'mensajes' },
  { id: 'buscar',   label: 'Buscar',   icono: 'search-outline',     ruta: '/social/search' },
  { id: 'publicar', label: 'Publicar', icono: 'add-circle-outline', ruta: '/social/compose', tipo: 'accion' },
  { id: 'perfil',   label: 'Perfil',   icono: 'person-outline',     ruta: '/social/me' },
]

/* ── Entrena ─────────────────────────────────────────────────────────────────
   Este no se escribe aquí: sale de `MenuSeccion`, que es quien lo pinta desde
   antes y quien sabe a dónde va «Hoy» según el lugar. Tenerlo escrito dos
   veces era garantizar que un día el riel y la barra llevaran a sitios
   distintos. */
const ENTRENA = ({ lugar }: Contexto): EntradaDeMenu[] =>
  destinosDeSeccion(lugar).map(d => ({
    id: d.id,
    label: d.label,
    icono: d.icono as IconName,
    ruta: d.ruta,
  }))

/**
 * Dónde queda marcada cada entrada.
 *
 * La clave es `useSegments().join('/')`. Solo hace falta apuntar las pantallas
 * que SON una entrada del menú; el resto salen igual —con el galón y todo—,
 * simplemente sin nada marcado.
 */
const MARCADAS: Record<string, { activo: string; lugar?: LugarEntreno }> = {
  /* La portada de Nutrición no marca nada: desde ella se abre cualquiera de
     los tres métodos de captura, y ninguno «es» la portada. */
  '(tabs)/nutrition':   { activo: '' },
  'recipes':            { activo: 'recetas' },
  'grocery':            { activo: 'compras' },

  'workout/gym':        { activo: 'hoy', lugar: 'gym' },
  'workout/casa':       { activo: 'hoy', lugar: 'home' },
  'workout/running':    { activo: 'hoy', lugar: 'outdoor' },
  'workout/descubre':   { activo: 'descubre' },
  'workout/stats':      { activo: 'progreso' },
  'workout/records':    { activo: 'records' },

  'salud/recuperacion': { activo: 'hoy' },
  'salud/habitos':      { activo: 'habitos' },
  'salud/cuerpo':       { activo: 'cuerpo' },

  'social/search':      { activo: 'buscar' },
  'social/messages':    { activo: 'mensajes' },
  'social/me':          { activo: 'perfil' },
}

/**
 * Pantallas de tarea, donde la barra NO sale.
 *
 * Son las que piden atención entera y de las que se sale terminando o
 * cancelando: una sesión en marcha, escribir una publicación, una historia a
 * pantalla completa, una conversación. Meterles una barra de navegación es
 * invitar a irse a la mitad.
 */
const SIN_BARRA = new Set([
  '(tabs)/chat',
  'salud/sesion',
  'salud/habito',
  'workout/active',
  'workout/session/[id]',
  'workout/exercise/hacer',
  'recipe/cook',
  'social/compose',
  'social/story',
  'social/chat/[id]',
])

/**
 * Las portadas que son raíz de pestaña y AUN ASÍ llevan galón.
 *
 * Nutrición y Social no tienen tarjetas que enseñen sus secciones —una es un
 * diario y la otra un muro—, así que su menú tiene que estar desde el primer
 * momento. Entrena y Salud sí las tienen, y ahí el galón sobraría.
 *
 * La marca importa además por otra razón: en estas dos el galón lo pinta la
 * barra de pestañas, no la flotante, o saldrían las dos píldoras a la vez.
 */
const PORTADAS_CON_GALON = new Set(['(tabs)/nutrition', '(tabs)/social'])

/**
 * A qué destino pertenece una ruta. Por prefijo, no por lista.
 *
 * Lo primero es quitar el grupo `(tabs)/`: las rutas de pestaña llegan como
 * `(tabs)/social`, no como `social`, y compararlas con `startsWith('social')`
 * daba SIEMPRE falso. Por eso el galón desapareció del Muro nada más entrar en
 * Social — el único destino cuyo menú empieza en su propia portada.
 */
function destinoDe(ruta: string): DestinoApp | null {
  const r = ruta.startsWith('(tabs)/') ? ruta.slice('(tabs)/'.length) : ruta

  if (r === 'nutrition' || r === 'recipes' || r === 'meal-planner'
      || r === 'grocery' || r.startsWith('recipe/')) return 'nutricion'
  if (r.startsWith('workout')) return 'entrena'
  if (r.startsWith('salud'))   return 'salud'
  if (r.startsWith('social'))  return 'social'
  return null
}

export type Sitio = {
  destino: DestinoApp
  menu: 'nutricion' | 'salud' | 'social' | 'entrena'
  /** Qué entrada queda marcada. Vacío = ninguna, y es una respuesta válida. */
  activo: string
  lugar?: LugarEntreno
  /** El galón lo pinta la barra de pestañas y no la flotante. */
  enPestana?: true
}

/**
 * Qué barra toca en esta ruta, si toca alguna.
 *
 * Antes esto era una lista de dieciséis rutas exactas, y por eso la barra
 * DESAPARECÍA en todo lo demás —la biblioteca, el historial, las siete
 * pantallas del ciclo, un post— aunque siguieras dentro del mismo destino.
 * Ahora se resuelve por prefijo: dentro de un destino la barra está siempre,
 * salvo en las pantallas de tarea.
 */
/**
 * Módulos que traen su PROPIA barra abajo.
 *
 * El ciclo menstrual tiene cinco pestañas suyas —Inicio, Calendario, Ajustes,
 * Estadísticas y Comunidad— que sustituyen a las de la app mientras dura la
 * sección. Si la flotante siguiera saliendo habría DOS barras apiladas: 130 px
 * de cromo, la de abajo medio tapada, y en iOS eso se lee como un error de
 * montaje, no como una función.
 *
 * Va por prefijo y no como entrada exacta en `SIN_BARRA` porque el ciclo son
 * ocho rutas y subiendo: con coincidencia exacta, la novena nacería con las
 * dos barras y nadie se acordaría de por qué.
 */
const CON_BARRA_PROPIA = ['salud/ciclo']

export function sitioDe(ruta: string): Sitio | null {
  if (SIN_BARRA.has(ruta)) return null
  if (CON_BARRA_PROPIA.some(p => ruta === p || ruta.startsWith(`${p}/`))) return null

  /* Las otras dos portadas de pestaña se quedan con su barra de siempre: sus
     tarjetas ya hacen de menú. */
  if (ruta === '(tabs)/workout' || ruta === '(tabs)/salud') return null

  const destino = destinoDe(ruta)
  if (!destino) return null

  const marca = MARCADAS[ruta]
  return {
    destino,
    menu: destino,
    activo: marca?.activo ?? '',
    lugar: marca?.lugar,
    enPestana: PORTADAS_CON_GALON.has(ruta) ? true : undefined,
  }
}

/** Las entradas del menú que toca aquí, ya filtradas. */
export function entradasDeMenu(
  menu: 'nutricion' | 'salud' | 'social' | 'entrena',
  ctx: Contexto,
): EntradaDeMenu[] {
  if (menu === 'nutricion') return NUTRICION
  if (menu === 'salud')     return SALUD(ctx.user)
  if (menu === 'social')    return SOCIAL
  return ENTRENA(ctx)
}
