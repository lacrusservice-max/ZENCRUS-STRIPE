/**
 * ENTRENA · REGISTRO DE LO HECHO
 * ══════════════════════════════
 * Qué ejercicios has marcado, qué días has cerrado y, de ahí, qué te toca
 * ahora. Las tres cosas que pedías —la palomita, el día que se cierra solo y
 * el «mañana te toca»— son la MISMA pieza vista desde tres sitios, y por eso
 * viven juntas en vez de repartidas por cada pantalla.
 *
 * ── POR QUÉ SE GUARDA POR FECHA Y NO POR DÍA DE LA SEMANA ───────────────────
 * La tentación es apuntar «el día 2 del programa está hecho». Se rompe en
 * cuanto alguien mueve la sesión del martes al miércoles, que es lo normal:
 * el programa diría que el martes sigue pendiente para siempre, y el miércoles
 * no contaría nada. Aquí se apunta **en qué fecha real** se hizo qué, y el
 * programa se consulta encima. Un día se puede hacer tarde, repetir o saltar
 * sin que el registro mienta.
 *
 * ── LA CLAVE DE UN EJERCICIO ────────────────────────────────────────────────
 * `slug` cuando viene del catálogo de 206; el nombre normalizado cuando es una
 * máquina rara que alguien anotó a mano. Es la misma regla que ya usa
 * `workoutStore` para atar las series al historial, y por lo mismo: en un
 * gimnasio siempre hay algo que no está en ningún catálogo.
 *
 * ── UN DÍA SE CIERRA SOLO, PERO TAMBIÉN A MANO ──────────────────────────────
 * Cuando marcas el último ejercicio, el día queda cerrado sin preguntar. Pero
 * también se puede cerrar con ejercicios sin marcar: hay tardes en las que se
 * hacen cuatro de seis y eso ES la sesión de ese día. Forzar a marcarlos todos
 * para poder cerrarlo empuja a mentir, y un registro en el que se miente deja
 * de servir para lo único que sirve un registro.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

/** `YYYY-MM-DD` en hora local. Nunca en UTC: a las 23:00 cambiaría de día. */
export const fechaClave = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const hoyClave = () => fechaClave()

export const manianaClave = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return fechaClave(d)
}

/**
 * Clave estable de un ejercicio. Se normaliza el nombre —sin acentos, sin
 * dobles espacios, en minúsculas— para que «Press Banca» y «press  banca» no
 * sean dos ejercicios distintos en el registro.
 */
