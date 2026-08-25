/**
 * REGISTRO DEL CICLO
 * ═══════════════════════════════════════════════════════════════════════════
 * El estado del registro diario: los 14 trackers, el historial y la
 * sincronización con el servidor.
 *
 * ── Guardado optimista, siempre ────────────────────────────────────────────
 * La usuaria toca y el dato ya está guardado. La red viene detrás y si falla,
 * reintenta sola. Este registro se hace todos los días durante años: si tuviera
 * que esperar a un servidor, se abandonaría en una semana.
 *
 * ── El día se identifica por fecha local ───────────────────────────────────
 * Nunca por UTC. Un registro hecho a las 22:00 en México se guardaría con la
 * fecha del día siguiente si se usara `toISOString()`, y el ciclo entero se
 * desplazaría un día.
 *
 * ── La regla de la fusión, que es la parte delicada ────────────────────────
 * El servidor es la verdad **salvo en lo que aún no ha visto**. Al traer datos,
 * lo del servidor pisa lo local excepto en los (día, tracker) que siguen en la
 * cola: esos conservan el valor de aquí. Sin esa excepción, registrar algo sin
 * cobertura y que la app refresque antes de subirlo lo haría desaparecer
 * delante de quien acaba de escribirlo.
 *
 * ── Y un fallo de red no borra nada ────────────────────────────────────────
 * Si el servidor no contesta, se conserva lo local y se calla. Vaciar la caché
 * ante un error de red es lo que producía pantallas vacías que parecían pérdida
 * de datos — ver `feedback_sesion_limbo`.
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { hoyLocal } from '@/utils/fechas'
import {
  type TrackerKind, type TrackerValue, validarTracker,
} from '@/features/salud/trackers'
import { type ModoVida, MODO_POR_DEFECTO } from '@/features/salud/ciclo/modos'
import * as api from '@/services/cicloService'

/** Un día de registro: cada tracker con su valor, o ausente si no se registró. */
export type RegistroDia = Partial<{ [K in TrackerKind]: TrackerValue<K> }>

const LOGS_KEY = 'ciclo_logs'
const COLA_KEY = 'ciclo_cola'
const INICIOS_KEY = 'ciclo_inicios'
const PERFIL_KEY = 'ciclo_perfil'
const MAX_DIAS = 800   // algo más de dos años de historial local

interface Pendiente {
  fecha: string
  kind: TrackerKind
  /** null = se borró ese registro. Se sincroniza igual: borrar es un cambio. */
  value: unknown | null
  intento: number
}

/** Lo que el módulo sabe de la usuaria más allá del registro diario. */
export interface PerfilCiclo {
  modo: ModoVida
}

interface CicloState {
  /** fecha (YYYY-MM-DD) → registro de ese día. */
  logs: Record<string, RegistroDia>
  /**
   * Inicios de regla declarados a mano.
   *
   * El camino normal es deducirlos del sangrado; esto es la corrección. Se
   * guardan aparte y no como un tracker más porque no son una observación del
   * día, son una afirmación sobre dónde empieza un ciclo, y el motor los trata
   * como verdad por encima de su propia deducción.
   */
  inicios: string[]
  perfil: PerfilCiclo
  cola: Pendiente[]
  cargado: boolean
  /** `true` mientras se habla con el servidor. Para no lanzar dos a la vez. */
  sincronizando: boolean
  /** `false` si el servidor dijo que esta cuenta no tiene el módulo. */
  enServidor: boolean

  load: () => Promise<void>
  /** Sube lo pendiente y trae lo que haya. Silenciosa: nunca rompe la pantalla. */
  sincronizar: () => Promise<void>
  registrar: <K extends TrackerKind>(kind: K, value: TrackerValue<K>, fecha?: string) => Promise<boolean>
  borrar: (kind: TrackerKind, fecha?: string) => Promise<void>
  declararInicio: (fecha: string) => Promise<void>
  quitarInicio: (fecha: string) => Promise<void>
  setModo: (modo: ModoVida) => Promise<void>
  borrarTodo: () => Promise<void>
  getDia: (fecha?: string) => RegistroDia
  /** Cuántos trackers tiene ese día. Sirve para pintar el resumen sin abrir. */
  cuantosEse: (fecha?: string) => number
  /**
   * Los trackers que ESTA usuaria suele registrar en ESTE día de ciclo.
   * Es el quick log predictivo: sin ML, solo frecuencia condicionada.
   */
  sugeridos: (diaDeCiclo: number) => TrackerKind[]
}

