/**
 * ACCESO AL MÓDULO DE CICLO
 * ═════════════════════════════════════════════════════════════════════════
 * Una sola función decide si el ciclo menstrual existe para una cuenta. Todo
 * el módulo pregunta aquí y en ningún otro sitio: si mañana cambia la regla,
 * cambia en un archivo.
 *
 * ── «Existe», no «está permitido» ────────────────────────────────────────
 * Para una cuenta sin acceso, el ciclo NO es una función bloqueada: es una
 * función que no existe. No hay entrada, no hay ajuste, no hay mención, y la
 * ruta no se registra. La API responde 404 y nunca 403 — un 403 confirmaría
 * que el recurso está ahí.
 *
 * ── Por qué no basta con `gender === 'female'` ───────────────────────────
 * Tres razones concretas, documentadas en DECISIONES.md D-13:
 *
 *  1. El perfil admite 'male' | 'female' | 'other'. Filtrar por 'female'
 *     dejaría fuera a 'other', que puede necesitarlo.
 *  2. Hay mujeres que no lo quieren —menopausia, histerectomía, o
 *     simplemente no les interesa— e imponérselo es peor producto.
 *  3. El campo de género se pide en el onboarding **para el cálculo
 *     metabólico** («selecciona tu género biológico para el cálculo»).
 *     Reusarlo como llave de una función distinta acopla dos cosas que
 *     tienen que poder cambiar por separado.
 *
 * Por eso la llave real es una preferencia propia y revocable, que se ofrece
 * en el registro a quien declara género femenino u otro. Un hombre nunca la
 * ve porque nunca se le ofrece, que es justo el comportamiento pedido.
 */

import type { User } from '@/store/authStore'

/**
 * PRUEBAS · lista de correos con el ciclo activo.
 *
 * Mientras el módulo se construye, el acceso está restringido a estas cuentas
 * para poder verificar la función fantasma de verdad: entrando con una cuenta
 * de dentro y otra de fuera, y comprobando que la segunda no encuentra el
 * módulo por ningún camino.
 *
 * ── Cómo se quita ────────────────────────────────────────────────────────
 * Al terminar el módulo se vacía esta lista y `cycleEnabled` del perfil pasa
 * a ser la única llave. No hay que tocar nada más: `tieneCiclo()` ya consulta
 * las dos y la lista, vacía, deja de influir.
 *
 * La comparación normaliza a minúsculas y recorta espacios porque un correo
 * escrito con mayúsculas en el registro no debería dejar a nadie fuera.
 */
const CORREOS_DE_PRUEBA = [
  'caleblacrus@gmail.com',
] as const

/** true mientras la lista mande sobre la preferencia del perfil. */
export const EN_PRUEBAS = CORREOS_DE_PRUEBA.length > 0

const normalizar = (correo: string | undefined | null): string =>
  (correo ?? '').trim().toLowerCase()

/**
 * ¿Existe el ciclo menstrual para esta cuenta?
 *
 * Sin usuario devuelve false: durante la carga de sesión el módulo no se
 * pinta. Es preferible que aparezca un instante después a que asome y
 * desaparezca delante de quien no debería haberlo visto.
 */
export function tieneCiclo(user: User | null | undefined): boolean {
  if (!user) return false

  // En pruebas manda la lista, y solo la lista.
  if (EN_PRUEBAS) {
    return CORREOS_DE_PRUEBA.includes(normalizar(user.email) as typeof CORREOS_DE_PRUEBA[number])
  }

  // Régimen definitivo: la preferencia explícita del perfil.
  return user.cycleEnabled === true
}

/**
 * ¿A esta cuenta se le puede ofrecer activar el ciclo?
 *
 * Distinto de `tieneCiclo`: esto decide si la pregunta llega a aparecer en el
 * registro. A quien declara género masculino no se le ofrece nunca — así la
 * función no existe para él sin necesidad de esconderle nada después.
 *
 * Ante un valor que no reconocemos se ofrece: es mejor preguntar de más que
 * dejar fuera a alguien que lo necesita.
 */
export function puedeOfrecerseCiclo(user: User | null | undefined): boolean {
  if (!user) return false
  return normalizar(user.gender) !== 'male'
}

/**
 * ¿Puede ver contenido de ciclo en Social?
 *
 * Misma llave que el módulo: quien no tiene el ciclo tampoco ve las
 * publicaciones sobre él, ni en el muro, ni en búsqueda, ni en un perfil, ni
 * en los comentarios de un hilo. El filtro de verdad va en la consulta del
 * servidor; esta función solo evita pintar lo que el servidor ya no manda.
 */
export const puedeVerCicloEnSocial = tieneCiclo
