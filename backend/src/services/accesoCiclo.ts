/**
 * ¿EXISTE EL CICLO PARA ESTA CUENTA?
 * ═══════════════════════════════════════════════════════════════════════════
 * Una sola función, en el servidor, y el cliente solo lee el booleano que
 * salga de aquí. Antes la regla estaba escrita dos veces —una en
 * `cycle.routes.ts` y otra en `features/salud/acceso.ts`— con un comentario
 * pidiendo mantenerlas iguales a mano. Dos copias de una regla de permisos
 * acaban divergiendo, y cuando divergen la app enseña un módulo que la API
 * niega, o al revés.
 *
 * ── Por qué el género vuelve, y por qué NO manda ───────────────────────────
 * D-13 decía que la llave no debía derivarse de `gender`, y las tres razones
 * siguen siendo buenas: 'other' se quedaría fuera, hay mujeres que no lo
 * quieren, y el género se pide para el cálculo metabólico. La solución de
 * entonces fue una preferencia propia que se ofrecería en el registro.
 *
 * Esa pregunta nunca se llegó a construir. Resultado real, medido en la base:
 * `cycle_enabled` se lee en cuatro sitios y no se escribe en ninguno, así que
 * el «régimen definitivo» daba acceso a CERO cuentas. La única que lo tenía
 * era una de pruebas, por lista de correos, y encima registrada como
 * masculina. La primera mujer que se dio de alta no vio nada.
 *
 * Así que el género vuelve, pero solo como VALOR POR DEFECTO:
 *
 *   1. Excepciones por correo. Cuentas que lo ven pase lo que pase.
 *   2. Si hay fila de perfil, manda `cycle_enabled`. Esto es lo que hace la
 *      preferencia revocable: en cuanto ella decide, su decisión gana para
 *      siempre sobre cualquier valor derivado.
 *   3. Si NO hay fila —nunca se le preguntó—, se deriva: lo ven todas menos
 *      quien declaró género masculino. Eso cubre 'female' y 'other', que era
 *      la primera de las tres objeciones de D-13.
 *
 * La diferencia con lo que D-13 rechazaba es que el género no es el permiso:
 * es la semilla. El permiso sigue viviendo en `cycle_enabled` y sigue siendo
 * de ella.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'

/**
 * Cuentas con acceso pase lo que pase, independientemente de género y perfil.
 *
 * Es para poder revisar el módulo desde dentro sin falsear el género de una
 * cuenta. Mantenerla corta: cada correo de aquí es alguien viendo una función
 * que no le corresponde por la regla normal.
 */
const EXCEPCIONES = [
  'lacrusservice@gmail.com',
] as const

const normalizar = (c: string | undefined | null): string => (c ?? '').trim().toLowerCase()

export function esExcepcion(email: string | undefined | null): boolean {
  return (EXCEPCIONES as readonly string[]).includes(normalizar(email))
}

/**
 * La llave efectiva.
 *
 * Ante un fallo de lectura devuelve `false`. Abrir «por si acaso» expondría
 * el módulo entero por un error de red de la base, y este módulo es de los
 * que no se pueden dejar abiertos por defecto.
 */
export async function cicloActivo(
  userId: string,
  email: string | undefined | null,
): Promise<boolean> {
  if (esExcepcion(email)) return true

  const { data: perfil, error: errPerfil } = await supabase
    .from('health_profile')
    .select('cycle_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (errPerfil) {
    logger.error('cicloActivo · perfil:', errPerfil.message)
    return false
  }

  // Ya eligió alguna vez: su decisión manda sobre cualquier valor derivado.
  if (perfil) return perfil.cycle_enabled === true

  // Nunca se le preguntó. Se deriva del género declarado.
  const { data: usuario, error: errUsuario } = await supabase
    .from('users')
    .select('gender')
    .eq('id', userId)
    .maybeSingle()

  if (errUsuario) {
    logger.error('cicloActivo · usuario:', errUsuario.message)
    return false
  }

  /* Distinto de `=== 'female'` a propósito: 'other' entra, y una cuenta sin
     género declarado también. Es mejor ofrecerlo de más que dejar fuera a
     alguien que lo necesita — y quien no lo quiera puede apagarlo. */
  return normalizar(usuario?.gender) !== 'male'
}
