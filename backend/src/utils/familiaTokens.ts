/**
 * UNA SESIÓN POR DISPOSITIVO
 * ──────────────────────────
 * Quién tiene abierta la sesión, en qué aparato, y con qué token de refresco.
 *
 * ── El problema que resuelve ────────────────────────────────────────────────
 * Había UNA familia de tokens por usuario. Como el token de refresco es
 * rotativo y de un solo uso, eso significaba que el móvil y el simulador —o el
 * móvil y la tableta, o el trabajo y la casa— no podían estar dentro a la vez:
 * en cuanto uno renovaba, el otro se quedaba con un token que ya no valía y
 * acababa en la pantalla de entrar. Se veía clavado en el registro:
 *
 *     19:38:38  login desde el iPhone      → 200
 *     19:39:04  refresco desde el Mac      → 401
 *
 * No era un fallo de nadie: era el modelo. Un usuario, una sesión.
 *
 * ── Cómo se arregla ─────────────────────────────────────────────────────────
 * Cada aparato tiene su propia familia, con su propia rotación y su propia
 * ventana de gracia. Renovar en el móvil no toca la del Mac. Cerrar sesión en
 * uno no cierra el otro. Y si de verdad roban un token, se cierra SOLO el
 * aparato afectado, que además es lo correcto: echar a alguien de todos sus
 * dispositivos porque uno se comprometió es un castigo desproporcionado y hace
 * que la gente desactive lo que la protege.
 *
 * ── Sin migración ───────────────────────────────────────────────────────────
 * Todo va en la MISMA columna de texto que ya existía, ahora como JSON.
 * Comprobado que aguanta cinco dispositivos con holgura. Añadir columnas
 * obligaba a pasar por el editor SQL del panel, y esto no lo merece.
 *
 * ── Y lo viejo sigue entrando ───────────────────────────────────────────────
 * Las filas de antes guardan un uuid suelto o el formato `actual|anterior|ts`.
 * Los dos se leen como «un solo dispositivo, sin nombre», así que nadie se cae
 * al desplegar: su sesión sigue valiendo hasta que renueve, y al renovar pasa
 * al formato nuevo sola.
 */

/** Cuánto se tolera una familia recién rotada, para las carreras. */
export const VENTANA_GRACIA_MS = 30_000

/**
 * Cuántos aparatos se recuerdan a la vez.
 *
 * Cinco cubre de sobra a una persona real —móvil, tableta, un simulador y
 * alguna reinstalación— y pone un techo a lo que puede crecer la columna. Al
 * pasarse, se olvida el que lleve más tiempo sin renovar: es el que más
 * probablemente ya no existe.
 */
export const MAX_DISPOSITIVOS = 5

export interface Sesion {
  /** La familia que vale ahora en ese aparato. */
  actual: string
  /** La inmediatamente anterior, para la ventana de gracia. */
  anterior: string | null
  /** Cuándo se rotó, en milisegundos. */
  rotadoEn: number
}

/** Todas las sesiones abiertas del usuario, por aparato. */
export type Registro = Record<string, Sesion>

/** El nombre que se le da a una sesión que viene del formato viejo. */
export const APARATO_HEREDADO = 'heredado'

// ── Leer y escribir ──────────────────────────────────────────────────────────

/**
 * Lee lo guardado, venga en el formato que venga.
 *
 * Tres formatos conviven a propósito: el JSON nuevo, el `a|b|ts` de la ventana
 * de gracia y el uuid suelto de siempre. Los dos viejos se leen como un único
 * aparato para que ninguna sesión existente se caiga con el despliegue.
 */
export function leer(guardado: string | null | undefined): Registro {
  if (!guardado) return {}

  if (guardado.startsWith('{')) {
    try {
      const crudo = JSON.parse(guardado) as Record<string, { a: string; p: string | null; t: number }>
      const out: Registro = {}
      for (const [aparato, v] of Object.entries(crudo)) {
        if (v && typeof v.a === 'string') {
          out[aparato] = { actual: v.a, anterior: v.p ?? null, rotadoEn: Number(v.t) || 0 }
        }
      }
      return out
    } catch {
      // Un JSON roto no puede cerrarle la sesión a nadie por su cuenta: se trata
      // como «no hay nada», y el refresco fallará con un 401 normal.
      return {}
    }
  }

  const partes = guardado.split('|')
  if (partes.length >= 3) {
    return { [APARATO_HEREDADO]: { actual: partes[0], anterior: partes[1] || null, rotadoEn: Number(partes[2]) || 0 } }
  }
  return { [APARATO_HEREDADO]: { actual: guardado, anterior: null, rotadoEn: 0 } }
}

