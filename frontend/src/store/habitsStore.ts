/**
 * HÁBITOS
 * ───────
 * La lista de hábitos y el cumplimiento de cada día, ahora en
 * `habit_definitions` y `habit_logs`. AsyncStorage se queda como caché para que
 * la rejilla de la semana aparezca al instante y siga estando sin señal.
 *
 * ── Los cinco de fábrica los siembra el servidor ────────────────────────────
 * `DEFAULT_HABITS` sigue aquí, pero ya solo como lo que se pinta mientras llega
 * la primera respuesta. Las llaves son las mismas —`sleep`, `water`…— así que
 * cuando el servidor contesta, lo que había en pantalla y lo que llega son el
 * mismo hábito y no hay parpadeo ni duplicados.
 *
 * ── Borrar es desactivar ────────────────────────────────────────────────────
 * Desaparece de la lista igual que antes, pero la fila se queda: si se borrara
 * de verdad, el usuario tendría cero definiciones y la siembra del servidor le
 * devolvería los cinco de fábrica en la siguiente lectura.
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { sincronizarHabito, traerHabitos } from './trackingSync'
import { crearHabito, borrarHabito, actualizarHabito } from '@/services/trackingService'
import { haceDias, hoyLocal } from '@/utils/fechas'

/** Los siete días. Bit 0 = lunes … bit 6 = domingo. */
export const TODOS_LOS_DIAS = 127

export type Momento = 'manana' | 'tarde' | 'noche'
/** `evitar` da la vuelta al hábito: cumplir es NO haberlo hecho. */
export type TipoHabito = 'hacer' | 'evitar'

export interface Habit {
  id: string
  label: string
  icon: string // nombre de Ionicon
  momento: Momento
  hora: string | null          // «07:00»; null si no tiene hora fijada
  tipo: TipoHabito
  metaSegundos: number | null  // null = sin cronómetro
  alarma: boolean              // suena a la hora de `hora`
  alarmaDias: number           // máscara: bit 0 = lunes … bit 6 = domingo
  alarmaFin: boolean           // suena a la hora de `horaFin` (despertar)
  alarmaFinDias: number
  alarmaSonido: string | null
  alarmaPosponer: boolean
  horaFin: string | null       // horario de SUEÑO: `hora` acuesta, esta despierta
}

export type DayLog = Record<string, boolean> // habitId -> hecho
export type DaySecs = Record<string, number> // habitId -> segundos cronometrados

const DEFAULT_HABITS: Habit[] = [
  { id: 'sleep',   label: 'Dormir 7h o más',          icon: 'moon',       momento: 'noche',  hora: '23:00', tipo: 'hacer', metaSegundos: null, alarma: false, alarmaDias: 127, alarmaFin: false, alarmaFinDias: 127, alarmaSonido: null, alarmaPosponer: true, horaFin: '06:00' },
  { id: 'water',   label: '8 vasos de agua',          icon: 'water',      momento: 'manana', hora: null,    tipo: 'hacer', metaSegundos: null, alarma: false, alarmaDias: 127, alarmaFin: false, alarmaFinDias: 127, alarmaSonido: null, alarmaPosponer: true, horaFin: null },
  { id: 'workout', label: 'Entrenar',                 icon: 'barbell',    momento: 'tarde',  hora: null,    tipo: 'hacer', metaSegundos: null, alarma: false, alarmaDias: 127, alarmaFin: false, alarmaFinDias: 127, alarmaSonido: null, alarmaPosponer: true, horaFin: null },
  { id: 'protein', label: 'Proteína objetivo',        icon: 'restaurant', momento: 'manana', hora: null,    tipo: 'hacer', metaSegundos: null, alarma: false, alarmaDias: 127, alarmaFin: false, alarmaFinDias: 127, alarmaSonido: null, alarmaPosponer: true, horaFin: null },
  { id: 'mind',    label: 'Respirar / meditar 5 min', icon: 'leaf',       momento: 'manana', hora: '07:00', tipo: 'hacer', metaSegundos: 300, alarma: false, alarmaDias: 127, alarmaFin: false, alarmaFinDias: 127, alarmaSonido: null, alarmaPosponer: true, horaFin: null },
]

const HABITS_KEY = 'habits_list'
const LOGS_KEY = 'habits_logs'
const SECS_KEY = 'habits_segundos'
const MAX_LOG_DAYS = 120

/** Lo que se puede fijar al crear un hábito además del nombre y el icono. */
export interface HabitoExtra {
  momento?: Momento
  hora?: string | null
  tipo?: TipoHabito
  metaSegundos?: number | null
  alarma?: boolean
  alarmaDias?: number
  alarmaFin?: boolean
  alarmaFinDias?: number
  alarmaSonido?: string | null
  alarmaPosponer?: boolean
  horaFin?: string | null
}

