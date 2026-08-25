/**
 * EN CASA · QUÉ TIENES DE VERDAD
 * ══════════════════════════════
 * El inventario de lo que hay en tu casa, y el filtro que sale de él.
 *
 * ── POR QUÉ NO BASTABA LA BANDERA «HOME» DEL CATÁLOGO ───────────────────────
 * El catálogo marca 125 de 206 como «se puede hacer sin gimnasio», y la
 * clasificación es correcta: máquina, polea y barra fija quedan fuera. Pero
 * dentro de esos 125 hay **56 de mancuernas y 23 de pesa rusa**, y quien no
 * tiene ni lo uno ni lo otro no puede hacer ninguno.
 *
 * «Sin gimnasio» y «en MI casa» no son lo mismo. Una lista de ejercicios que
 * el usuario no puede hacer es exactamente igual de inútil que una llena de
 * poleas: cambia el motivo, no el resultado.
 *
 * ── El peso corporal no se pregunta ─────────────────────────────────────────
 * Siempre está disponible, así que no ocupa una casilla. Preguntar «¿tienes
 * tu cuerpo?» es la clase de pregunta que hace que la gente cierre el
 * formulario.
 *
 * ── Los seis colgados ───────────────────────────────────────────────────────
 * Dominadas, fondos y elevaciones colgado son peso corporal PERO piden barra,
 * paralelas o un banco. El catálogo los deja fuera de «home» —bien hecho— y
 * aquí vuelven a entrar si dices que tienes esa barra. Van por slug porque su
 * `equipment` dice «peso corporal» y no distingue.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

/** Las claves de `equipment` del catálogo que sí puede haber en una casa. */
export type Aparejo = 'dumbbell' | 'kettlebell' | 'band' | 'barra' | 'banco'

export const APAREJOS: {
  id: Aparejo
  nombre: string
  sub: string
  icono: string
}[] = [
  { id: 'dumbbell', nombre: 'Mancuernas', sub: 'Aunque sea un par', icono: 'barbell-outline' },
  { id: 'kettlebell', nombre: 'Pesa rusa', sub: 'Una kettlebell de cualquier peso', icono: 'fitness-outline' },
  { id: 'band', nombre: 'Bandas elásticas', sub: 'De tela o de goma', icono: 'git-commit-outline' },
  { id: 'barra', nombre: 'Barra de dominadas', sub: 'O unas paralelas', icono: 'remove-outline' },
  { id: 'banco', nombre: 'Banco o silla firme', sub: 'Para fondos y apoyos', icono: 'tablet-landscape-outline' },
]

/**
 * Los que piden barra o banco pese a ser «peso corporal». Se listan por slug
 * porque su equipo dice «peso corporal» y ahí no se distingue.
 */
const POR_SLUG: Record<string, Aparejo> = {
  'pull-ups': 'barra',
  'chin-ups': 'barra',
  'hanging-knee-raises': 'barra',
  'parralel-bar-dips': 'barra',
  'inverted-row': 'barra',
  'bench-dips': 'banco',
}

interface CasaMaterialState {
  tengo: Aparejo[]
  /** Si ya se preguntó una vez. Sin esto la tarjeta volvería cada día. */
  preguntado: boolean

  alternar: (a: Aparejo) => void
  poner: (lista: Aparejo[]) => void
  marcarPreguntado: () => void
  reiniciar: () => void
}

export const useCasaMaterial = create<CasaMaterialState>()(
  persist(
    (set, get) => ({
      tengo: [],
      preguntado: false,

      alternar: (a) => set({
        tengo: get().tengo.includes(a)
          ? get().tengo.filter(x => x !== a)
          : [...get().tengo, a],
      }),
      poner: (lista) => set({ tengo: lista, preguntado: true }),
      marcarPreguntado: () => set({ preguntado: true }),
      reiniciar: () => set({ tengo: [], preguntado: false }),
    }),
    { name: 'zencrus-casa-material', storage: createJSONStorage(() => AsyncStorage) }
  )
)

/**
 * ¿Puedo hacer este ejercicio con lo que tengo?
 *
 * Devuelve `true` cuando no hay inventario todavía: mientras el usuario no ha
 * contestado, esconderle medio catálogo sería peor que enseñárselo entero.
 */
export function puedoHacerlo(
  e: { slug?: string | null; equipment?: string | null; home?: boolean },
  tengo: Aparejo[],
  preguntado: boolean
): boolean {
  if (!preguntado) return true

  const porSlug = e.slug ? POR_SLUG[e.slug] : undefined
  if (porSlug) return tengo.includes(porSlug)

  switch (e.equipment) {
    case 'bodyweight': return true
    case 'dumbbell': return tengo.includes('dumbbell')
    case 'kettlebell': return tengo.includes('kettlebell')
    case 'band': return tengo.includes('band')
    // Barra, polea, máquina, multipower, landmine y disco no son de casa y el
    // catálogo ya los deja fuera. Si alguno se cuela, se queda fuera aquí.
    default: return false
  }
}

/** Cuántos ejercicios desbloquea cada aparejo, para poder decirlo al preguntar. */
export const DESBLOQUEA: Record<Aparejo, number> = {
  dumbbell: 56,
  kettlebell: 23,
  band: 12,
  barra: 5,
  banco: 1,
}
