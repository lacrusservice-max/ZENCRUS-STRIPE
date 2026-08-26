/**
 * CICLO · LO QUE EL SERVIDOR TAMBIÉN TIENE QUE SABER
 * ═══════════════════════════════════════════════════════════════════════════
 * Dos cosas que existen ya en el móvil y que aquí NO son un duplicado por
 * descuido, sino una decisión:
 *
 *   1. Los esquemas de los 14 trackers.
 *   2. La deducción de los periodos a partir del sangrado.
 *
 * ── Por qué los esquemas están en los dos lados ────────────────────────────
 * Porque un esquema que solo valida en el cliente no valida nada: cualquiera
 * con el token puede escribir directamente contra la API. Estas ocho tablas
 * son las más sensibles del proyecto —el historial reproductivo de una
 * persona—, así que lo que entra se comprueba aquí aunque ya se hubiera
 * comprobado allí.
 *
 * ── Y por qué la deducción también ─────────────────────────────────────────
 * `cycle_periods` es una vista materializada de `cycle_logs`, no una segunda
 * fuente. Se recalcula EN LA MISMA PETICIÓN en que cambian los registros, así
 * que no puede quedarse vieja. Si en vez de eso se guardara lo que el móvil
 * dedujo, dos versiones distintas de la app escribirían periodos distintos
 * sobre los mismos datos y el historial dependería de quién sincronizó último.
 *
 * ── La regla al copiar ─────────────────────────────────────────────────────
 * Si algo de esto cambia, cambia en los dos sitios A LA VEZ:
 *   frontend/src/features/salud/ciclo/periodos.ts
 *   frontend/src/features/salud/trackers.ts
 * Un umbral distinto entre cliente y servidor produce el peor fallo posible
 * aquí: la app enseña un ciclo y la base guarda otro.
 */


// ═══ Trackers ══════════════════════════════════════════════════════════════

/* ── El contrato de datos ────────────────────────────────────────────────
   Los dieciocho esquemas vivían escritos a mano AQUÍ y otra vez en
   `frontend/src/features/salud/trackers.ts`. Eran copias fieles, pero la
   penalización por que se separaran no era un error visible: si un lado añade
   un campo y el otro no, el registro se rechaza y —como el lote «descarta lo
   inválido y sigue»— se pierde en silencio. Ahora hay una sola fuente. */
export {
  TRACKER_KINDS, TRACKER_SCHEMAS, validarTracker, ZONAS_DOLOR,
} from '../nucleo/ciclo/trackers'
export type { TrackerKind, TrackerValue } from '../nucleo/ciclo/trackers'

import { TRACKER_SCHEMAS } from '../nucleo/ciclo/trackers'
import type { TrackerKind } from '../nucleo/ciclo/trackers'
import {
  agruparPeriodos, SANGRADO_MINIMO, diasEntreFechas,
} from '../nucleo/ciclo/fases'


export function limpiarTracker(kind: TrackerKind, value: unknown): unknown | null {
  const esquema = TRACKER_SCHEMAS[kind]
  if (!esquema) return null

  const r = esquema.safeParse(value)
  if (!r.success) return null

  /* La ruta de la foto de un test se descarta aquí, y no en el móvil, porque
     lo que importa es que NUNCA se escriba: si la limpieza viviera solo en el
     cliente, bastaría una versión vieja de la app para empezar a guardar
     rutas de fotos de tests de embarazo en la base. */
  if (kind === 'prueba') {
    const { photoLocalUri, ...resto } = r.data as Record<string, unknown>
    return resto
  }
  return r.data
}

// ═══ Periodos ══════════════════════════════════════════════════════════════

const DIA_MS = 86_400_000

export function diasEntre(a: string, b: string): number {
  const [a1, m1, d1] = a.split('-').map(Number)
  const [a2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / DIA_MS)
}

export interface PeriodoDerivado {
  inicio: string
  fin: string | null
  diasSangrado: number
  duracionCiclo: number | null
  declarado: boolean
}

/**
 * Reconstruye los periodos a partir del sangrado registrado.
 *
 * La REGLA —las tres guardas contra el periodo fantasma— vive en
 * `nucleo/ciclo/fases.ts`, compartida con la app. Aquí solo se traduce la
 * forma de los datos: el servidor recibe filas y la app un mapa por fecha.
 *
 * Antes estaba escrita entera aquí y otra vez en el cliente. Eran copias
 * fieles, pero una regla copiada es una regla que algún día deja de estarlo, y
 * cuando eso pase el servidor guardará unos periodos y la pantalla enseñará
 * otros sin que nada falle.
 */
export function derivarPeriodos(
  sangrados: Array<{ fecha: string; nivel: number; fueraDePeriodo?: boolean }>,
  declarados: string[] = [],
): PeriodoDerivado[] {
  const conSangrado = sangrados
    /* La cuarta guarda, la única que no deduce el motor: ella declara que ese
       sangrado no es su regla. Gemela de la de `frontend/.../ciclo/periodos.ts`. */
    .filter(s => !s.fueraDePeriodo && s.nivel >= SANGRADO_MINIMO)
    .map(s => s.fecha)

  const { periodos: grupos } = agruparPeriodos(conSangrado, declarados)

  const periodos: PeriodoDerivado[] = grupos.map(g => ({
    inicio: g.inicio,
    fin: g.fin,
    diasSangrado: g.diasSangrado,
    duracionCiclo: null,
    declarado: g.declarado,
  }))

  /* La duración se conoce al saber cuándo empezó el siguiente. La del último se
     queda en null a propósito: rellenarla con la media sería guardar una
     estimación como si fuera un hecho, y la migración 018 lo dice en la propia
     columna. */
  for (let i = 0; i < periodos.length - 1; i++) {
    periodos[i].duracionCiclo = diasEntreFechas(periodos[i].inicio, periodos[i + 1].inicio)
  }

  return periodos
}
