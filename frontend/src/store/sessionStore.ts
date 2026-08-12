/**
 * SESIÓN DE ENTRENAMIENTO ACTIVA
 * ──────────────────────────────
 * El estado de lo que se está entrenando AHORA mismo.
 *
 * ── Registrar una serie no puede depender de la red ─────────────────────────
 * Media España entrena en un sótano. Si tocar «registrar» esperase a que el
 * servidor conteste, la app se quedaría pensando entre serie y serie y quien
 * entrena dejaría de registrar a la tercera. Así que la serie entra en el
 * estado AL INSTANTE y se manda en segundo plano; si falla, se queda en una
 * cola y se reintenta. Nada se pierde y nada se duplica: cada serie lleva su
 * `clientId`, y mandarla dos veces devuelve la misma fila.
 *
 * ── Esto SÍ se guarda en disco (a diferencia del store de la comunidad) ─────
 * El de la comunidad no se guarda: son mensajes ajenos, AsyncStorage no está
 * cifrado y sus URL firmadas caducan en una hora. Aquí es al revés: son kilos y
 * repeticiones propios, no caduca nada, y perderlos es perder el entrenamiento
 * entero porque el sistema mató la app mientras sonaba una canción. Se guarda
 * solo la sesión en curso, y se borra al cerrarla o al salir de la cuenta.
 *
 * ── El descanso se cuenta con una HORA DE FIN, no restando de uno en uno ────
 * Un contador que resta un segundo cada segundo se para cuando iOS congela la
 * app en segundo plano, y al volver marca dos minutos de menos. Guardando
 * cuándo termina, volver a la app calcula el tiempo que queda de verdad.
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  abrirSesion, sesionActiva, registrarSerie, borrarSerie,
  cerrarSesion, descartarSesion,
  Sesion, Serie, NuevaSerie, MarcaNueva, Cierre, Modo, Origen,
} from '@/services/sessionService'

const DISCO = 'zencrus_sesion_activa'

/** Identificador que pone la app. Solo tiene que ser único en este teléfono. */
export const nuevoClientId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

// ── Formas ───────────────────────────────────────────────────────────────────

/**
 * Una serie tal y como la ve la pantalla.
 *
 * Puede ser una serie que el servidor ya conoce (con `id` y `est_1rm`) o una
 * que todavía está en la cola. La pantalla las pinta igual: quien entrena no
 * tiene por qué enterarse de si hay cobertura, solo de que su serie está
 * registrada. Lo único que cambia es una marca discreta de «sin enviar».
 */
export interface SerieLocal {
  clientId: string
  /** Lo pone el servidor al guardarla. Vacío mientras está en la cola. */
  id?: string
  exerciseSlug?: string
  exerciseName: string
  orderIndex: number
  setIndex: number
  kind: NuevaSerie['kind']
  loadType: NuevaSerie['loadType']
  weightKg?: number | null
  reps?: number | null
  durationSeconds?: number | null
  distanceM?: number | null
  rir?: number | null
  rpe?: number | null
  restTakenSeconds?: number | null
  /** 1RM estimado que devuelve el servidor. Null cuando no aplica. */
  est1RM?: number | null
  /** Todavía no ha llegado al servidor. */
  pendiente: boolean
  hechaEn: number
}

/** Lo que la app quiere abrir, aunque todavía no lo sepa el servidor. */
interface SesionLocal {
  clientId: string
  id?: string
  mode: Modo
  source: Origen
  title: string
  routineId?: string
  empezadaEn: number
  /** Segundos que la sesión estuvo pausada. Se restan de la duración. */
  pausadaSegundos: number
  pausadaDesde: number | null
}

interface Guardado {
  sesion: SesionLocal
  series: SerieLocal[]
}

interface Estado {
  sesion: SesionLocal | null
  series: SerieLocal[]
  /** Récords batidos en esta sesión, para celebrarlos al terminar. */
  marcas: MarcaNueva[]
  /** Cuándo acaba el descanso (ms). Null = no hay descanso corriendo. */
  descansoHasta: number | null
  descansoTotal: number
  /** Cuándo acabó la última serie: es el descanso REAL de la siguiente. */
  ultimaSerieEn: number | null
  sincronizando: boolean
  cargando: boolean

  /** Series que el servidor todavía no ha confirmado. */
  pendientes: () => number

