/**
 * EL CÍRCULO FEMENINO
 * ═══════════════════════════════════════════════════════════════════════════
 * Un espacio dentro de Social al que solo entran mujeres. Lo que se publica
 * ahí no lo ve ningún perfil masculino: ni en el muro, ni siguiendo a la
 * autora, ni abriendo el enlace directo, ni en los comentarios.
 *
 * ── Por qué vive en el servidor y no en la app ─────────────────────────────
 * Porque un filtro en el móvil se salta con una petición hecha a mano, y lo que
 * hay al otro lado no es un ranking de pesos: es lo que una mujer escribe sobre
 * su cuerpo creyendo que ningún hombre lo va a leer. Si esa promesa se rompe
 * una vez, no se arregla con una actualización.
 *
 * ── Y por qué es UNA función y no siete comprobaciones ─────────────────────
 * Las publicaciones se pueden alcanzar por siete caminos: el muro, el muro de
 * seguidos, el enlace directo, los comentarios, los guardados, el «me gusta» y
 * el guardar. Con la comprobación copiada en cada uno, basta que alguien añada
 * el octavo —o que olvide uno— para abrir el espacio entero. Aquí hay una sola
 * puerta y todos los caminos pasan por ella.
 *
 * El agujero real que había: `scope=following` filtraba por AUTOR y no por
 * visibilidad, así que un hombre que siguiera a una mujer veía sus
 * publicaciones del círculo aunque el muro público las escondiera.
 *
 * ── Quién entra ────────────────────────────────────────────────────────────
 * `users.gender = 'female'`. Es un enum de tres valores —male, female, other—
 * y `other` NO entra: es una decisión consciente y no un descuido. La promesa
 * que se le hace a quien publica ahí es «esto lo leen mujeres», y ensancharla
 * en silencio sería cambiarle el trato sin avisarle. Si algún día se decide
 * incluir a más gente, se decide y se comunica; no se cuela por un `!==`.
 *
 * ── Cuando no se puede comprobar, NO se entra ──────────────────────────────
 * Si la consulta del perfil falla, la respuesta es «no». Un fallo de red no
 * puede convertirse en una puerta abierta.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'

/** El valor de `posts.visibility` que marca una publicación del círculo. */
export const VIS_FEMENINO = 'femenino'

/** Lo que ve todo el mundo. Nunca incluye el círculo. */
export const VIS_PUBLICO = 'public'

/**
 * ¿Esta cuenta pertenece al círculo?
 *
 * Va contra la base en cada petición y no contra el token: el sexo del perfil
 * se puede cambiar, y un token emitido antes del cambio seguiría diciendo lo
 * de antes durante días.
 */
export async function esDelCirculo(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('gender')
      .eq('id', userId)
      .single()

    if (error) throw error
    return data?.gender === 'female'
  } catch (err) {
    // Ante la duda, fuera. Ver el encabezado.
    logger.error('esDelCirculo error:', err)
    return false
  }
}

/**
 * ¿Puede esta persona ver esta publicación?
 *
 * Solo mira el círculo; el resto de reglas de visibilidad —cuentas privadas,
 * bloqueos— siguen donde estaban.
 */
export function puedeVer(
  post: { visibility?: string | null; user_id?: string } | null | undefined,
  delCirculo: boolean,
  userId?: string,
): boolean {
  if (!post) return false
  if (post.visibility !== VIS_FEMENINO) return true
  // La autora siempre ve lo suyo, aunque cambiara su perfil después.
  if (userId && post.user_id === userId) return true
  return delCirculo
}

/**
 * Deja fuera de una lista lo que no le toca ver.
 *
 * Filtrar DESPUÉS de consultar hace que una página de veinte pueda devolver
 * menos de veinte. Es el precio correcto: la alternativa —pedir más y recortar—
 * complica la paginación, y aquí lo que no se puede fallar es el filtro.
 */
export function soloVisibles<T extends { visibility?: string | null; user_id?: string }>(
  posts: T[],
  delCirculo: boolean,
  userId?: string,
): T[] {
  return posts.filter(p => puedeVer(p, delCirculo, userId))
}

/**
 * ¿Qué visibilidad le toca a una publicación nueva?
 *
 * Devuelve `null` cuando se pide el círculo sin pertenecer a él, y quien llama
 * DEBE rechazar la petición. Lo que no se puede hacer es caer a `public` en
 * silencio: alguien escribiría algo íntimo creyendo que va al círculo y
 * acabaría en el muro de todos. Fallar ruidosamente es lo seguro aquí.
 */
export function visibilidadParaNueva(
  pedida: unknown,
  delCirculo: boolean,
): string | null {
  if (pedida !== VIS_FEMENINO) return VIS_PUBLICO
  return delCirculo ? VIS_FEMENINO : null
}
