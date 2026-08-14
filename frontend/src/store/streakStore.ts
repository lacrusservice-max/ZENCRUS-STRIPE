/**
 * RACHAS
 * ──────
 * La actividad de cada día vive en `activity_days`. Las rachas ya NO se
 * guardan: las calcula el servidor a partir de esa serie y este store las
 * muestra.
 *
 * ── Por qué se dejó de guardar el contador ──────────────────────────────────
 * Porque había dos: el número en AsyncStorage y la historia de la que sale ese
 * número. Discrepaban —basta un cambio de huso horario o una instalación nueva—
 * y cuando discrepaban ganaba el que estaba mal, casi siempre el guardado. Con
 * el cálculo en el servidor hay una sola respuesta, y es la misma que lee ZENA
 * cuando le preguntan cuántos días lleva alguien.
 *
 * ── El protector sigue decidiéndose aquí ────────────────────────────────────
 * Los protectores son de `achievementStore`, que no es de esta migración. Así
 * que la app sigue decidiendo si gasta uno; lo único que cambia es que, cuando
 * lo gasta, el día se marca como protegido en el servidor y no en un array
 * suelto del teléfono.
 *
 * ── Sin red no se inventan números ──────────────────────────────────────────
 * Al marcar actividad sin señal el contador sube igual —el usuario acaba de
 * hacer algo y merece verlo— pero es una estimación optimista que la primera
 * respuesta del servidor corrige. Nunca se guarda como verdad.
 */

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAchievementStore } from './achievementStore'
import { evaluateStreakContinuity } from '@/utils/streakLogic'
import { sincronizarActividad, traerActividad } from './trackingSync'
import type { DiaServidor } from '@/services/trackingService'
import { haceDias, hoyLocal } from '@/utils/fechas'

export interface DailyActivity {
  date: string
  loggedFood: boolean
  loggedWorkout: boolean
  checkInDone: boolean
  drank8Glasses: boolean
}

export type DayStatus = 'completed' | 'protected' | 'missed' | 'future' | 'empty'

interface StreakState {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  weekActivity: DailyActivity[]   // últimos 7 días
  totalDaysActive: number
  protectedDates: string[]        // días salvados con un protector de racha
  justProtected: boolean          // true justo después de que un protector salvó la racha (para avisar, una vez)

  load: () => Promise<void>
  markActivity: (date: string, updates: Partial<Omit<DailyActivity, 'date'>>) => Promise<void>
  isActive: (date: string) => boolean
  getTodayActivity: () => DailyActivity
  getStreakMessage: () => string
  acknowledgeProtection: () => void
  /** Historial para el calendario — más días que weekActivity (por defecto 84 = 12 semanas). */
  getHistory: (days?: number) => Promise<{ date: string; status: DayStatus }[]>
}

function todayKey() { return hoyLocal() }

function isDayComplete(d: DailyActivity): boolean {
  return d.loggedFood || d.loggedWorkout || d.checkInDone
}

const emptyDay = (date: string): DailyActivity => ({
  date, loggedFood: false, loggedWorkout: false, checkInDone: false, drank8Glasses: false,
})

/** El servidor llama `drankWater` a lo que aquí siempre fue `drank8Glasses`. */
const aDia = (s: DiaServidor): DailyActivity => ({
  date: s.date,
  loggedFood: s.loggedFood,
  loggedWorkout: s.loggedWorkout,
  checkInDone: s.checkInDone,
  drank8Glasses: s.drankWater,
})

const STREAK_MESSAGES = [
  { min: 0,   msg: 'Hoy es el primer día de tu mejor versión.' },
  { min: 1,   msg: '¡1 día! Todo viaje empieza con un paso.' },
  { min: 3,   msg: '3 días seguidos. La constancia está naciendo.' },
  { min: 7,   msg: '¡1 semana! Los hábitos se forman en 21 días.' },
  { min: 14,  msg: '2 semanas de disciplina pura. Sigue.' },
  { min: 21,  msg: '21 días — el hábito ya es tuyo. Imparable.' },
  { min: 30,  msg: '1 mes completo. Eres de los pocos que llegan aquí.' },
  { min: 60,  msg: '2 meses. Esto ya es tu estilo de vida.' },
  { min: 90,  msg: '90 días. Transformación REAL. Élite total.' },
  { min: 180, msg: '6 meses. Leyenda. ZENCRUS te pertenece.' },
  { min: 365, msg: '1 AÑO. Esto es lo que separa a los mejores del mundo.' },
]