  restaurar: () => Promise<void>
  empezar: (o: { mode: Modo; source: Origen; title: string; routineId?: string }) => Promise<{ reanudada: boolean }>
  anotarSerie: (s: Omit<SerieLocal, 'clientId' | 'pendiente' | 'hechaEn' | 'id' | 'est1RM'>) => Promise<void>
  quitarSerie: (clientId: string) => Promise<void>
  empezarDescanso: (segundos: number) => void
  pararDescanso: () => void
  sumarAlDescanso: (segundos: number) => void
  pausar: () => void
  reanudar: () => void
  duracionSegundos: () => number
  terminar: (c?: Cierre) => Promise<Sesion | null>
  descartar: () => Promise<void>
  sincronizar: () => Promise<void>
  limpiar: () => Promise<void>
}

// ── Ayudas ───────────────────────────────────────────────────────────────────

const guardar = async (sesion: SesionLocal | null, series: SerieLocal[]) => {
  try {
    if (!sesion) await AsyncStorage.removeItem(DISCO)
    else await AsyncStorage.setItem(DISCO, JSON.stringify({ sesion, series } satisfies Guardado))
  } catch {
    // Quedarse sin espacio no puede tirar el entrenamiento en curso: lo que hay
    // en memoria sigue siendo válido y la cola lo mandará igual.
  }
}

const aNuevaSerie = (s: SerieLocal): NuevaSerie => ({
  clientId: s.clientId,
  exerciseSlug: s.exerciseSlug,
  exerciseName: s.exerciseName,
  orderIndex: s.orderIndex,
  setIndex: s.setIndex,
  kind: s.kind,
  loadType: s.loadType,
  weightKg: s.weightKg ?? null,
  reps: s.reps ?? null,
  durationSeconds: s.durationSeconds ?? null,
  distanceM: s.distanceM ?? null,
  rir: s.rir ?? null,
  rpe: s.rpe ?? null,
  restTakenSeconds: s.restTakenSeconds ?? null,
})

