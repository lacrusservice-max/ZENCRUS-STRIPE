/**
 * SINCRONIZACIÓN DEL SEGUIMIENTO
 * ──────────────────────────────
 * El puente entre los siete stores de la migración 012 y el servidor. Mismo
 * trato que en nutrición: el servidor es la verdad, AsyncStorage se queda como
 * caché para que la app siga funcionando sin señal.
 *
 * ── Una sola cola para todo ─────────────────────────────────────────────────
 * Peso, hábitos y actividad comparten cola. Con una por dominio, tres módulos
 * reintentarían por su cuenta al volver la red y se pisarían: la misma
 * conexión mala, tres tandas de peticiones a la vez y tres formas distintas de
 * fallar a medias.
 *
 * ── Y solo para esos tres ───────────────────────────────────────────────────
 * El ciclado, el plan de comidas y las metas no encolan. Son documentos que se
 * escriben enteros: si un guardado no llega, el siguiente manda otra vez el
 * documento completo y lo corrige. Una cola ahí no arregla nada y añade una
 * forma de que un plan viejo pise uno nuevo al vaciarse tarde.
 *
 * ── El día es el del reloj del usuario ──────────────────────────────────────
 * `hoyLocal()`, de `@/utils/fechas`, que es el mismo que usa el resto de la
 * app. Importa especialmente aquí: la fecha viaja al servidor y es la que
 * decide en qué día cae una comida, un peso o una racha. Calcularla en UTC
 * —como hacía todo el proyecto— mandaba al día siguiente cualquier cosa
 * apuntada después de las seis de la tarde en México.
 */

import { hoyLocal } from '@/utils/fechas'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  guardarMedicion, guardarMediciones, marcarHabito, guardarRegistrosHabitos,
  crearHabito, marcarActividad, guardarActividad, guardarCiclo, guardarPlanSemana,
  crearMeta, leerActividad, leerHabitos, leerMediciones, leerCiclo,
  type NuevaMedicion, type MarcasDia, type TipoDia,
} from '@/services/trackingService'
import {
  medicionesDelLegado, habitosDelLegado, registrosDeHabitos, diasDelLegado, metaDelLegado,
} from '@/utils/migracionLegado'

export { esMedidaDeMentira } from '@/utils/migracionLegado'

const COLA = 'seguimiento_cola_pendiente'
const MIGRADO = 'seguimiento_migrado_v1'

// ── Cola de pendientes ───────────────────────────────────────────────────────

type Pendiente =
  | { tipo: 'medicion'; medicion: NuevaMedicion }
  | { tipo: 'habito'; habitKey: string; fecha: string; hecho: boolean; segundos?: number }
  | { tipo: 'actividad'; fecha: string; marcas: MarcasDia }

