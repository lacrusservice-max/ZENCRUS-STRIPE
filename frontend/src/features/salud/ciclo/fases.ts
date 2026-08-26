/**
 * LAS CUATRO FASES
 * ═══════════════════════════════════════════════════════════════════════════
 * El vocabulario del ciclo. Ya no se define aquí: vive en el núcleo compartido
 * con el servidor —`nucleo/ciclo/fases.ts`— y este archivo solo lo reexporta
 * con los nombres que usa la app.
 *
 * ── Por qué queda el archivo si no define nada ─────────────────────────────
 * Porque `Phase` y `PHASE_ORDER` se importan desde treinta sitios. Renombrarlos
 * todos a `Fase` y `ORDEN_FASES` sería un cambio de treinta archivos que no
 * arregla nada y que puede colar un error en cualquiera de ellos. El núcleo
 * habla en español como el resto del proyecto; esta capa traduce, cuesta cinco
 * líneas y deja el cambio en un solo sitio.
 *
 * ── Y por qué el dominio no conoce el tema ─────────────────────────────────
 * Sigue en pie lo de antes: `theme/salud/tokens.ts` importa de aquí y
 * reexporta, no al revés. El motor de correlación no debería arrastrar
 * `react-native-reanimated` para calcular una media.
 */

import {
  type Fase, ORDEN_FASES, faseSiguiente,
} from '@/nucleo/ciclo/fases'

export type Phase = Fase
export const PHASE_ORDER: Phase[] = ORDEN_FASES
export const nextPhase = faseSiguiente