/** Une lo que devuelve el servidor con lo que ya está en pantalla. */
const fundir = (locales: SerieLocal[], delServidor: Serie[]): SerieLocal[] => {
  const porClientId = new Map(delServidor.map(s => [s.client_id, s]))
  const yaEstan = new Set(locales.map(s => s.clientId))

  const fundidas = locales.map(l => {
    const s = porClientId.get(l.clientId)
    return s ? { ...l, id: s.id, est1RM: s.est_1rm, pendiente: false } : l
  })

  // Series que están en el servidor y no aquí: otra sesión del mismo usuario en
  // otro teléfono, o esta misma app tras reinstalarse. Se traen.
  for (const s of delServidor) {
    if (yaEstan.has(s.client_id)) continue
    fundidas.push({
      clientId: s.client_id, id: s.id,
      exerciseSlug: s.exercise_slug ?? undefined,
      exerciseName: s.exercise_name,
      orderIndex: s.order_index, setIndex: s.set_index,
      kind: s.kind, loadType: s.load_type,
      weightKg: s.weight_kg, reps: s.reps,
      durationSeconds: s.duration_seconds, distanceM: s.distance_m,
      rir: s.rir, rpe: s.rpe, restTakenSeconds: s.rest_taken_seconds,
      est1RM: s.est_1rm, pendiente: false,
      hechaEn: new Date(s.performed_at).getTime(),
    })
  }

  return fundidas.sort((a, b) => a.orderIndex - b.orderIndex || a.setIndex - b.setIndex)
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useSessionStore = create<Estado>((set, get) => ({
  sesion: null,
  series: [],
  marcas: [],
  descansoHasta: null,
  descansoTotal: 0,
  ultimaSerieEn: null,
  sincronizando: false,
  cargando: false,

  pendientes: () => get().series.filter(s => s.pendiente).length,

  /**
   * Al abrir la app: primero el disco, después el servidor.
   *
   * El disco va primero porque es instantáneo y porque puede tener series que
   * el servidor todavía no conoce. El servidor va después para recuperar una
   * sesión empezada en otro sitio y para confirmar lo que estaba pendiente.
   */
  restaurar: async () => {
    set({ cargando: true })
    try {
      const crudo = await AsyncStorage.getItem(DISCO)
      if (crudo) {
        const g = JSON.parse(crudo) as Guardado
        set({ sesion: g.sesion, series: g.series })
      }

      const remota = await sesionActiva().catch(() => null)
      const local = get().sesion

      if (remota) {
        // La de aquí y la de allá son la misma cuando coincide el clientId. Si
        // no coinciden, manda la del servidor: es la que tiene el identificador
        // con el que se pueden registrar series.
        const sesion: SesionLocal = local && local.clientId === remota.session.client_id
          ? { ...local, id: remota.session.id }
          : {
              clientId: remota.session.client_id, id: remota.session.id,
              mode: remota.session.mode, source: remota.session.source,
              title: remota.session.title,
              routineId: remota.session.routine_id ?? undefined,
              empezadaEn: new Date(remota.session.started_at).getTime(),
              pausadaSegundos: 0, pausadaDesde: null,
            }
        const series = fundir(local?.clientId === sesion.clientId ? get().series : [], remota.sets)
        set({ sesion, series })
        await guardar(sesion, series)
      }

      if (get().sesion) await get().sincronizar()
    } finally {
      set({ cargando: false })
    }
  },

  /**
   * Empieza a entrenar.
   *
   * La sesión se abre en el estado ANTES de que conteste el servidor: quien
   * pulsa «empezar» tiene que ver la pantalla de entrenamiento en el acto, no
   * un giro de carga sobre una barra de cobertura. Si el servidor no está, se
   * entrena igual y la sesión se abre en cuanto vuelva la red.
   */
  empezar: async ({ mode, source, title, routineId }) => {
    const sesion: SesionLocal = {
      clientId: nuevoClientId(), mode, source, title, routineId,
      empezadaEn: Date.now(), pausadaSegundos: 0, pausadaDesde: null,
    }
    set({ sesion, series: [], marcas: [], descansoHasta: null, ultimaSerieEn: null })
    await guardar(sesion, [])

    try {
      const r = await abrirSesion({
        clientId: sesion.clientId, mode, source, title, routineId,
      })
      // El servidor puede devolver OTRA sesión: la que ya estaba abierta y
      // nadie cerró. Se adopta entera, con sus series, en vez de empezar una
      // nueva que la base rechazaría por el índice de sesión única.
      const adoptada: SesionLocal = {
        clientId: r.session.client_id, id: r.session.id,
        mode: r.session.mode, source: r.session.source, title: r.session.title,
        routineId: r.session.routine_id ?? undefined,
        empezadaEn: new Date(r.session.started_at).getTime(),
        pausadaSegundos: 0, pausadaDesde: null,
      }
      const series = fundir([], r.sets)
      set({ sesion: adoptada, series })
      await guardar(adoptada, series)
      return { reanudada: r.resumed }
    } catch {
      // Sin red. La sesión vive en el teléfono y se abrirá al sincronizar.
      return { reanudada: false }
    }
  },

  /**
   * Anota una serie.
   *
   * Entra en pantalla al momento y sale hacia el servidor después. El descanso
   * real —lo que se tardó de verdad desde la serie anterior— se calcula aquí,
   * no se pide: nadie va a teclear cuánto descansó.
   */
  anotarSerie: async (datos) => {
    const { sesion, series, ultimaSerieEn } = get()
    if (!sesion) return

    const ahora = Date.now()
    const serie: SerieLocal = {
      ...datos,
      clientId: nuevoClientId(),
      pendiente: true,
      hechaEn: ahora,
      restTakenSeconds: ultimaSerieEn ? Math.round((ahora - ultimaSerieEn) / 1000) : null,
    }

    const siguientes = [...series, serie]
    set({ series: siguientes, ultimaSerieEn: ahora })
    await guardar(sesion, siguientes)

    void get().sincronizar()
  },

  quitarSerie: async (clientId) => {
    const { sesion, series } = get()
    if (!sesion) return

    const serie = series.find(s => s.clientId === clientId)
    const siguientes = series.filter(s => s.clientId !== clientId)
    set({ series: siguientes })
    await guardar(sesion, siguientes)

    // Si nunca llegó al servidor, con quitarla de aquí basta.
    if (serie?.id && sesion.id) {
      await borrarSerie(sesion.id, serie.id).catch(() => {
        // Quedó borrada en pantalla y viva en el servidor. Se resuelve sola al
        // volver a entrar: `restaurar` trae lo que hay allí. Es preferible a
        // dejar en la cola un borrado que puede quedar colgado para siempre.
      })
    }
  },

  // ── Descanso ───────────────────────────────────────────────────────────────

  empezarDescanso: (segundos) => {
    set({ descansoHasta: Date.now() + segundos * 1000, descansoTotal: segundos })
  },

  pararDescanso: () => set({ descansoHasta: null, descansoTotal: 0 }),

  /** El botón de «+30 s»: alarga sin reiniciar. */
  sumarAlDescanso: (segundos) => {
    const { descansoHasta, descansoTotal } = get()
    if (!descansoHasta) return
    set({
      descansoHasta: descansoHasta + segundos * 1000,
      descansoTotal: descansoTotal + segundos,
    })
  },

  // ── Reloj ──────────────────────────────────────────────────────────────────

  pausar: () => {
    const { sesion } = get()
    if (!sesion || sesion.pausadaDesde) return
    set({ sesion: { ...sesion, pausadaDesde: Date.now() } })
  },

  reanudar: () => {
    const { sesion } = get()
    if (!sesion || !sesion.pausadaDesde) return
    const pausada = sesion.pausadaSegundos + Math.round((Date.now() - sesion.pausadaDesde) / 1000)
    set({ sesion: { ...sesion, pausadaSegundos: pausada, pausadaDesde: null } })
  },

  /**
   * Lo que se lleva entrenado, sin contar las pausas.
   *
   * Es la duración que se manda al cerrar. El servidor tiene la resta entre
   * empezar y terminar, pero esa cuenta incluye el rato en que alguien se fue a
   * comer y volvió, y eso no es entrenar.
   */
  duracionSegundos: () => {
    const { sesion } = get()
    if (!sesion) return 0
    const hasta = sesion.pausadaDesde ?? Date.now()
    return Math.max(0, Math.round((hasta - sesion.empezadaEn) / 1000) - sesion.pausadaSegundos)
  },

  // ── Cierre ─────────────────────────────────────────────────────────────────

  terminar: async (c) => {
    const { sesion } = get()
    if (!sesion) return null

    // Lo pendiente se manda ANTES de cerrar: una vez cerrada, el servidor
    // rechaza series nuevas con un 409 y se perderían las últimas.
    await get().sincronizar()

    const conId = get().sesion
    if (!conId?.id) return null

    try {
      const r = await cerrarSesion(conId.id, {
        durationSeconds: get().duracionSegundos(),
        ...c,
      })
      await get().limpiar()
      return r.session
    } catch {
      return null
    }
  },

  descartar: async () => {
    const { sesion } = get()
    if (sesion?.id) await descartarSesion(sesion.id).catch(() => {})
    await get().limpiar()
  },

  // ── La cola ────────────────────────────────────────────────────────────────

  /**
   * Manda al servidor lo que todavía no ha llegado.
   *
   * En ORDEN, y parando al primer fallo: las series de un ejercicio comparten
   * hueco, y si la segunda llegara antes que la primera el servidor la tomaría
   * como la que fija el ejercicio del hueco. Además, sin sesión abierta en el
   * servidor no hay dónde meter ninguna, así que eso va primero.
   */
  sincronizar: async () => {
    if (get().sincronizando) return
    const inicial = get().sesion
    if (!inicial) return

    set({ sincronizando: true })
    try {
      let sesion = inicial

      if (!sesion.id) {
        const r = await abrirSesion({
          clientId: sesion.clientId, mode: sesion.mode, source: sesion.source,
          title: sesion.title, routineId: sesion.routineId,
        })
        sesion = { ...sesion, id: r.session.id, clientId: r.session.client_id }
        set({ sesion })
      }

      for (const serie of get().series.filter(s => s.pendiente)) {
        const r = await registrarSerie(sesion.id!, aNuevaSerie(serie))
        set(estado => ({
          series: estado.series.map(s =>
            s.clientId === serie.clientId
              ? { ...s, id: r.set.id, est1RM: r.set.est_1rm, pendiente: false }
              : s),
          marcas: [...estado.marcas, ...r.records],
        }))
      }

      await guardar(get().sesion, get().series)
    } catch {
      // Se queda pendiente. El siguiente intento —otra serie, volver a la
      // pantalla, cerrar la sesión— lo vuelve a intentar desde donde se quedó.
    } finally {
      set({ sincronizando: false })
    }
  },

  limpiar: async () => {
    set({
      sesion: null, series: [], marcas: [],
      descansoHasta: null, descansoTotal: 0, ultimaSerieEn: null,
    })
    await guardar(null, [])
  },
}))
