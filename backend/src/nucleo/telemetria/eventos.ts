/* ─────────────────────────────────────────────────────────────────────────
 * ARCHIVO GENERADO — NO LO EDITES AQUÍ
 *
 * La fuente es  nucleo/telemetria/eventos.ts
 * Para cambiarlo: edita ahí y corre  npm run nucleo
 *
 * Existe copiado porque la app y el servidor los compilan cadenas distintas
 * que no pueden leer una carpeta común. El motivo largo está en
 * scripts/nucleo.mjs.
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * TELEMETRÍA · QUÉ ES UN EVENTO Y QUÉ NO PUEDE LLEVAR DENTRO
 * ═══════════════════════════════════════════════════════════════════════════
 * El objetivo es saber qué añadir, qué quitar, qué mejorar y qué personalizar,
 * y para eso hace falta la FORMA de la interacción —qué se abre, qué se usa,
 * dónde se abandona, cuánto se tarda—, no lo que se escribió dentro.
 *
 * ── Por qué esto no es un detalle de privacidad, sino el diseño ────────────
 * El módulo de ciclo está construido entero sobre que aquí no se captura
 * nada: modo discreto encendido de fábrica, la función es invisible en vez de
 * bloqueada, la API responde 404 y nunca 403 para no confirmar que existe. Y
 * lo que se selecciona ahí dentro —niveles de sangrado, síntomas, ánimo— es
 * dato de salud reproductiva.
 *
 * Un sistema de eventos hecho a la ligera destruye todo eso en una línea: basta
 * con que alguien mande `props: {...valor}` «para depurar» y el nivel de
 * sangrado de una persona acaba en una tabla con su `user_id` al lado.
 *
 * Por eso la garantía NO es una norma de estilo ni un comentario pidiendo
 * cuidado: es una FUNCIÓN por la que pasa todo evento antes de encolarse, y
 * en las secciones sensibles solo sobreviven las claves de una lista blanca.
 * Lo que no está en la lista no se recorta: se tira. Una lista negra habría
 * que ampliarla cada vez que alguien inventa un campo nuevo, y el fallo sería
 * silencioso.
 */

/** Las secciones de la app, que son también el primer eje de análisis. */
export type Seccion =
  | 'salud' | 'entrena' | 'nutricion' | 'social' | 'aire_libre'
  | 'perfil' | 'zena' | 'acceso' | 'inicio' | 'otra'

/**
 * Secciones cuyo contenido no puede salir del teléfono.
 *
 * `salud` está aquí porque su contenido es dato de categoría especial. Si
 * mañana otra sección guarda algo comparable, se añade aquí y queda protegida
 * sin tocar nada más.
 */
export const SECCIONES_SENSIBLES: readonly Seccion[] = ['salud']

/**
 * Lo único que puede viajar desde una sección sensible.
 *
 * Fíjate en lo que NO está: ni `valor`, ni `nivel`, ni `sintoma`, ni `zona`,
 * ni `nota`, ni `fecha` del registro. Con `tracker: 'dolor'` se sabe que el
 * control de dolor se usa mucho —que es lo que decide si se mejora o se
 * quita—; con el nivel se sabría cuánto le duele, que no es asunto nuestro.
 */
export const CLAVES_PERMITIDAS_SENSIBLES: readonly string[] = [
  'tracker',        // QUÉ control se usó, nunca qué se marcó en él
  'paso',           // en qué paso de un flujo por pasos estaba
  'total_pasos',
  'resultado',      // 'completado' | 'abandonado' | 'error'
  'origen',         // desde dónde se llegó
  'modo',           // el modo de vida elegido: cambia qué pantallas se ven
  'ms',             // cuánto duró
  'n',              // cuántos elementos había en pantalla, no cuáles
]

export type ValorProp = string | number | boolean | null

export interface Evento {
  nombre: string
  seccion: Seccion
  pantalla?: string
  control?: string
  props: Record<string, ValorProp>
  /**
   * Cuándo pasó, en el reloj del teléfono.
   *
   * Va aparte de cuándo llegó al servidor, y no es purismo: los eventos se
   * encolan sin red y se envían al reconectar. Con una sola fecha, todo lo
   * que pasó en el metro aparecería ocurriendo a la vez al salir, y cualquier
   * embudo o medición de duración saldría mal.
   */
  ocurrioEn: string
  sesionId: string
}