/**
 * Escribe el registro, quedándose con los aparatos más recientes.
 *
 * Se ordena por la última rotación y se cortan los que sobran. Sin el tope, un
 * usuario que reinstale la app cada semana acabaría con una columna que crece
 * sin fin y sin que nadie lo note hasta que falle un `update`.
 */
export function escribir(reg: Registro): string {
  const orden = Object.entries(reg)
    .sort((a, b) => b[1].rotadoEn - a[1].rotadoEn)
    .slice(0, MAX_DISPOSITIVOS)

  return JSON.stringify(Object.fromEntries(
    orden.map(([k, v]) => [k, { a: v.actual, p: v.anterior, t: v.rotadoEn }]),
  ))
}

// ── Decidir qué hacer con un token que llega ─────────────────────────────────

export type Decision =
  /** Es la familia vigente de un aparato: se rota la de ESE aparato. */
  | { tipo: 'rotar'; aparato: string }
  /** Es la anterior de un aparato y acaba de rotar: la carrera. */
  | { tipo: 'gracia'; aparato: string; familiaActual: string }
  /**
   * Es la anterior de un aparato pero fuera de la ventana: hay dos copias del
   * token. Se cierra ESE aparato y solo ese.
   */
  | { tipo: 'reutilizado'; aparato: string }
  /**
   * No es de ningún aparato conocido. Se rechaza y NO se toca nada.
   *
   * Un token viejo —de una instalación anterior, de una petición que se quedó
   * en vuelo antes de un login, de un aparato que ya se olvidó— no prueba nada.
   * Echar al dueño por él fue el fallo que costó una tarde entera.
   */
  | { tipo: 'desconocido' }

export function decidir(
  guardado: string | null | undefined,
  familiaQueLlega: string,
  ahora = Date.now(),
): Decision {
  const reg = leer(guardado)

  for (const [aparato, s] of Object.entries(reg)) {
    if (s.actual === familiaQueLlega) return { tipo: 'rotar', aparato }
  }
  for (const [aparato, s] of Object.entries(reg)) {
    if (s.anterior && s.anterior === familiaQueLlega) {
      return ahora - s.rotadoEn <= VENTANA_GRACIA_MS
        ? { tipo: 'gracia', aparato, familiaActual: s.actual }
        : { tipo: 'reutilizado', aparato }
    }
  }
  return { tipo: 'desconocido' }
}

// ── Operaciones ──────────────────────────────────────────────────────────────

/** Abre o reemplaza la sesión de un aparato. El resto no se toca. */
export function abrir(
  guardado: string | null | undefined,
  aparato: string,
  familia: string,
  ahora = Date.now(),
): string {
  const reg = leer(guardado)
  reg[aparato] = { actual: familia, anterior: null, rotadoEn: ahora }
  return escribir(reg)
}

/** Rota la familia de un aparato, recordando la anterior para la gracia. */
export function rotar(
  guardado: string | null | undefined,
  aparato: string,
  nueva: string,
  ahora = Date.now(),
): string {
  const reg = leer(guardado)
  const antes = reg[aparato]
  reg[aparato] = { actual: nueva, anterior: antes?.actual ?? null, rotadoEn: ahora }
  return escribir(reg)
}

/** Cierra la sesión de UN aparato y deja las demás abiertas. */
export function cerrar(guardado: string | null | undefined, aparato: string): string | null {
  const reg = leer(guardado)
  delete reg[aparato]
  return Object.keys(reg).length === 0 ? null : escribir(reg)
}

/** Cierra TODAS: es lo que pide «cerrar sesión en todos los dispositivos». */
export const cerrarTodas = (): string | null => null

/**
 * El nombre de un aparato, a partir de lo que manda el cliente.
 *
 * Se acota y se limpia porque acaba dentro de un JSON en una columna: sin
 * acotarlo, un cliente podría llenar la columna con un solo nombre enorme.
 */
export function nombreDeAparato(bruto: unknown): string {
  const s = typeof bruto === 'string' ? bruto.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) : ''
  return s || APARATO_HEREDADO
}
