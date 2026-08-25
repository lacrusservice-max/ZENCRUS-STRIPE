/**
 * LOS SONIDOS DE ALARMA
 * ═══════════════════════════════════════════════════════════════════════════
 * El catálogo, en UN solo sitio. La pantalla de hábitos no conoce ningún
 * sonido: recorre esta lista. Añadir uno es añadir una línea aquí y el fichero,
 * y aparece en el selector sin tocar nada más.
 *
 * ── Por qué no salen los tonos del iPhone ──────────────────────────────────
 * Porque iOS no los presta. El catálogo de tonos y alarmas del sistema es
 * exclusivo de la app Reloj: no hay API pública para leerlo ni para usarlo en
 * una notificación. Lo que sí puede hacer cualquier app —y hacen todas las de
 * despertador— es traer sus propios sonidos dentro del paquete. Eso es esto.
 *
 * ── De dónde salen ─────────────────────────────────────────────────────────
 * Los cinco se sintetizan con `scripts/sonidos-alarma.py`: son nuestros, no
 * traen licencia detrás y se retocan cambiando cuatro números. Van de `goteo`,
 * que casi no interrumpe, a `pulso`, que no se puede ignorar.
 *
 * ── Cómo añadir uno ────────────────────────────────────────────────────────
 *   1. Deja el fichero en `src/assets/sounds/`.
 *      Formato: `.wav`, `.aiff` o `.caf`. Máximo 30 segundos —iOS corta a los
 *      30 y reproduce el de por defecto si se pasa— y PCM o IMA4, no MP3.
 *   2. Añádelo a `sounds` en el plugin `expo-notifications` de `app.config.ts`.
 *   3. Añade la entrada aquí abajo, con `fichero` igual al nombre del archivo.
 *   4. Recompila el dev client: los sonidos se empaquetan en el binario, así
 *      que Fast Refresh NO basta.
 *
 * Sin el paso 4 la alarma sonará con el de por defecto, no en silencio.
 */

export interface SonidoAlarma {
  /**
   * Lo que se guarda en `alarma_sonido` y lo que se le pasa a la notificación.
   * `null` es el de por defecto de iOS, que siempre está disponible.
   */
  id: string | null
  /** Cómo se llama en la pantalla. */
  etiqueta: string
}

export const SONIDOS: SonidoAlarma[] = [
  { id: null,            etiqueta: 'Por defecto' },
  { id: 'amanecer.wav',  etiqueta: 'Amanecer' },
  { id: 'campanas.wav',  etiqueta: 'Campanas' },
  { id: 'cuerdas.wav',   etiqueta: 'Cuerdas' },
  { id: 'goteo.wav',     etiqueta: 'Goteo' },
  { id: 'pulso.wav',     etiqueta: 'Pulso' },
]

/** Cómo se llama el sonido guardado, para enseñarlo sin recorrer la lista fuera. */
export function nombreDeSonido(id: string | null | undefined): string {
  return SONIDOS.find(s => s.id === (id ?? null))?.etiqueta ?? 'Por defecto'
}

/** ¿Merece la pena enseñar un selector, o solo hay una opción? */
export const HAY_DONDE_ELEGIR = SONIDOS.length > 1