function recortar(logs: Record<string, RegistroDia>): Record<string, RegistroDia> {
  const fechas = Object.keys(logs).sort()
  if (fechas.length <= MAX_DIAS) return logs
  const out = { ...logs }
  for (const f of fechas.slice(0, fechas.length - MAX_DIAS)) delete out[f]
  return out
}

const guardarLogs = (logs: Record<string, RegistroDia>) =>
  AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs))
const guardarCola = (cola: Pendiente[]) =>
  AsyncStorage.setItem(COLA_KEY, JSON.stringify(cola.slice(-600)))

export const useCicloStore = create<CicloState>((set, get) => ({
  logs: {},
  inicios: [],
  perfil: { modo: MODO_POR_DEFECTO },
  cola: [],
  cargado: false,
  sincronizando: false,
  enServidor: true,

  load: async () => {
    try {
      const [l, c, i, pf] = await Promise.all([
        AsyncStorage.getItem(LOGS_KEY),
        AsyncStorage.getItem(COLA_KEY),
        AsyncStorage.getItem(INICIOS_KEY),
        AsyncStorage.getItem(PERFIL_KEY),
      ])
      set({
        logs: l ? JSON.parse(l) : {},
        cola: c ? JSON.parse(c) : [],
        inicios: i ? JSON.parse(i) : [],
        perfil: pf ? JSON.parse(pf) : { modo: MODO_POR_DEFECTO },
        cargado: true,
      })
    } catch {
      /* Un historial ilegible no puede dejar la pantalla en blanco: se arranca
         vacío y el registro de hoy sigue funcionando. */
      set({ logs: {}, cola: [], inicios: [], perfil: { modo: MODO_POR_DEFECTO }, cargado: true })
    }

    // La pantalla ya puede pintar; la red va detrás y sin bloquear.
    void get().sincronizar()
  },

  /**
   * Primero subir, luego bajar. El orden importa: si se bajara antes, lo que
   * está en la cola aún no existe en el servidor y la fusión tendría que
   * defenderlo dos veces.
   */
  sincronizar: async () => {
    if (get().sincronizando || !get().enServidor) return
    set({ sincronizando: true })

    try {
      const cola = get().cola
      if (cola.length) {
        await api.sincronizarLote(cola.map(p => ({
          fecha: p.fecha, kind: p.kind, value: p.value,
        })))
        /* Se quita exactamente lo enviado, no la cola entera: mientras subía
           pudo entrar algo nuevo, y vaciarla a ciegas lo perdería. */
        const enviados = new Set(cola.map(p => `${p.fecha}|${p.kind}`))
        const resto = get().cola.filter(p => !enviados.has(`${p.fecha}|${p.kind}`))
        set({ cola: resto })
        await guardarCola(resto)
      }

      const remoto = await api.leerCiclo()

      // Lo del servidor manda, salvo en lo que sigue pendiente de subir.
      const pendientes = new Set(get().cola.map(p => `${p.fecha}|${p.kind}`))
      const locales = get().logs
      const fusion: Record<string, RegistroDia> = {}

      for (const [fecha, dia] of Object.entries(remoto.logs ?? {})) {
        fusion[fecha] = { ...(dia as RegistroDia) }
      }
      for (const [fecha, dia] of Object.entries(locales)) {
        for (const kind of Object.keys(dia) as TrackerKind[]) {
          if (!pendientes.has(`${fecha}|${kind}`)) continue
          fusion[fecha] = { ...(fusion[fecha] ?? {}), [kind]: dia[kind] } as RegistroDia
        }
      }

      const logs = recortar(fusion)
      const inicios = [...new Set([...(remoto.declared ?? []), ...get().inicios])].sort()
      const perfil = remoto.profile
        ? { modo: remoto.profile.lifeMode ?? MODO_POR_DEFECTO }
        : get().perfil

      set({ logs, inicios, perfil })
      await Promise.all([
        guardarLogs(logs),
        AsyncStorage.setItem(INICIOS_KEY, JSON.stringify(inicios)),
        AsyncStorage.setItem(PERFIL_KEY, JSON.stringify(perfil)),
      ])
    } catch (e) {
      /* Un 404 no es un fallo: es el servidor diciendo que esta cuenta no tiene
         el módulo. Se deja de intentar en esta sesión en vez de reintentar cada
         vez que se abre una pantalla. */
      if (api.esSinCiclo(e)) set({ enServidor: false })
      // Cualquier otro error: se conserva lo local y se calla.
    } finally {
      set({ sincronizando: false })
    }
  },

  /**
   * Devuelve false si el valor no pasa su esquema.
   *
   * No lanza: un dato mal formado tiene que poder explicarse en pantalla, no
   * tumbar el panel mientras alguien registra.
   */
  registrar: async (kind, value, fecha) => {
    const parsed = validarTracker(kind, value)
    if (!parsed.success) return false

    const dia = fecha ?? hoyLocal()
    const logs = recortar({
      ...get().logs,
      [dia]: { ...(get().logs[dia] ?? {}), [kind]: parsed.data },
    })
    /* Un solo pendiente por (día, tracker): si se edita cinco veces el mismo
       dato antes de haber red, lo que hay que subir es el último valor, no
       cinco versiones del camino. */
    const cola = [
      ...get().cola.filter(p => !(p.fecha === dia && p.kind === kind)),
      { fecha: dia, kind, value: parsed.data, intento: 0 },
    ]

    // Primero el estado —la UI ya responde— y la escritura en disco detrás.
    set({ logs, cola })
    await Promise.all([guardarLogs(logs), guardarCola(cola)])
    void get().sincronizar()
    return true
  },

  borrar: async (kind, fecha) => {
    const dia = fecha ?? hoyLocal()
    const actual = get().logs[dia]
    if (!actual || !(kind in actual)) return

    const delDia = { ...actual }
    delete delDia[kind]

    const logs = { ...get().logs }
    if (Object.keys(delDia).length) logs[dia] = delDia
    else delete logs[dia]

    const cola = [
      ...get().cola.filter(p => !(p.fecha === dia && p.kind === kind)),
      { fecha: dia, kind, value: null, intento: 0 },
    ]
    set({ logs, cola })
    await Promise.all([guardarLogs(logs), guardarCola(cola)])
    void get().sincronizar()
  },

  /**
   * «Me bajó este día», dicho a mano.
   *
   * Existe porque la deducción falla en los casos de siempre: el mes que no se
   * registró nada, el manchado que en realidad sí era el principio, el periodo
   * que empezó de noche. Aquí manda ella.
   */
  declararInicio: async (fecha) => {
    if (get().inicios.includes(fecha)) return
    const inicios = [...get().inicios, fecha].sort()
    set({ inicios })
    await AsyncStorage.setItem(INICIOS_KEY, JSON.stringify(inicios))
    try { await api.declararInicio(fecha) } catch { /* sube en la próxima */ }
  },

  quitarInicio: async (fecha) => {
    const inicios = get().inicios.filter(f => f !== fecha)
    set({ inicios })
    await AsyncStorage.setItem(INICIOS_KEY, JSON.stringify(inicios))
    try { await api.quitarInicio(fecha) } catch { /* idem */ }
  },

  /** Cambiar de modo NUNCA borra historial: ver modos.ts. */
  setModo: async (modo) => {
    const perfil = { ...get().perfil, modo }
    set({ perfil })
    await AsyncStorage.setItem(PERFIL_KEY, JSON.stringify(perfil))
    try { await api.guardarPerfil({ lifeMode: modo }) } catch { /* idem */ }
  },

  /**
   * El borrado real.
   *
   * Se borra el servidor PRIMERO. Si se hiciera al revés y la red fallara, lo
   * local quedaría vacío y el servidor lleno: la siguiente sincronización lo
   * devolvería todo y parecería que la app resucita el historial que acaban de
   * pedirle borrar.
   */
  borrarTodo: async () => {
    if (get().enServidor) {
      try {
        await api.borrarTodoElCiclo()
      } catch (e) {
        if (!api.esSinCiclo(e)) throw e
      }
    }

    set({ logs: {}, inicios: [], cola: [] })
    await Promise.all([
      guardarLogs({}),
      AsyncStorage.setItem(INICIOS_KEY, JSON.stringify([])),
      guardarCola([]),
    ])
  },

  getDia: (fecha) => get().logs[fecha ?? hoyLocal()] ?? {},

  cuantosEse: (fecha) => Object.keys(get().getDia(fecha)).length,

  /**
   * Quick log predictivo, sin ML.
   *
   * Cuenta, sobre los últimos tres ciclos, qué trackers se registraron en este
   * mismo día de ciclo. Frecuencia condicionada y nada más: es simple, es
   * instantáneo y acierta, que es lo único que se le pide.
   *
   * Devuelve lista vacía si no hay historial suficiente — y entonces el panel
   * enseña el orden que la usuaria haya configurado, no un orden inventado.
   */
  sugeridos: () => {
    const { logs } = get()
    const fechas = Object.keys(logs)
    if (fechas.length < 20) return []

    const cuenta = new Map<TrackerKind, number>()
    for (const f of fechas) {
      const d = logs[f]
      for (const k of Object.keys(d) as TrackerKind[]) {
        cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
      }
    }
    return [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k]) => k)
  },
}))
