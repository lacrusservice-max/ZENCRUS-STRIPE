/**
 * LOS HÁBITOS QUE SE MARCAN SOLOS
 * ═══════════════════════════════════════════════════════════════════════════
 * Entrenar, la proteína y el agua ya los sabe la app. Pedir que además los
 * marques a mano es pedir lo mismo dos veces, y es lo que hace que una racha
 * mienta: no porque no lo hicieras, sino porque se te olvidó apuntarlo.
 *
 * Esto es, además, lo único que ninguna app de hábitos puede copiar: hace
 * falta tener los datos de nutrición y de entrenamiento en la misma casa.
 *
 * ── Solo las llaves de fábrica ─────────────────────────────────────────────
 * `workout`, `protein` y `water` son llaves que pone el servidor al sembrar, y
 * su significado lo define la app. Un hábito propio se llama `custom_…` y no
 * entra aquí: adivinar por la etiqueta —«¿"Correr 5k" es entrenar?»— es
 * exactamente el tipo de suposición que acaba marcando algo que no pasó.
 *
 * ── Marcar, nunca desmarcar ────────────────────────────────────────────────
 * `asegurarHecho` es idempotente. La comprobación de nutrición corre en cada
 * cambio del día —cada alimento, cada vaso—, así que si fuera un interruptor
 * te desmarcaría la proteína en cuanto añadieras otra comida.
 *
 * ── Por qué una suscripción y no ocho llamadas ─────────────────────────────
 * `nutritionStore` toca sus totales en ocho sitios distintos. Enganchar cada
 * uno significa que el noveno que se añada mañana nazca roto. Escuchando al
 * store se comprueba lo que de verdad importa: que el total cambió.
 */

import { useHabitsStore } from '@/store/habitsStore'
import { useNutritionStore, META_VASOS } from '@/store/nutritionStore'
import { useAuthStore } from '@/store/authStore'

/** Sin meta guardada, la misma que usa la pantalla de Nutrición. */
const PROTEINA_POR_DEFECTO = 150

async function marcar(llave: string): Promise<void> {
  try {
    await useHabitsStore.getState().asegurarHecho(llave)
  } catch {
    // Que no se marque un hábito jamás puede tumbar lo que lo disparó: ni el
    // cierre de un entrenamiento ni apuntar un vaso de agua.
  }
}

/** Terminaste un entrenamiento —de gimnasio, de casa o una salida—. */
export function alTerminarEntrenamiento(): void {
  void marcar('workout')
}

/**
 * Cambió algo del día en Nutrición. Se comprueban las dos metas que la app
 * conoce; las que no se hayan alcanzado, simplemente no marcan nada.
 */
export function alCambiarNutricion(): void {
  const { totalProtein, waterGlasses } = useNutritionStore.getState()
  const goals = (useAuthStore.getState().user as { goals?: { protein_g?: number } } | null)?.goals

  if (totalProtein >= (goals?.protein_g ?? PROTEINA_POR_DEFECTO)) void marcar('protein')
  if (waterGlasses >= META_VASOS) void marcar('water')
}

/**
 * Se engancha UNA vez, al arrancar la app.
 *
 * Devuelve la función para soltarlo, que en la práctica no se usa —vive lo que
 * vive la app— pero deja la suscripción cerrable y hace la prueba posible.
 */
export function vigilarHabitosAutomaticos(): () => void {
  let previoProteina = useNutritionStore.getState().totalProtein
  let previoVasos = useNutritionStore.getState().waterGlasses

  return useNutritionStore.subscribe(estado => {
    // Solo cuando cambia de verdad: el store se repinta por muchas otras cosas
    // —el día, la racha, la caché— y no hace falta consultar en cada una.
    if (estado.totalProtein === previoProteina && estado.waterGlasses === previoVasos) return
    previoProteina = estado.totalProtein
    previoVasos = estado.waterGlasses
    alCambiarNutricion()
  })
}
