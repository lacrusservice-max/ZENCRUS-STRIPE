/**
 * SINCRONIZACIÓN DEL REGISTRO DE NUTRICIÓN
 * ────────────────────────────────────────
 * El servidor pasa a ser la verdad; AsyncStorage se queda como caché para que
 * la app siga funcionando sin señal. Este módulo es el puente entre los dos.
 *
 * ── Por qué no se quita AsyncStorage ────────────────────────────────────────
 * Registrar la comida es justo lo que se hace en sitios con mala cobertura: un
 * restaurante en un sótano, el metro, la cocina de casa con el router lejos. Si
 * apuntar dependiera de la red, la gente dejaría de apuntar — y una app de
 * nutrición que no se usa cuando comes no sirve para nada.
 *
 * Entonces: la pantalla escribe SIEMPRE en local y responde al instante; lo que
 * no llegue al servidor se queda en la cola y se reintenta después.
 *
 * ── La cola no puede duplicar ───────────────────────────────────────────────
 * Cada entrada lleva su `clientId` —el mismo id que ya generaba la app— y el
 * servidor lo usa como llave de idempotencia. Reintentar diez veces la misma
 * entrada deja una fila, no diez. Por eso la cola puede ser tonta: reintenta y
 * ya, sin llevar cuenta de qué llegó.
 *
 * ── La migración ocurre una sola vez ────────────────────────────────────────
 * Quien ya tenga meses de registro en el teléfono los sube en el primer
 * arranque con esta versión. Se marca hecha con una bandera y no se repite; si
 * falla a medias, el `clientId` hace que reintentarla no duplique nada.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { FoodEntry, MealSlot } from './nutritionStore'
import {
  leerDia, registrarLote, guardarDia,
  type NuevaEntrada, type MealSlotId, type EntradaServidor,
} from '@/services/nutritionService'

const COLA = 'nutricion_cola_pendiente'
const MIGRADO = 'nutricion_migrado_v1'

/** Una operación que aún no llegó al servidor. */
type Pendiente =
  | { tipo: 'entradas'; fecha: string; entradas: NuevaEntrada[] }
  | { tipo: 'dia'; fecha: string; waterGlasses?: number; streak?: number }

// ── Traducción entre el modelo del store y el del servidor ───────────────────

export function aNuevaEntrada(mealSlot: MealSlotId, e: FoodEntry): NuevaEntrada {
  return {
    clientId: e.id,           // el id que ya generó la pantalla
    mealSlot,
    name: e.name,
    emoji: e.emoji,
    amount: e.amount,
    unit: e.unit || 'g',
    calories: e.calories,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    fiber: e.fiber,
    active: e.active !== false,
    consumedAt: e.timestamp ? new Date(e.timestamp).toISOString() : undefined,
  }
}

export function aFoodEntry(s: EntradaServidor): FoodEntry {
  return {
    // Se usa el clientId como id local: así la pantalla sigue reconociendo sus
    // propias entradas después de recargar del servidor, y un borrado local
    // apunta a la misma cosa que el servidor conoce.
    id: s.clientId || s.id,
    name: s.name,
    calories: s.calories,
    protein: s.protein,
    carbs: s.carbs,
    fat: s.fat,
    fiber: s.fiber,
    amount: s.amount,
    unit: s.unit,
    timestamp: s.consumedAt ? new Date(s.consumedAt).getTime() : new Date(s.createdAt).getTime(),
    active: s.active,
    emoji: s.emoji,
    /** Id de la fila en el servidor, para poder actualizarla o borrarla. */
    serverId: s.id,
  } as FoodEntry
}

/** Reparte las entradas del servidor en los seis huecos de comida del store. */
export function repartirEnComidas(base: MealSlot[], entradas: EntradaServidor[]): MealSlot[] {
  return base.map(m => ({
    ...m,
    entries: entradas.filter(e => e.mealSlot === m.id).map(aFoodEntry),
  }))
}

// ── Cola de pendientes ───────────────────────────────────────────────────────

