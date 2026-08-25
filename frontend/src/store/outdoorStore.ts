/**
 * AL AIRE LIBRE · CAPTURA POR GPS
 * ═══════════════════════════════
 * Lo que faltaba. Graba una salida —puntos, distancia, tiempo, ritmo, desnivel
 * y parciales por kilómetro— y sigue grabando con la pantalla bloqueada.
 *
 * ── EL RUIDO DE POSICIÓN ES EL PROBLEMA DE VERDAD ───────────────────────────
 * Un GPS de móvil no da la posición: da una estimación con un radio de error.
 * Quieto en un semáforo, sigue devolviendo puntos que bailan dentro de ese
 * radio, y si se suman todos, una carrera de 7 km marca 7,6. Eso no es un
 * detalle estético: corrompe el ritmo, los parciales y las calorías, y de ahí
 * pasa al gasto del día y a lo que ZENA recomienda comer.
 *
 * Por eso todo punto pasa por CUATRO filtros antes de contar, y cada uno tapa
 * un fallo distinto:
 *
 *   1. **Precisión.** Se descarta lo que llega con más de `PRECISION_MAX`
 *      metros de incertidumbre. En un túnel o entre edificios altos el GPS
 *      admite que no sabe dónde está; hacerle caso es inventar recorrido.
 *
 *   2. **Salto imposible.** Si dos puntos seguidos implican ir a más de
 *      `VELOCIDAD_MAX`, no te has teletransportado: es un rebote. Se tira.
 *
 *   3. **Movimiento mínimo.** Por debajo de `MOVIMIENTO_MIN` metros no se
 *      suma. Es el filtro que mata el baile del semáforo, y el que más
 *      distancia falsa evita.
 *
 *   4. **Desnivel con umbral.** La altura por GPS es aún peor que la posición:
 *      oscila metros estando quieto. Solo se acumula subida por encima de
 *      `DESNIVEL_MIN`, o una salida llana acabaría marcando 200 m de repecho.
 *
 * ── Lo que NO hace todavía, y se dice ───────────────────────────────────────
 * · El pulso no se graba: hace falta Apple Health o una banda. La serie queda
 *   vacía y las pantallas lo dicen en vez de estimar un número creíble.
 * · La altura sale del GPS, no del barómetro. `expo-sensors` da mejor dato y
 *   es la siguiente mejora, pero mientras tanto el desnivel es aproximado.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import type { Deporte } from '@/components/outdoor/Iconos'
import { alTerminarEntrenamiento } from '@/features/salud/autoHabitos'

export const TAREA_UBICACION = 'zencrus-outdoor-ubicacion'

// ── Umbrales del filtrado ────────────────────────────────────────────────────
const PRECISION_MAX = 25      // metros de incertidumbre admitidos
const VELOCIDAD_MAX = 30      // m/s ≈ 108 km/h: por encima es un rebote
const MOVIMIENTO_MIN = 3      // metros; por debajo, es el baile del semáforo
const DESNIVEL_MIN = 1.5      // metros; por debajo, es ruido del altímetro
const PARADO_SEGUNDOS = 12    // sin avanzar → pausa automática

export interface Punto {
  lat: number
  lon: number
  alt: number | null
  t: number          // epoch ms
  precision: number | null
}

export interface Parcial {
  km: number
  segundos: number
  desnivel: number
}

export interface Actividad {
  id: string
  deporte: Deporte
  inicio: number
  fin: number | null
  /** Segundos EN MOVIMIENTO. No incluye las pausas. */
  segundos: number
  metros: number
  desnivelPositivo: number
  desnivelNegativo: number
  puntos: Punto[]
  parciales: Parcial[]
  /** Vacía mientras no haya pulsómetro. No se rellena con estimaciones. */
  pulso: number[]
  sensacion: number | null
  nota: string | null
  /** Id de la pieza de material usada. Los km de una zapatilla se suman desde aquí. */
  material: string | null
}

type Estado = 'inactiva' | 'grabando' | 'pausada'

interface OutdoorState {
  estado: Estado
  deporte: Deporte
  actual: Actividad | null
  historial: Actividad[]
  /** Último error de permisos o de arranque, para que la pantalla lo diga. */
  problema: string | null

  permisos: () => Promise<{ primerPlano: boolean; segundoPlano: boolean }>
  empezar: (deporte: Deporte, material?: string | null) => Promise<boolean>
  pausar: () => void
  reanudar: () => void
  terminar: () => Actividad | null
  descartar: () => void
  anotar: (id: string, sensacion: number | null, nota: string | null) => void
  /** La llama la tarea de segundo plano. No se usa desde la interfaz. */
  ingerir: (crudos: Location.LocationObject[]) => void

  resumenSemana: () => { metros: number; segundos: number; actividades: number; desnivel: number }
  records: () => Record<string, { segundos: number; fecha: number } | null>
}

// ── Geometría ────────────────────────────────────────────────────────────────