interface HabitsState {
  habits: Habit[]
  logs: Record<string, DayLog> // date (YYYY-MM-DD) -> DayLog
  segundos: Record<string, DaySecs> // date -> habitId -> segundos

  load: () => Promise<void>
  addHabit: (label: string, icon: string, extra?: HabitoExtra) => Promise<void>
  /** Cambia lo que sea de un hábito ya creado. La llave nunca se toca. */
  editarHabito: (id: string, cambios: Partial<Omit<Habit, 'id'>>) => Promise<void>
  removeHabit: (id: string) => Promise<void>
  toggleToday: (habitId: string) => Promise<void>
  /**
   * Deja un hábito de hoy como cumplido. NUNCA lo desmarca.
   *
   * Es lo que usa el marcado automático: si terminas dos entrenamientos, o
   * llegas a la proteína y luego comes más, la comprobación se repite muchas
   * veces al día y no puede convertirse en un interruptor. Y si lo desmarcaste
   * a mano, tampoco puede volver a marcarlo… salvo que el hecho vuelva a
   * ocurrir, que es justo lo que significa.
   */
  asegurarHecho: (habitId: string) => Promise<boolean>
  /** Fija el total cronometrado de hoy. Al llegar a la meta marca el hábito. */
  fijarSegundos: (habitId: string, total: number) => Promise<void>
  getTodayStatus: () => DayLog
  getStreakForHabit: (habitId: string) => number
  getWeekGrid: () => { date: string; log: DayLog }[]
}

function today() { return hoyLocal() }

/**
 * Rellena los campos que no existían antes de esta versión. La caché de una
 * instalación anterior guarda hábitos sin `momento` ni `tipo`, y sin esto la
 * pantalla los agruparía bajo `undefined` y las secciones saldrían vacías.
 */
function completar(h: Partial<Habit> & { id: string; label: string; icon: string }): Habit {
  return {
    id: h.id,
    label: h.label,
    icon: h.icon,
    momento: h.momento ?? 'manana',
    hora: h.hora ?? null,
    tipo: h.tipo ?? 'hacer',
    metaSegundos: h.metaSegundos ?? null,
    alarma: h.alarma ?? false,
    alarmaDias: h.alarmaDias ?? TODOS_LOS_DIAS,
    alarmaFin: h.alarmaFin ?? false,
    alarmaFinDias: h.alarmaFinDias ?? TODOS_LOS_DIAS,
    alarmaSonido: h.alarmaSonido ?? null,
    alarmaPosponer: h.alarmaPosponer ?? true,
    horaFin: h.horaFin ?? null,
  }
}