export function claveEjercicio(e: { slug?: string | null; name?: string | null; nombre?: string | null }) {
  if (e.slug) return `s:${e.slug}`
  const n = (e.name ?? e.nombre ?? '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
  return `n:${n}`
}

export interface DiaRegistro {
  /** Programa y posición, para poder mirar hacia atrás con contexto. */
  programaId: string | null
  semana: number | null
  dia: number | null
  /** Claves de los ejercicios marcados. */
  hechos: string[]
  /** Cuándo se dio el día por terminado. `null` = sigue abierto. */
  cerradoEn: number | null
  /** Ejercicios que el usuario añadió a mano ese día. */
  extra: { clave: string; nombre: string; musculo: string | null }[]
}

interface RegistroState {
  dias: Record<string, DiaRegistro>

  /** Marca o desmarca un ejercicio. Devuelve si quedó marcado. */
  alternar: (fecha: string, clave: string, ctx?: Ctx) => boolean
  estaHecho: (fecha: string, clave: string) => boolean
  cuantosHechos: (fecha: string) => number

  cerrarDia: (fecha: string, ctx?: Ctx) => void
  reabrirDia: (fecha: string) => void
  /** Reabre Y desmarca todo. Reabrir sin limpiar no sirve si están todos. */
  limpiarDia: (fecha: string) => void
  estaCerrado: (fecha: string) => boolean

  anadirExtra: (fecha: string, nombre: string, musculo?: string | null, slug?: string | null) => string
  quitarExtra: (fecha: string, clave: string) => void
  extrasDe: (fecha: string) => DiaRegistro['extra']

  /** Todo lo hecho ese día, para el resumen. */
  del: (fecha: string) => DiaRegistro | null
  /** Fechas cerradas, de la más reciente a la más antigua. */
  cerrados: () => string[]
}

type Ctx = { programaId?: string | null; semana?: number | null; dia?: number | null }

const vacio = (c?: Ctx): DiaRegistro => ({
  programaId: c?.programaId ?? null,
  semana: c?.semana ?? null,
  dia: c?.dia ?? null,
  hechos: [],
  cerradoEn: null,
  extra: [],
})

export const useEntrenoRegistro = create<RegistroState>()(
  persist(
    (set, get) => ({
      dias: {},

      alternar: (fecha, clave, ctx) => {
        const d = get().dias[fecha] ?? vacio(ctx)
        const ya = d.hechos.includes(clave)
        const hechos = ya ? d.hechos.filter(x => x !== clave) : [...d.hechos, clave]
        // Desmarcar un ejercicio reabre el día: si ya no está todo hecho,
        // decir que el día está cerrado sería justo la mentira que evitamos.
        const cerradoEn = ya ? null : d.cerradoEn
        set({ dias: { ...get().dias, [fecha]: { ...d, hechos, cerradoEn } } })
        return !ya
      },

      estaHecho: (fecha, clave) => (get().dias[fecha]?.hechos ?? []).includes(clave),
      cuantosHechos: (fecha) => get().dias[fecha]?.hechos.length ?? 0,

      cerrarDia: (fecha, ctx) => {
        const d = get().dias[fecha] ?? vacio(ctx)
        set({ dias: { ...get().dias, [fecha]: { ...d, cerradoEn: Date.now() } } })
      },

      reabrirDia: (fecha) => {
        const d = get().dias[fecha]
        if (!d) return
        set({ dias: { ...get().dias, [fecha]: { ...d, cerradoEn: null } } })
      },

      /**
       * Reabrir con TODOS los ejercicios marcados no sirve de nada: el cierre
       * automático se vuelve a disparar en el siguiente render y el día se
       * cierra otra vez. Por eso deshacer de verdad es esto: quitar las marcas
       * y reabrir en el mismo gesto.
       */
      limpiarDia: (fecha) => {
        const d = get().dias[fecha]
        if (!d) return
        set({ dias: { ...get().dias, [fecha]: { ...d, hechos: [], cerradoEn: null } } })
      },

      estaCerrado: (fecha) => get().dias[fecha]?.cerradoEn != null,

      anadirExtra: (fecha, nombre, musculo = null, slug = null) => {
        const d = get().dias[fecha] ?? vacio()
        const clave = claveEjercicio({ slug, nombre })
        if (d.extra.some(x => x.clave === clave)) return clave
        set({
          dias: {
            ...get().dias,
            [fecha]: { ...d, extra: [...d.extra, { clave, nombre: nombre.trim(), musculo }] },
          },
        })
        return clave
      },

      quitarExtra: (fecha, clave) => {
        const d = get().dias[fecha]
        if (!d) return
        set({
          dias: {
            ...get().dias,
            [fecha]: {
              ...d,
              extra: d.extra.filter(x => x.clave !== clave),
              hechos: d.hechos.filter(x => x !== clave),
            },
          },
        })
      },

      extrasDe: (fecha) => get().dias[fecha]?.extra ?? [],
      del: (fecha) => get().dias[fecha] ?? null,
      cerrados: () =>
        Object.entries(get().dias)
          .filter(([, d]) => d.cerradoEn != null)
          .map(([f]) => f)
          .sort((a, b) => b.localeCompare(a)),
    }),
    { name: 'zencrus-entreno-registro', storage: createJSONStorage(() => AsyncStorage) }
  )
)

// ── Qué toca ahora ───────────────────────────────────────────────────────────

export type CuandoToca = 'hoy' | 'maniana' | 'hecho-y-descanso'

/**
 * La respuesta a «¿qué pongo en la tarjeta grande?».
 *
 * · `hoy` — lo de hoy sigue pendiente.
 * · `maniana` — lo de hoy ya está cerrado y mañana hay sesión.
 * · `hecho-y-descanso` — lo de hoy está cerrado y mañana no toca nada.
 *
 * Recibe una función que dice qué sesión corresponde a cada fecha, porque el
 * calendario del programa vive en `workoutStore` y este registro no tiene por
 * qué saber cómo se reparte una semana.
 */
export function queToca<T>(
  sesionDe: (fecha: string) => T | null,
  estaCerrado: (fecha: string) => boolean
): { cuando: CuandoToca; sesion: T | null; fecha: string } {
  const hoy = hoyClave()
  const deHoy = sesionDe(hoy)

  if (deHoy && !estaCerrado(hoy)) return { cuando: 'hoy', sesion: deHoy, fecha: hoy }

  const man = manianaClave()
  const deManiana = sesionDe(man)
  if (deManiana) return { cuando: 'maniana', sesion: deManiana, fecha: man }

  return { cuando: 'hecho-y-descanso', sesion: deHoy, fecha: hoy }
}