async function leerCola(): Promise<Pendiente[]> {
  try {
    const raw = await AsyncStorage.getItem(COLA)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function escribirCola(cola: Pendiente[]): Promise<void> {
  // Se acota para que un usuario que pase semanas sin red no acumule un
  // fichero enorme que además tardaría minutos en vaciarse.
  const acotada = cola.slice(-200)
  await AsyncStorage.setItem(COLA, JSON.stringify(acotada))
}

async function encolar(p: Pendiente): Promise<void> {
  const cola = await leerCola()
  cola.push(p)
  await escribirCola(cola)
}

/**
 * Vacía la cola. Se llama al abrir la pantalla y después de cada escritura
 * con éxito, que es la señal más barata de que hay red.
 *
 * Si algo vuelve a fallar se deja en la cola y se corta: reintentar el resto
 * cuando el primero ya falló solo gasta batería.
 */
export async function vaciarCola(): Promise<{ enviados: number; pendientes: number }> {
  const cola = await leerCola()
  if (cola.length === 0) return { enviados: 0, pendientes: 0 }

  let enviados = 0
  for (let i = 0; i < cola.length; i++) {
    const p = cola[i]
    try {
      if (p.tipo === 'entradas') await registrarLote(p.fecha, p.entradas)
      else await guardarDia(p.fecha, { waterGlasses: p.waterGlasses, streak: p.streak })
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
 * Saca de la cola una entrada que el usuario borró antes de que llegara a
 * subirse.
 *
 * Sin esto hay fantasmas: registras algo sin red, lo borras, y minutos después
 * la cola lo sube igual y reaparece en la siguiente sincronización. Desde
 * fuera parece que la app resucita comida sola, y no hay forma de que el
 * usuario entienda por qué.
 */
export async function olvidarPendiente(clientId: string): Promise<void> {
  const cola = await leerCola()
  let tocada = false

  const limpia = cola
    .map(p => {
      if (p.tipo !== 'entradas') return p
      const quedan = p.entradas.filter(e => e.clientId !== clientId)
      if (quedan.length !== p.entradas.length) tocada = true
      return { ...p, entradas: quedan }
    })
    .filter(p => p.tipo !== 'entradas' || p.entradas.length > 0)

  if (tocada) await escribirCola(limpia as Pendiente[])
}

// ── Escrituras con red, con caída a la cola ──────────────────────────────────

export async function sincronizarEntradas(fecha: string, entradas: NuevaEntrada[]): Promise<boolean> {
  if (entradas.length === 0) return true
  try {
    await registrarLote(fecha, entradas)
    void vaciarCola()
    return true
  } catch {
    await encolar({ tipo: 'entradas', fecha, entradas })
    return false
  }
}

export async function sincronizarDia(
  fecha: string, datos: { waterGlasses?: number; streak?: number },
): Promise<boolean> {
  try {
    await guardarDia(fecha, datos)
    return true
  } catch {
    await encolar({ tipo: 'dia', fecha, ...datos })
    return false
  }
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/**
 * Trae el día del servidor. Devuelve null si no hay red, y entonces quien
 * llama se queda con lo que tenga en caché — que es lo correcto: enseñar el
 * registro de ayer es infinitamente mejor que enseñar una pantalla vacía.
 */
export async function traerDia(fecha: string) {
  try {
    return await leerDia(fecha)
  } catch {
    return null
  }
}

// ── Migración de lo que ya está en el teléfono ───────────────────────────────

/**
 * Sube a Supabase todo el histórico guardado bajo `nutrition_YYYY-MM-DD`.
 *
 * Se ejecuta una sola vez por instalación. No borra nada del teléfono: si algo
 * saliera mal, el original sigue ahí. Y como cada entrada viaja con su
 * `clientId`, volver a correrla no duplicaría nada.
 */
export async function migrarHistorico(): Promise<{ dias: number; entradas: number; fallos: number }> {
  const yaHecho = await AsyncStorage.getItem(MIGRADO)
  if (yaHecho) return { dias: 0, entradas: 0, fallos: 0 }

  const todas = await AsyncStorage.getAllKeys()
  const llaves = todas.filter(k => /^nutrition_\d{4}-\d{2}-\d{2}$/.test(k)).sort()

  let dias = 0, entradas = 0, fallos = 0

  for (const llave of llaves) {
    const fecha = llave.replace('nutrition_', '')
    try {
      const raw = await AsyncStorage.getItem(llave)
      if (!raw) continue
      const guardado = JSON.parse(raw) as { meals?: MealSlot[]; waterGlasses?: number; streak?: number }

      const lote: NuevaEntrada[] = []
      for (const comida of guardado.meals ?? []) {
        for (const e of comida.entries ?? []) {
          if (!e?.id || !e?.name) continue     // basura de versiones viejas
          lote.push(aNuevaEntrada(comida.id, e))
        }
      }

      // El servidor acepta 60 por petición; los días muy cargados van por tandas.
      for (let i = 0; i < lote.length; i += 50) {
        await registrarLote(fecha, lote.slice(i, i + 50))
      }
      if (guardado.waterGlasses || guardado.streak) {
        await guardarDia(fecha, { waterGlasses: guardado.waterGlasses, streak: guardado.streak })
      }

      entradas += lote.length
      dias++
    } catch {
      fallos++
      // Se sigue con los demás días: que uno falle no puede costar el resto
      // del historial. Los fallidos se recuperan al reintentar la migración.
    }
  }

  // Solo se marca hecha si NADA falló. Si algo quedó fuera, el próximo arranque
  // lo reintenta, y el clientId impide que lo ya subido se duplique.
  if (fallos === 0) await AsyncStorage.setItem(MIGRADO, new Date().toISOString())

  return { dias, entradas, fallos }
}
