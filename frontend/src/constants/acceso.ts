/**
 * ¿SE COBRA, O ESTAMOS PROBANDO?
 * ══════════════════════════════
 * Un solo interruptor para todo el muro de pago. En `false`, quien se registra
 * contesta el cuestionario, ve el plan que le sale y entra: no se le pide
 * tarjeta ni elegir plan en ningún punto.
 *
 * ── Por qué un interruptor y no borrar el código ────────────────────────────
 * Porque esto es «por el momento». El cobro está construido —pantalla de
 * planes, checkout, Stripe, comprobación de suscripción al abrir— y borrarlo
 * significaría reescribirlo, y recordar cómo era, dentro de unos meses. Con el
 * interruptor, volver a cobrar es cambiar esta palabra.
 *
 * ── Lo que NO apaga ─────────────────────────────────────────────────────────
 * El cuestionario de onboarding y el plan nutricional calculado se quedan: eso
 * no es el muro, es la app. Y las pantallas de suscripción siguen existiendo y
 * accesibles desde Ajustes, para poder trabajarlas mientras tanto.
 */
export const COBRO_ACTIVO = false

/**
 * ¿SE PIDE ENTRAR, O SE ENTRA DIRECTO?
 * ════════════════════════════════════
 * En `false` la app abre directamente en las pestañas: no manda al login ni al
 * cuestionario. Es un apaño de desarrollo, para no tener que escribir la
 * contraseña cada vez que se recarga la app mientras se trabaja en la interfaz.
 *
 * ── Cómo se vuelve a activar ────────────────────────────────────────────────
 * Cambiando estas dos palabras a `true`. Nada más: no hay código comentado ni
 * pantallas borradas. El login, el registro y el cuestionario siguen enteros y
 * en su sitio; lo único que cambia es si alguien te manda a ellos.
 *
 * Todas las guardas están escritas como `LOGIN_ACTIVO && !isAuthenticated`, así
 * que con el interruptor en `true` valen exactamente lo que valían antes.
 *
 * ── Lo que NO arregla ───────────────────────────────────────────────────────
 * Entrar sin sesión es entrar SIN TOKEN: la interfaz se ve entera, pero las
 * llamadas al servidor no traen nada y las pantallas salen vacías. Sirve para
 * mirar y tocar la app, no para probar datos. Para eso hay que entrar de verdad.
 */
export const LOGIN_ACTIVO = true
export const ONBOARDING_ACTIVO = true