export const useStreakStore = create<StreakState>((set, get) => ({
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  weekActivity: [],
  totalDaysActive: 0,
  protectedDates: [],
  justProtected: false,

  load: async () => {
    const hoy = todayKey()

    // Lo local primero, para que la pantalla tenga algo que pintar de
    // inmediato: la caché de cada día se sigue escribiendo en `markActivity`.
    try {
      const semana: DailyActivity[] = []
      for (let i = 6; i >= 0; i--) {
        const key = haceDias(i)
        const raw = await AsyncStorage.getItem(`activity_${key}`)
        semana.push(raw ? JSON.parse(raw) : emptyDay(key))
      }
      const protectedRaw = await AsyncStorage.getItem('streak_protected_dates')
      set({ weekActivity: semana, protectedDates: protectedRaw ? JSON.parse(protectedRaw) : [] })
    } catch {}

    let datos = await traerActividad(haceDias(83), hoy, hoy)
    if (!datos) return    // sin red: se queda lo de la caché

    // ── El protector ──────────────────────────────────────────────────────
    // Se decide con el último día activo QUE DICE EL SERVIDOR, no con el que
    // hubiera guardado el teléfono: un móvil nuevo no sabe nada y rompería una
    // racha que está viva.
    const escudos = useAchievementStore.getState().streakShields
    const decision = evaluateStreakContinuity(datos.streak.lastActiveDate, hoy, escudos)

    if (decision.action === 'protect' && useAchievementStore.getState().useStreakShield()) {
      const salvados = [...get().protectedDates, decision.missedDate]
      set({ protectedDates: salvados, justProtected: true })
      await AsyncStorage.setItem('streak_protected_dates', JSON.stringify(salvados))
      // Se marca en el servidor y se vuelve a preguntar: la racha la calcula él
      // y ahora el día roto ya no lo está.
      if (await sincronizarActividad(decision.missedDate, { protegido: true })) {
        datos = (await traerActividad(haceDias(83), hoy, hoy)) ?? datos
      }
    }

    const porFecha = new Map(datos.days.map(d => [d.date, d]))

    set({
      currentStreak: datos.streak.current,
      longestStreak: datos.streak.longest,
      totalDaysActive: datos.streak.totalActive,
      lastActiveDate: datos.streak.lastActiveDate,
      weekActivity: Array.from({ length: 7 }, (_, i) => {
        const key = haceDias(6 - i)
        const dia = porFecha.get(key)
        return dia ? aDia(dia) : emptyDay(key)
      }),
      protectedDates: datos.days.filter(d => d.protegido).map(d => d.date),
    })
  },

  acknowledgeProtection: () => set({ justProtected: false }),

  getHistory: async (days = 84) => {
    const hoy = todayKey()
    const datos = await traerActividad(haceDias(days - 1), hoy, hoy)

    if (datos) {
      const porFecha = new Map(datos.days.map(d => [d.date, d]))
      return Array.from({ length: days }, (_, i) => {
        const date = haceDias(days - 1 - i)
        const dia = porFecha.get(date)
        if (dia?.protegido) return { date, status: 'protected' as DayStatus }
        if (dia && isDayComplete(aDia(dia))) return { date, status: 'completed' as DayStatus }
        // Hoy todavía puede completarse: no es un día perdido.
        return { date, status: (date === hoy ? 'empty' : 'missed') as DayStatus }
      })
    }

    // Sin red, el calendario se dibuja con lo que quedó en el teléfono.
    const protegidos = new Set(get().protectedDates)
    const out: { date: string; status: DayStatus }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const key = haceDias(i)
      if (protegidos.has(key)) {
        out.push({ date: key, status: 'protected' })
        continue
      }
      const raw = await AsyncStorage.getItem(`activity_${key}`)
      const activity: DailyActivity | null = raw ? JSON.parse(raw) : null
      if (activity && isDayComplete(activity)) out.push({ date: key, status: 'completed' })
      else out.push({ date: key, status: i === 0 ? 'empty' : 'missed' })
    }
    return out
  },

  markActivity: async (date, updates) => {
    const stored = await AsyncStorage.getItem(`activity_${date}`)
    const current: DailyActivity = stored ? JSON.parse(stored) : emptyDay(date)
    const updated = { ...current, ...updates }
    await AsyncStorage.setItem(`activity_${date}`, JSON.stringify(updated))

    const week = get().weekActivity.map(d => d.date === date ? updated : d)
    set({ weekActivity: week })

    // Solo viajan las banderas que cambian: el servidor actualiza esas columnas
    // y no toca las demás, igual que este `{ ...current, ...updates }`.
    const llegó = await sincronizarActividad(date, {
      loggedFood: updates.loggedFood,
      loggedWorkout: updates.loggedWorkout,
      checkInDone: updates.checkInDone,
      drankWater: updates.drank8Glasses,
    })

    const seCompletóHoy =
      date === todayKey() && !isDayComplete(current) && isDayComplete(updated)

    if (llegó) {
      // El servidor ya tiene el día: que él diga cuánto vale la racha.
      const hoy = todayKey()
      const datos = await traerActividad(haceDias(83), hoy, hoy)
      if (datos) {
        set({
          currentStreak: datos.streak.current,
          longestStreak: datos.streak.longest,
          totalDaysActive: datos.streak.totalActive,
          lastActiveDate: datos.streak.lastActiveDate,
        })
        return
      }
    }

    // No llegó: se sube el contador de forma optimista para que el usuario vea
    // que su esfuerzo cuenta. No se guarda en ningún sitio — la próxima lectura
    // con red lo sustituye por el número de verdad.
    if (seCompletóHoy) {
      const { currentStreak, longestStreak, totalDaysActive, lastActiveDate } = get()
      const nueva = lastActiveDate === todayKey() ? currentStreak : currentStreak + 1
      set({
        currentStreak: nueva,
        longestStreak: Math.max(longestStreak, nueva),
        totalDaysActive: totalDaysActive + 1,
        lastActiveDate: todayKey(),
      })
    }
  },

  isActive: (date) => {
    const day = get().weekActivity.find(d => d.date === date)
    return day ? isDayComplete(day) : false
  },

  getTodayActivity: () => {
    const today = todayKey()
    return get().weekActivity.find(d => d.date === today) ?? emptyDay(today)
  },

  getStreakMessage: () => {
    const s = get().currentStreak
    const match = [...STREAK_MESSAGES].reverse().find(m => s >= m.min)
    return match?.msg ?? STREAK_MESSAGES[0].msg
  },
}))