/** Un valor que se puede guardar sin arrastrar contenido detrás. */
function valorSeguro(v: unknown): v is ValorProp {
  if (v === null) return true
  const t = typeof v
  if (t === 'boolean' || t === 'number') return true
  /* Las cadenas se admiten cortas: las claves permitidas son etiquetas
     ('dolor', 'completado'), no texto libre. Un límite bajo hace que una nota
     escrita por alguien no quepa aunque se cuele por una clave permitida. */
  return t === 'string' && (v as string).length <= 40
}

/**
 * Deja el evento en condiciones de salir del teléfono.
 *
 * En una sección sensible sobreviven solo las claves de la lista blanca. En
 * el resto se admite cualquier clave, pero igualmente se descartan los
 * valores que no son primitivos cortos: un objeto entero metido en `props`
 * es la manera habitual de que se escape lo que no debía.
 */
export function sanear(evento: Evento): Evento {
  const sensible = SECCIONES_SENSIBLES.includes(evento.seccion)
  const props: Record<string, ValorProp> = {}

  for (const [clave, valor] of Object.entries(evento.props ?? {})) {
    if (sensible && !CLAVES_PERMITIDAS_SENSIBLES.includes(clave)) continue
    if (!valorSeguro(valor)) continue
    props[clave] = valor
  }

  /* La nota y la pantalla también pasan por el filtro: una ruta puede llevar
     parámetros, y en el ciclo esos parámetros son fechas de registro. */
  return {
    ...evento,
    pantalla: evento.pantalla ? rutaSinParametros(evento.pantalla) : undefined,
    props,
  }
}

/**
 * La ruta sin nada detrás de `?` y sin los segmentos que parecen datos.
 *
 * `/salud/ciclo/registrar?fecha=2026-08-26` dice qué día registró alguien su
 * periodo. La ruta sirve para saber qué pantalla se usa; el parámetro no
 * aporta nada a esa pregunta y sí cuenta algo de la persona.
 */
export function rutaSinParametros(ruta: string): string {
  const sinQuery = ruta.split('?')[0]
  return sinQuery
    .split('/')
    .map(seg => (/^\d{4}-\d{2}-\d{2}$/.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) ? ':id' : seg))
    .join('/')
}

/**
 * De qué sección es una ruta.
 *
 * El orden importa: `/salud/...` se comprueba antes que nada para que ninguna
 * ruta de salud caiga por error en otra sección y se le aplique el filtro
 * flojo.
 *
 * ── Lo desconocido va a 'otra', no a una sección de verdad ─────────────────
 * Antes el caso por defecto era 'perfil', y en los primeros datos reales se
 * vio el fallo enseguida: la pantalla de Inicio —la ruta `/`— caía ahí y
 * mezclaba el tráfico de la portada con el del perfil, sin forma de
 * separarlos después. Una sección real como cajón de sastre corrompe
 * justamente el eje por el que más se va a agrupar.
 */
export function seccionDeRuta(ruta: string): Seccion {
  const r = ruta.toLowerCase()
  if (r.startsWith('/salud')) return 'salud'
  if (r.startsWith('/workout') || r.includes('/entrena')) return 'entrena'
  if (r.includes('/nutrition') || r.includes('/nutricion') || r.startsWith('/recipe')) return 'nutricion'
  if (r.startsWith('/social')) return 'social'
  if (r.startsWith('/aire-libre')) return 'aire_libre'
  if (r.includes('/chat') || r.includes('/zena')) return 'zena'
  if (r.includes('(auth)') || r.includes('(onboarding)') || r.startsWith('/login') || r.startsWith('/register')) return 'acceso'
  if (r.includes('/profile') || r.includes('/perfil')) return 'perfil'
  /* La portada. Va después de todo lo demás porque `/` es prefijo de todo. */
  if (r === '/' || r === '' || r.endsWith('(tabs)') || r.endsWith('(tabs)/index')) return 'inicio'
  return 'otra'
}
