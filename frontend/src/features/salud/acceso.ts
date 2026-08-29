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

  /* La llave la calcula el SERVIDOR y viaja en `/users/profile`. Aquí no se
     vuelve a decidir: antes esta regla estaba escrita dos veces, la copia del
     servidor tenía una lista de correos de pruebas que nadie vació, y el
     módulo acabó existiendo para una sola cuenta. Una regla de permisos
     escrita en dos sitios diverge; la única pregunta que se puede hacer desde
     el cliente es qué contestó el servidor. */
  if (typeof user.cycleEnabled === 'boolean') return user.cycleEnabled

  /* Sesión guardada de antes de que el perfil trajera la llave. Se deriva lo
     mismo que deriva el servidor para no dejar a nadie fuera hasta la próxima
     recarga del perfil. Es un puente, y se puede quitar más adelante. */
  return normalizar(user.gender) !== 'male'
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