function trimLogs(logs: Record<string, DayLog>): Record<string, DayLog> {
  const keys = Object.keys(logs).sort()
  if (keys.length <= MAX_LOG_DAYS) return logs
  const trimmed = { ...logs }
  for (const k of keys.slice(0, keys.length - MAX_LOG_DAYS)) delete trimmed[k]
  return trimmed
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: DEFAULT_HABITS,
  logs: {},
  segundos: {},

  /**
   * Primero la caché, para que la pantalla no espere a la red; después el
   * servidor, que pisa lo anterior. Sin señal se queda lo de la caché, que es
   * exactamente lo que había antes de todo esto.
   */
  load: async () => {
    try {
      const [habitsRaw, logsRaw, secsRaw] = await Promise.all([
        AsyncStorage.getItem(HABITS_KEY),
        AsyncStorage.getItem(LOGS_KEY),
        AsyncStorage.getItem(SECS_KEY),
      ])
      set({
        // Los hábitos guardados antes de esta versión no traen momento ni tipo:
        // se completan al vuelo para que la pantalla no reciba `undefined`.
        habits: habitsRaw ? (JSON.parse(habitsRaw) as Habit[]).map(completar) : DEFAULT_HABITS,
        logs: logsRaw ? JSON.parse(logsRaw) : {},
        segundos: secsRaw ? JSON.parse(secsRaw) : {},
      })
    } catch {}

    const delServidor = await traerHabitos(haceDias(MAX_LOG_DAYS), today())
    if (!delServidor) return

    // Los desactivados no se pintan. Siguen existiendo en la tabla para que su
    // histórico de cumplimiento tenga nombre.
    const habits = delServidor.habits
      .filter(h => h.activo)
      .map(h => completar({
        id: h.habitKey, label: h.label, icon: h.icon,
        momento: h.momento, hora: h.hora, tipo: h.tipo, metaSegundos: h.metaSegundos,
      }))

    const segundos = delServidor.segundos ?? {}
    set({ habits, logs: delServidor.logs, segundos })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(delServidor.logs))
    await AsyncStorage.setItem(SECS_KEY, JSON.stringify(segundos))
  },

  addHabit: async (label, icon, extra = {}) => {
    const habit: Habit = completar({ id: `custom_${Date.now()}`, label, icon, ...extra })
    const habits = [...get().habits, habit]
    set({ habits })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
    // La llave la pone la app: se puede marcar como cumplido antes de que el
    // servidor conteste.
    void crearHabito(habit.id, label, icon, {
      orden: habits.length,
      momento: habit.momento,
      hora: habit.hora,
      tipo: habit.tipo,
      metaSegundos: habit.metaSegundos,
    }).catch(() => {})
  },

  editarHabito: async (id, cambios) => {
    const habits = get().habits.map(h => (h.id === id ? completar({ ...h, ...cambios }) : h))
    set({ habits })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
    const h = habits.find(x => x.id === id)
    if (!h) return
    // Se manda TODO lo editable y no solo lo que cambió: el servidor distingue
    // «no lo mandes» de «ponlo a null», y mandar el estado entero evita tener
    // que acertar cuál de los dos significaba cada hueco.
    void actualizarHabito(id, {
      label: h.label, icon: h.icon, momento: h.momento, hora: h.hora,
      tipo: h.tipo, metaSegundos: h.metaSegundos,
      alarma: h.alarma, alarmaDias: h.alarmaDias,
      alarmaFin: h.alarmaFin, alarmaFinDias: h.alarmaFinDias,
      alarmaSonido: h.alarmaSonido,
      alarmaPosponer: h.alarmaPosponer, horaFin: h.horaFin,
    }).catch(() => {})
  },

  removeHabit: async (id) => {
    const habits = get().habits.filter(h => h.id !== id)
    set({ habits })
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits))
    void borrarHabito(id).catch(() => {})
  },

  toggleToday: async (habitId) => {
    const date = today()
    const logs = trimLogs({ ...get().logs })
    const day = { ...(logs[date] ?? {}) }
    day[habitId] = !day[habitId]
    logs[date] = day
    set({ logs })
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs))
    // Optimista, con caída a la cola: marcar un hábito en el gimnasio sin
    // cobertura tiene que responder igual de rápido que con ella.
    void sincronizarHabito(habitId, date, day[habitId], get().segundos[date]?.[habitId])
  },

  /**
   * Guarda el total cronometrado de hoy. Se fija el total, no se suma: así da
   * igual cuántas veces la llame el cronómetro —al pausar, al salir de la
   * pantalla— porque repetir la llamada no infla la cuenta.
   */
  fijarSegundos: async (habitId, total) => {
    const date = today()
    const meta = get().habits.find(h => h.id === habitId)?.metaSegundos ?? null
    const segs = { ...get().segundos }
    const dia = { ...(segs[date] ?? {}) }
    dia[habitId] = Math.max(0, Math.floor(total))
    segs[date] = dia

    // Al llegar a la meta se marca solo: haber cronometrado los 5 minutos ES
    // haberlo cumplido, y obligar a un toque más sería pedir lo mismo dos veces.
    const cumple = meta != null && dia[habitId] >= meta
    const logs = trimLogs({ ...get().logs })
    const log = { ...(logs[date] ?? {}) }
    if (cumple && !log[habitId]) log[habitId] = true
    logs[date] = log

    set({ segundos: segs, logs })
    await AsyncStorage.setItem(SECS_KEY, JSON.stringify(segs))
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs))
    void sincronizarHabito(habitId, date, !!log[habitId], dia[habitId])
  },

  asegurarHecho: async (habitId) => {
    const date = today()
    if (get().logs[date]?.[habitId]) return false
    // Solo se marca lo que el usuario tiene de verdad: si borró el hábito, la
    // lista cargada no lo trae y aquí no se inventa nada.
    if (!get().habits.some(h => h.id === habitId)) return false

    const logs = trimLogs({ ...get().logs })
    logs[date] = { ...(logs[date] ?? {}), [habitId]: true }
    set({ logs })
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logs))
    void sincronizarHabito(habitId, date, true, get().segundos[date]?.[habitId])
    return true
  },

  getTodayStatus: () => get().logs[today()] ?? {},

  getStreakForHabit: (habitId) => {
    const { logs } = get()
    let streak = 0
    for (let i = 0; i < MAX_LOG_DAYS; i++) {
      if (logs[haceDias(i)]?.[habitId]) streak++
      else break
    }
    return streak
  },

  getWeekGrid: () => {
    const { logs } = get()
    return Array.from({ length: 7 }, (_, i) => {
      const key = haceDias(6 - i)
      return { date: key, log: logs[key] ?? {} }
    })
  },
}))
