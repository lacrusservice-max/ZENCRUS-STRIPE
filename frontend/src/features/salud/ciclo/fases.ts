/**
 * LAS CUATRO FASES
 * ═══════════════════════════════════════════════════════════════════════════
 * El vocabulario del ciclo, sin nada más. Ni colores, ni tamaños, ni
 * dependencias: solo qué fases hay y en qué orden van.
 *
 * ── Por qué vive aquí y no en los tokens ───────────────────────────────────
 * Estaba en `theme/salud/tokens.ts`, y por tanto cualquier archivo que
 * necesitara saber el orden de las fases arrastraba consigo el sistema visual
 * entero —y con él `react-native-reanimated`, que en un entorno de pruebas
 * sin nativos revienta al importarse. El motor de correlación no debería
 * necesitar saber de animaciones para calcular una media.
 *
 * La dependencia correcta va en este sentido: el tema conoce el dominio, el
 * dominio no conoce el tema. `tokens.ts` importa de aquí y lo reexporta, así
 * que nada de lo que ya importaba `Phase` desde el tema se rompe.
 */

export type Phase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea'

/** El orden real del ciclo. Se usa para interpolar entre fases vecinas. */
export const PHASE_ORDER: Phase[] = ['menstrual', 'folicular', 'ovulatoria', 'lutea']

/** La fase que sigue. Cierra el círculo: después de lútea viene menstrual. */
export const nextPhase = (p: Phase): Phase =>
  PHASE_ORDER[(PHASE_ORDER.indexOf(p) + 1) % PHASE_ORDER.length]