async function leerCola(): Promise<Pendiente[]> {
  try {
    const raw = await AsyncStorage.getItem(COLA)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function escribirCola(cola: Pendiente[]): Promise<void> {
  // Se acota para que quien pase semanas sin red no acumule un fichero enorme
  // que además tardaría minutos en vaciarse.
  await AsyncStorage.setItem(COLA, JSON.stringify(cola.slice(-300)))
}

async function encolar(p: Pendiente): Promise<void> {
  const cola = await leerCola()
  cola.push(p)
  await escribirCola(cola)
}

/**
 * Vacía la cola. Se llama al abrir cada pantalla y después de cada escritura
 * con éxito, que es la señal más barata de que hay red.
 *
 * Si algo vuelve a fallar se deja lo que queda y se corta: reintentar el resto
 * cuando el primero ya falló solo gasta batería.
 */
export async function vaciarCola(): Promise<{ enviados: number; pendientes: number }> {
  const cola = await leerCola()
  if (cola.length === 0) return { enviados: 0, pendientes: 0 }

  let enviados = 0
  for (let i = 0; i < cola.length; i++) {
    const p = cola[i]
    try {
      if (p.tipo === 'medicion') await guardarMedicion(p.medicion)
      else if (p.tipo === 'habito') await marcarHabito(p.habitKey, p.fecha, p.hecho, p.segundos)
      else await marcarActividad(p.fecha, p.marcas)
      enviados++
    } catch {
      await escribirCola(cola.slice(i))
      return { enviados, pendientes: cola.length - i }
    }
  }

  await escribirCola([])
  return { enviados, pendientes: 0 }
}

/**
 * Saca de la cola una medición que el usuario borró antes de que subiera.
 *
 * Sin esto hay fantasmas: apuntas un peso sin red, lo borras, y al volver la
 * señal la cola lo sube igual y reaparece en la siguiente lectura. Desde fuera
 * parece que la app resucita datos sola.
 */
export async function olvidarMedicion(clientId: string): Promise<void> {
  const cola = await leerCola()
  const limpia = cola.filter(p => !(p.tipo === 'medicion' && p.medicion.clientId === clientId))
  if (limpia.length !== cola.length) await escribirCola(limpia)
}

// ── Escrituras optimistas ────────────────────────────────────────────────────
// La pantalla ya respondió; esto va detrás y cae a la cola si no hay red.

export async function sincronizarMedicion(medicion: NuevaMedicion): Promise<boolean> {
  try {
    await guardarMedicion(medicion)
    void vaciarCola()
    return true
  } catch {
    await encolar({ tipo: 'medicion', medicion })
    return false
  }
}

export async function sincronizarHabito(
  habitKey: string, fecha: string, hecho: boolean, segundos?: number,
): Promise<boolean> {
  try {
    await marcarHabito(habitKey, fecha, hecho, segundos)
    void vaciarCola()
    return true
  } catch {
    await encolar({ tipo: 'habito', habitKey, fecha, hecho, segundos })
    return false
  }
}

export async function sincronizarActividad(fecha: string, marcas: MarcasDia): Promise<boolean> {
  try {
    await marcarActividad(fecha, marcas)
    void vaciarCola()
    return true
  } catch {
    await encolar({ tipo: 'actividad', fecha, marcas })
    return false
  }
}

// ── Lecturas tolerantes ──────────────────────────────────────────────────────
// Devuelven `null` sin red y quien llama se queda con su caché: enseñar los
// datos de ayer es infinitamente mejor que enseñar una pantalla vacía.

export const traerMediciones = (desde?: string, hasta?: string) =>
  leerMediciones(desde, hasta).catch(() => null)

export const traerHabitos = (desde?: string, hasta?: string) =>
  leerHabitos(desde, hasta).catch(() => null)

export const traerActividad = (desde: string, hasta: string, hoy = hoyLocal()) =>
  leerActividad(desde, hasta, hoy).catch(() => null)

export const traerCiclo = () => leerCiclo().catch(() => null)

// ── Lo que ya está en el teléfono ────────────────────────────────────────────

/** Lo que guarda `zustand/persist`: `{ state: {...}, version: n }`. */
async function leerPersistido<T>(llave: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(llave)
    if (!raw) return null
    return (JSON.parse(raw)?.state ?? null) as T | null
  } catch {
    return null
  }
}

async function leerJSON<T>(llave: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(llave)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

// ── La migración, una sola vez ───────────────────────────────────────────────

export interface ResultadoMigracion {
  mediciones: number
  habitos: number
  registrosHabitos: number
  dias: number
  ciclo: boolean
  semanas: number
  metas: number
  fallos: number
}

/**
 * Sube a Supabase todo lo que ya esté en el teléfono.
 *
 * Se ejecuta una sola vez por instalación y no borra nada del móvil: si algo
 * saliera mal, el original sigue ahí. Cada dominio va en su propio `try` para
 * que un histórico corrupto de hace dos versiones no se lleve por delante los
 * otros seis.
 */
export async function migrarSeguimiento(): Promise<ResultadoMigracion> {
  const r: ResultadoMigracion = {
    mediciones: 0, habitos: 0, registrosHabitos: 0, dias: 0,
    ciclo: false, semanas: 0, metas: 0, fallos: 0,
  }

  if (await AsyncStorage.getItem(MIGRADO)) return r

  const llaves = await AsyncStorage.getAllKeys()

  // ── Peso y medidas: los dos stores que se fusionan ────────────────────────
  try {
    const lote = medicionesDelLegado({
      pesos: (await leerJSON<any[]>('weight_history')) ?? [],
      medidas: (await leerJSON<any[]>('measurement_history')) ?? [],
      cuerpo: (await leerPersistido<{ measurements?: any[] }>('zencrus-body-measurements'))?.measurements ?? [],
    })

    for (let i = 0; i < lote.length; i += 150) {
      r.mediciones += await guardarMediciones(lote.slice(i, i + 150))
    }
  } catch { r.fallos++ }

  // ── Hábitos ───────────────────────────────────────────────────────────────
  try {
    // Las definiciones tienen que existir ANTES que el cumplimiento: el
    // servidor descarta el registro de un hábito que no conoce, y sin esta
    // lectura —que es la que siembra los cinco de fábrica— se perdería el
    // historial de `sleep`, `water`, `workout`… es decir, casi todo.
    //
    // Si falla se lanza a propósito: mejor reintentar la migración entera en el
    // próximo arranque que darla por buena habiendo tirado meses de datos.
    if (!(await traerHabitos())) throw new Error('no se pudieron sembrar los hábitos')

    for (const h of habitosDelLegado(await leerJSON<any[]>('habits_list'))) {
      await crearHabito(h.habitKey, h.label, h.icon, { orden: 100 })
      r.habitos++
    }

    const planos = registrosDeHabitos(await leerJSON<Record<string, Record<string, boolean>>>('habits_logs'))
    for (let i = 0; i < planos.length; i += 500) {
      const { count } = await guardarRegistrosHabitos(planos.slice(i, i + 500))
      r.registrosHabitos += count
    }
  } catch { r.fallos++ }

  // ── Actividad diaria ──────────────────────────────────────────────────────
  try {
    const actividades = []
    for (const llave of llaves.filter(k => /^activity_\d{4}-\d{2}-\d{2}$/.test(k))) {
      actividades.push({ date: llave.replace('activity_', ''), datos: await leerJSON<any>(llave) })
    }

    const dias = diasDelLegado(actividades, (await leerJSON<string[]>('streak_protected_dates')) ?? [])
    for (let i = 0; i < dias.length; i += 300) {
      r.dias += await guardarActividad(dias.slice(i, i + 300))
    }
  } catch { r.fallos++ }

  // ── Ciclado de macros ─────────────────────────────────────────────────────
  try {
    const c = await leerJSON<any>('macro_cycling')
    if (Array.isArray(c?.weekCycle) && c.weekCycle.length === 7) {
      await guardarCiclo(c.weekCycle as TipoDia[], c.currentPreset ?? null, !!c.enabled)
      r.ciclo = true
    }
  } catch { r.fallos++ }

  // ── Planes de comidas ─────────────────────────────────────────────────────
  try {
    for (const llave of llaves.filter(k => /^meal_plan_\d{4}-W\d{2}$/.test(k))) {
      const plan = await leerJSON<Record<string, unknown>>(llave)
      if (!plan || Object.keys(plan).length === 0) continue
      await guardarPlanSemana(llave.replace('meal_plan_', ''), plan)
      r.semanas++
    }
  } catch { r.fallos++ }

  // ── Metas ─────────────────────────────────────────────────────────────────
  try {
    const metas = (await leerPersistido<{ goals?: any[] }>('zencrus-goals'))?.goals ?? []
    for (const g of metas) {
      const meta = metaDelLegado(g)
      if (!meta) continue
      await crearMeta(meta)
      r.metas++
    }
  } catch { r.fallos++ }

  // Solo se marca hecha si NADA falló. Si algo quedó fuera, el próximo arranque
  // lo reintenta, y los `clientId` impiden que lo ya subido se duplique.
  if (r.fallos === 0) await AsyncStorage.setItem(MIGRADO, new Date().toISOString())

  return r
}
