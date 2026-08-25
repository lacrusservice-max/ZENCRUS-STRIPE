/**
 * AL AIRE LIBRE · MATERIAL
 * ════════════════════════
 * Zapatillas y bicis, con los kilómetros que llevan encima.
 *
 * ── LOS KILÓMETROS NO SE GUARDAN: SE CALCULAN ───────────────────────────────
 * La tentación es llevar un contador `km` dentro de cada pieza y sumarle cada
 * actividad al terminarla. Es lo que rompe: si borras una salida, si editas
 * cuál usaste, o si la app se cierra entre el guardado de la actividad y el
 * del contador, el número se queda desincronizado para siempre y nadie sabe
 * cuál de los dos miente.
 *
 * Aquí la pieza solo guarda **desde cuándo está en uso** y un arranque manual
 * —los kilómetros que ya traía cuando la diste de alta—. El total se suma
 * recorriendo las actividades que la tienen asignada. Es un poco más de cuenta
 * en cada render y a cambio no puede desincronizarse nunca.
 *
 * ── El aviso de retirada ────────────────────────────────────────────────────
 * Una zapatilla gastada es una lesión esperando. El umbral por defecto son
 * 800 km, que es lo que se suele recomendar, pero se puede cambiar por pieza:
 * unas de placa duran bastante menos y quien las usa lo sabe.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Actividad } from './outdoorStore'

export type TipoMaterial = 'zapatillas' | 'bici'

export interface Pieza {
  id: string
  tipo: TipoMaterial
  nombre: string
  desde: number
  /** Kilómetros que ya traía al darla de alta. */
  arranqueKm: number
  /** Umbral de retirada, en km. `null` = sin aviso (las bicis no se retiran). */
  topeKm: number | null
  retirada: boolean
}

interface MaterialState {
  piezas: Pieza[]
  /** La que se asigna por defecto a una salida nueva, por tipo. */
  favorita: Partial<Record<TipoMaterial, string>>

  alta: (p: Omit<Pieza, 'id' | 'desde' | 'retirada'>) => string
  baja: (id: string) => void
  retirar: (id: string, retirada: boolean) => void
  marcarFavorita: (tipo: TipoMaterial, id: string) => void
}

export const useOutdoorMaterial = create<MaterialState>()(
  persist(
    (set, get) => ({
      piezas: [],
      favorita: {},

      alta: (p) => {
        const id = `m${Date.now()}`
        set({ piezas: [...get().piezas, { ...p, id, desde: Date.now(), retirada: false }] })
        if (!get().favorita[p.tipo]) set({ favorita: { ...get().favorita, [p.tipo]: id } })
        return id
      },

      baja: (id) => set({
        piezas: get().piezas.filter(p => p.id !== id),
        favorita: Object.fromEntries(
          Object.entries(get().favorita).filter(([, v]) => v !== id)
        ) as Partial<Record<TipoMaterial, string>>,
      }),

      retirar: (id, retirada) => set({
        piezas: get().piezas.map(p => (p.id === id ? { ...p, retirada } : p)),
      }),

      marcarFavorita: (tipo, id) => set({ favorita: { ...get().favorita, [tipo]: id } }),
    }),
    { name: 'zencrus-outdoor-material', storage: createJSONStorage(() => AsyncStorage) }
  )
)

/**
 * Kilómetros de una pieza: el arranque manual más lo que suman las actividades
 * que la tienen asignada. Se calcula, no se almacena.
 */
export function kmDePieza(pieza: Pieza, historial: Actividad[]) {
  const enSalidas = historial
    .filter(a => a.material === pieza.id)
    .reduce((s, a) => s + a.metros, 0) / 1000
  return pieza.arranqueKm + enSalidas
}

export function estadoDePieza(pieza: Pieza, km: number) {
  if (pieza.retirada) return { texto: 'Retirada', grave: false, gastada: true }
  if (pieza.topeKm == null) return { texto: 'En uso', grave: false, gastada: false }
  const f = km / pieza.topeKm
  if (f >= 1) return { texto: 'Toca cambiarlas', grave: true, gastada: true }
  if (f >= 0.85) return { texto: 'Retirar pronto', grave: true, gastada: false }
  return { texto: 'En uso', grave: false, gastada: false }
}
