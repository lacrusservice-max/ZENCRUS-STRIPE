/**
 * ENTRENA · NOMBRES PROPIOS
 * ═════════════════════════
 * El usuario le pone a un ejercicio el nombre con el que lo llama él.
 *
 * ── ESTO NO SALE DE ESTE TELÉFONO. NUNCA. ───────────────────────────────────
 * Es la regla entera de este fichero y por eso está escrita en mayúsculas.
 *
 * El catálogo de 206 ejercicios es COMPARTIDO: lo usan los programas, las
 * estadísticas, los récords y las otras cuentas. Si «Jalón estrecho» se
 * renombrara de verdad, cambiaría para todo el mundo, rompería los programas
 * que lo citan por nombre y ensuciaría el historial de quien no ha pedido nada.
 *
 * Aquí solo se guarda una **capa de presentación**: un mapa `clave → tu nombre`
 * que vive en este dispositivo, se aplica al pintar y no viaja al servidor en
 * ninguna petición. El `slug` sigue siendo el mismo, así que las series, los
 * récords y la progresión se siguen atando al ejercicio de verdad.
 *
 * Consecuencia buscada: puedes llamarle «la polea de siempre» y tus estadísticas
 * no se enteran. Y si borras el nombre propio, vuelve a verse el del catálogo
 * sin haber perdido nada por el camino.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { claveEjercicio } from './entrenoRegistroStore'

interface NombresState {
  /** `clave del ejercicio` → nombre que le pone el usuario. */
  nombres: Record<string, string>
  /** `id del vídeo` → nombre que le pone el usuario. */
  videos: Record<string, string>

  poner: (e: Ident, nombre: string) => void
  quitar: (e: Ident) => void
  /** El nombre a pintar: el suyo si lo hay, el del catálogo si no. */
  resolver: (e: Ident) => string

  ponerVideo: (id: string, nombre: string) => void
  quitarVideo: (id: string) => void
  resolverVideo: (id: string, original: string) => string
}

type Ident = { slug?: string | null; nombre?: string | null; name?: string | null }

export const useNombresPropios = create<NombresState>()(
  persist(
    (set, get) => ({
      nombres: {},
      videos: {},

      poner: (e, nombre) => {
        const limpio = nombre.trim()
        const k = claveEjercicio(e)
        // Poner el mismo nombre que ya tenía equivale a quitarlo: no se guarda
        // basura que luego habría que distinguir de un renombrado de verdad.
        const original = (e.nombre ?? e.name ?? '').trim()
        if (!limpio || limpio === original) {
          const { [k]: _, ...resto } = get().nombres
          set({ nombres: resto })
          return
        }
        set({ nombres: { ...get().nombres, [k]: limpio } })
      },

      quitar: (e) => {
        const { [claveEjercicio(e)]: _, ...resto } = get().nombres
        set({ nombres: resto })
      },

      resolver: (e) =>
        get().nombres[claveEjercicio(e)] ?? (e.nombre ?? e.name ?? ''),

      ponerVideo: (id, nombre) => {
        const limpio = nombre.trim()
        if (!limpio) { get().quitarVideo(id); return }
        set({ videos: { ...get().videos, [id]: limpio } })
      },

      quitarVideo: (id) => {
        const { [id]: _, ...resto } = get().videos
        set({ videos: resto })
      },

      resolverVideo: (id, original) => get().videos[id] ?? original,
    }),
    { name: 'zencrus-nombres-propios', storage: createJSONStorage(() => AsyncStorage) }
  )
)

/**
 * Atajo para pintar. Se suscribe al mapa entero a propósito: son unas pocas
 * decenas de entradas y así una pantalla con veinte ejercicios no monta veinte
 * suscripciones distintas.
 */
export function useNombre(e: Ident) {
  const nombres = useNombresPropios(s => s.nombres)
  return nombres[claveEjercicio(e)] ?? (e.nombre ?? e.name ?? '')
}

/** Si tiene nombre propio, para poder enseñar «antes era…». */
export function useNombreOriginal(e: Ident) {
  const nombres = useNombresPropios(s => s.nombres)
  const propio = nombres[claveEjercicio(e)]
  return propio ? (e.nombre ?? e.name ?? null) : null
}