/** Haversine. Metros entre dos coordenadas. */
export function metrosEntre(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Segundos por kilómetro. Devuelve null si aún no hay distancia que dividir. */
export function ritmo(metros: number, segundos: number): number | null {
  if (metros < 50) return null
  return (segundos / metros) * 1000
}

export function mmss(seg: number) {
  const s = Math.max(0, Math.round(seg))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function hhmmss(seg: number) {
  const s = Math.max(0, Math.round(seg))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

// ── El store ─────────────────────────────────────────────────────────────────

export const useOutdoorStore = create<OutdoorState>()(
  persist(
    (set, get) => ({
      estado: 'inactiva',
      deporte: 'correr',
      actual: null,
      historial: [],
      problema: null,

      permisos: async () => {
        const pf = await Location.requestForegroundPermissionsAsync()
        if (pf.status !== 'granted') return { primerPlano: false, segundoPlano: false }
        // El de segundo plano se pide APARTE y puede negarse sin que se caiga
        // la grabación: sin él se graba con la app abierta, y hay que decirlo.
        let fondo = false
        try {
          const pb = await Location.requestBackgroundPermissionsAsync()
          fondo = pb.status === 'granted'
        } catch { fondo = false }
        return { primerPlano: true, segundoPlano: fondo }
      },

      empezar: async (deporte, material = null) => {
        const { primerPlano, segundoPlano } = await get().permisos()
        if (!primerPlano) {
          set({ problema: 'Sin permiso de ubicación no puedo grabar el recorrido.' })
          return false
        }
        try {
          const yaVa = await TaskManager.isTaskRegisteredAsync(TAREA_UBICACION)
          if (yaVa) await Location.stopLocationUpdatesAsync(TAREA_UBICACION)

          await Location.startLocationUpdatesAsync(TAREA_UBICACION, {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 0,
            // Sin esto, iOS deja de mandar puntos al bloquear la pantalla y
            // vuelves a casa sin la segunda mitad de tu carrera.
            showsBackgroundLocationIndicator: segundoPlano,
            pausesUpdatesAutomatically: false,
            activityType: deporte === 'bici'
              ? Location.ActivityType.AutomotiveNavigation
              : Location.ActivityType.Fitness,
          })
        } catch (e) {
          set({ problema: `No pude arrancar el GPS: ${String(e)}` })
          return false
        }

        set({
          estado: 'grabando',
          deporte,
          problema: segundoPlano ? null : 'Sin permiso de segundo plano: si bloqueas la pantalla, dejaré de grabar.',
          actual: {
            id: `${Date.now()}`,
            deporte,
            inicio: Date.now(),
            fin: null,
            segundos: 0,
            metros: 0,
            desnivelPositivo: 0,
            desnivelNegativo: 0,
            puntos: [],
            parciales: [],
            pulso: [],
            sensacion: null,
            nota: null,
            material,
          },
        })
        return true
      },

      pausar: () => { if (get().estado === 'grabando') set({ estado: 'pausada' }) },
      reanudar: () => { if (get().estado === 'pausada') set({ estado: 'grabando' }) },

      terminar: () => {
        const { actual, historial } = get()
        Location.stopLocationUpdatesAsync(TAREA_UBICACION).catch(() => {})
        if (!actual) { set({ estado: 'inactiva' }); return null }
        const cerrada: Actividad = { ...actual, fin: Date.now() }
        set({ estado: 'inactiva', actual: null, historial: [cerrada, ...historial] })
        // Correr TAMBIÉN es entrenar: quien solo sale a correr nunca vería ese
        // hábito marcado si esto colgara solo del gimnasio.
        alTerminarEntrenamiento()
        return cerrada
      },

      descartar: () => {
        Location.stopLocationUpdatesAsync(TAREA_UBICACION).catch(() => {})
        set({ estado: 'inactiva', actual: null })
      },

      anotar: (id, sensacion, nota) => set({
        historial: get().historial.map(a => (a.id === id ? { ...a, sensacion, nota } : a)),
      }),

      /**
       * Aquí entra todo lo que manda el GPS, y aquí se decide qué cuenta.
       * Es la función más delicada del módulo: cada `return` es un punto que
       * NO suma, y cada uno tapa una forma distinta de inflar la distancia.
       */
      ingerir: (crudos) => {
        const st = get()
        if (st.estado !== 'grabando' || !st.actual) return

        let act = st.actual
        for (const c of crudos) {
          const p: Punto = {
            lat: c.coords.latitude,
            lon: c.coords.longitude,
            alt: c.coords.altitude ?? null,
            t: c.timestamp,
            precision: c.coords.accuracy ?? null,
          }

          // 1. El GPS admite que no sabe dónde está.
          if (p.precision != null && p.precision > PRECISION_MAX) continue

          const ant = act.puntos[act.puntos.length - 1]
          if (!ant) { act = { ...act, puntos: [p] }; continue }

          const dt = Math.max(0.001, (p.t - ant.t) / 1000)
          const d = metrosEntre(ant, p)

          // 2. Nadie corre a 108 km/h: es un rebote de la señal.
          if (d / dt > VELOCIDAD_MAX) continue

          // 3. El baile del semáforo. Se guarda el punto pero no suma distancia.
          if (d < MOVIMIENTO_MIN) {
            act = { ...act, segundos: act.segundos + dt, puntos: [...act.puntos, p] }
            continue
          }

          // 4. Desnivel solo por encima del ruido del altímetro.
          let subida = act.desnivelPositivo, bajada = act.desnivelNegativo
          if (p.alt != null && ant.alt != null) {
            const dh = p.alt - ant.alt
            if (dh > DESNIVEL_MIN) subida += dh
            else if (dh < -DESNIVEL_MIN) bajada += -dh
          }

          const metros = act.metros + d
          const segundos = act.segundos + dt

          // Un parcial cada kilómetro completo.
          const parciales = [...act.parciales]
          const kmAntes = Math.floor(act.metros / 1000)
          const kmAhora = Math.floor(metros / 1000)
          if (kmAhora > kmAntes) {
            const previos = parciales.reduce((a, x) => a + x.segundos, 0)
            const previoDesnivel = parciales.reduce((a, x) => a + x.desnivel, 0)
            parciales.push({
              km: kmAhora,
              segundos: segundos - previos,
              desnivel: Math.round(subida - previoDesnivel),
            })
          }

          act = {
            ...act,
            metros, segundos, parciales,
            desnivelPositivo: subida,
            desnivelNegativo: bajada,
            puntos: [...act.puntos, p],
          }
        }

        // Pausa automática: llevas un rato sin avanzar de verdad.
        const ult = act.puntos[act.puntos.length - 1]
        const penul = act.puntos.length > 1 ? act.puntos[0] : null
        const quieto =
          ult && penul != null &&
          act.puntos.slice(-6).every((q, i, arr) => i === 0 || metrosEntre(arr[i - 1], q) < MOVIMIENTO_MIN) &&
          act.puntos.length > 6 &&
          (ult.t - act.puntos[act.puntos.length - 6].t) / 1000 > PARADO_SEGUNDOS

        set({ actual: act, ...(quieto ? { estado: 'pausada' as Estado } : null) })
      },

      resumenSemana: () => {
        const hace7 = Date.now() - 7 * 24 * 3600 * 1000
        const dentro = get().historial.filter(a => a.inicio >= hace7)
        return {
          metros: dentro.reduce((s, a) => s + a.metros, 0),
          segundos: dentro.reduce((s, a) => s + a.segundos, 0),
          actividades: dentro.length,
          desnivel: Math.round(dentro.reduce((s, a) => s + a.desnivelPositivo, 0)),
        }
      },

      /**
       * Mejor marca por distancia. Solo cuenta una actividad si de verdad la
       * cubrió: no se extrapola «tu 10 K» desde una salida de 6 km.
       */
      records: () => {
        const metas = { '1 km': 1000, '5 km': 5000, '10 km': 10000, 'Media maratón': 21097, Maratón: 42195 }
        const salida: Record<string, { segundos: number; fecha: number } | null> = {}
        for (const [nombre, m] of Object.entries(metas)) {
          let mejor: { segundos: number; fecha: number } | null = null
          for (const a of get().historial) {
            if (a.metros < m) continue
            // Regla de tres sobre el ritmo medio de esa actividad. Es una
            // aproximación y no un cronómetro: el mejor tramo pide recorrer
            // los puntos con una ventana deslizante, que llegará después.
            const seg = (a.segundos / a.metros) * m
            if (!mejor || seg < mejor.segundos) mejor = { segundos: seg, fecha: a.inicio }
          }
          salida[nombre] = mejor
        }
        return salida
      },
    }),
    {
      name: 'zencrus-outdoor',
      storage: createJSONStorage(() => AsyncStorage),
      // La actividad en curso NO se persiste: si la app muere a mitad de una
      // salida, es más honesto perder la sesión que resucitar una a medias con
      // un hueco de tiempo sin puntos que falsearía el ritmo.
      partialize: (s) => ({ historial: s.historial, deporte: s.deporte }) as OutdoorState,
    }
  )
)

/**
 * LA TAREA DE SEGUNDO PLANO
 * ─────────────────────────
 * Se define en el ámbito del módulo, no dentro de un componente: iOS puede
 * despertar la app con la interfaz sin montar, y si la tarea se registrara en
 * un `useEffect` no existiría en ese momento y se perderían los puntos.
 */
// `defineTask` exige un ejecutor que devuelva promesa, así que va `async`
// aunque por dentro no espere a nada.
TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
  TAREA_UBICACION,
  async ({ data, error }) => {
    if (error) return
    if (!data?.locations?.length) return
    useOutdoorStore.getState().ingerir(data.locations)
  }
)
