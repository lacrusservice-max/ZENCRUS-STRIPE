/**
 * LA FAMILIA DEL TOKEN DE REFRESCO, CON VENTANA DE GRACIA
 * ──────────────────────────────────────────────────────
 * El token de refresco es rotativo y de un solo uso: cada refresco genera una
 * familia nueva y la anterior deja de valer. Eso está bien y es lo que detecta
 * un robo — si alguien usa un token ya gastado, es que hay dos copias.
 *
 * ── El problema: una carrera legítima parece un robo ────────────────────────
 * Sin ninguna tolerancia, DOS PETICIONES DEL MISMO MÓVIL a la vez rompen la
 * sesión. Pasa más de lo que parece: al arrancar la app se piden varias cosas
 * en paralelo y todas caducan a la vez; se recarga la app con una petición en
 * vuelo; se abre en dos sitios. La primera rota la familia, la segunda llega
 * con la vieja, el servidor la toma por robada y anula TODO. El usuario acaba
 * en la pantalla de entrar sin haber hecho nada mal.
 *
 * Costó una sesión entera de verificación descubrirlo: cada vez que se recargaba
 * la app para mirar una pantalla, había que volver a escribir la contraseña.
 *
 * ── La solución: treinta segundos de gracia ─────────────────────────────────
 * Se recuerda la familia ANTERIOR y cuándo se rotó. Si llega un token de esa
 * familia dentro de la ventana, no es un robo: es la carrera. Se le contesta
 * con un token de la familia ACTUAL —sin rotar otra vez— y los dos clientes
 * acaban con el mismo token bueno. Fuera de la ventana, sigue siendo robo y se
 * anula la familia entera, como antes.
 *
 * Es el remedio que recomienda la guía de buenas prácticas de OAuth 2.0 para
 * exactamente este caso.
 *
 * ── Lo que se cede, dicho claro ─────────────────────────────────────────────
 * Durante esos treinta segundos, quien tuviera el token ANTERIOR robado podría
 * cambiarlo por uno válido. Es el precio, y por eso la ventana es corta: lo
 * contrario —cero tolerancia— no protegía de verdad y sí echaba a gente que no
 * había hecho nada. Una defensa que se dispara sola contra el dueño acaba
 * apagada, y entonces no defiende nada.
 *
 * ── Sin migración ───────────────────────────────────────────────────────────
 * Los tres datos van empaquetados en la MISMA columna de texto que ya existe,
 * separados por `|`, que no aparece en un uuid. Comprobado que caben. Añadir
 * columnas obligaba a pasar por el editor SQL del panel, y esto no lo merece.
 */

/** Cuánto se tolera una familia recién rotada. */
export const VENTANA_GRACIA_MS = 30_000

export interface Familia {
  /** La que vale ahora. */
  actual: string
  /** La inmediatamente anterior, si la rotación es reciente. */
  anterior: string | null
  /** Cuándo se rotó, en milisegundos. */
  rotadoEn: number
}

/**
 * Lee el valor guardado.
 *
 * Acepta un uuid suelto además del formato empaquetado: es lo que hay en las
 * filas de antes de esto y lo que escribe el inicio de sesión, que no tiene
 * ninguna familia anterior que recordar. Así no hace falta migrar nada ni
 * tocar el registro.
 */
export function desempaquetar(guardado: string | null | undefined): Familia | null {
  if (!guardado) return null
  const partes = guardado.split('|')
  if (partes.length === 1) return { actual: partes[0], anterior: null, rotadoEn: 0 }
  const rotadoEn = Number(partes[2])
  return {
    actual: partes[0],
    anterior: partes[1] || null,
    rotadoEn: Number.isFinite(rotadoEn) ? rotadoEn : 0,
  }
}

/** Escribe el valor para guardar tras una rotación. */
export function empaquetar(actual: string, anterior: string | null, ahora = Date.now()): string {
  return anterior ? `${actual}|${anterior}|${ahora}` : actual
}

/**
 * ¿Qué hacer con la familia que llega?
 *
 * Devolver una decisión en vez de resolverlo aquí deja el controlador legible
 * y, sobre todo, deja esta regla —que es la delicada— probable por sí sola.
 */
export type Decision =
  /** Es la de ahora: se rota como siempre. */
  | { tipo: 'rotar' }
  /** Es la anterior y hace nada que rotó: la carrera. Se da la actual sin rotar. */
  | { tipo: 'gracia'; familiaActual: string }
  /** Ni una ni otra: token gastado o robado. Se anula la familia entera. */
  | { tipo: 'robo' }

export function decidir(
  guardado: string | null | undefined,
  familiaQueLlega: string,
  ahora = Date.now(),
): Decision {
  const f = desempaquetar(guardado)
  if (!f) return { tipo: 'robo' }
  if (f.actual === familiaQueLlega) return { tipo: 'rotar' }
  if (
    f.anterior
    && f.anterior === familiaQueLlega
    && ahora - f.rotadoEn <= VENTANA_GRACIA_MS
  ) {
    return { tipo: 'gracia', familiaActual: f.actual }
  }
  return { tipo: 'robo' }
}
