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
