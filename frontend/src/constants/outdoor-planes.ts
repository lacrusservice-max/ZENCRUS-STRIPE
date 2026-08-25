/**
 * AL AIRE LIBRE · PLANES Y SESIONES
 * ═════════════════════════════════
 * El contenido: qué toca cada día y por qué.
 *
 * ── POR QUÉ CADA SESIÓN LLEVA UN «PARA QUÉ» ─────────────────────────────────
 * Un plan que solo dice «45 min» no enseña a entrenar: se cumple sin entender,
 * y en cuanto surge un imprevisto la gente improvisa mal porque no sabe qué
 * estaba comprando con esa sesión. El `porque` de cada día es la mitad del
 * valor del plan y no es relleno.
 *
 * ── El de cero a 5 K es progresión clásica y comprobada ─────────────────────
 * Ocho semanas alternando carrera y caminata, subiendo el bloque corriendo y
 * bajando el de andar. No es un invento: es la estructura estándar de los
 * programas de iniciación, que existe porque el corazón se adapta antes que
 * los tendones y hay que darle tiempo al segundo.
 *
 * ── Los intervalos se miden en TIEMPO, no en distancia ──────────────────────
 * En un plan de iniciación es deliberado. «Corre 400 m» empuja a mirar el
 * teléfono; «corre 3 minutos» se hace mirando al frente. Además, 400 m son
 * dos minutos para uno y cuatro para otro: el estímulo deja de ser el mismo.
 */

export type TipoBloque = 'calentar' | 'fuerte' | 'suave' | 'andar' | 'enfriar' | 'descanso'

export interface Bloque {
  tipo: TipoBloque
  /** Segundos. Los bloques de descanso completo van a 0. */
  segundos: number
}

export interface Sesion {
  id: string
  nombre: string
  familia: 'Primeros km' | 'Base' | 'Velocidad' | 'Largas'
  resumen: string
  porque: string
  bloques: Bloque[]
}

export const ETIQUETA_BLOQUE: Record<TipoBloque, string> = {
  calentar: 'Calienta',
  fuerte: 'Fuerte',
  suave: 'Suave',
  andar: 'Anda',
  enfriar: 'Enfría',
  descanso: 'Descanso',
}

const rep = (n: number, b: Bloque[]) => Array.from({ length: n }, () => b).flat()

export const SESIONES: Sesion[] = [
  {
    id: 's-primera',
    nombre: 'Tu primera media hora',
    familia: 'Primeros km',
    resumen: '5 × (3 min corriendo + 2 min andando)',
    porque:
      'Alternar enseña al corazón a recuperar sin que los tendones se lleven la paliza de correr treinta minutos seguidos. Andar entre medias no es rendirse: es la parte que hace que mañana puedas repetir.',
    bloques: [
      { tipo: 'calentar', segundos: 300 },
      ...rep(5, [{ tipo: 'suave', segundos: 180 }, { tipo: 'andar', segundos: 120 }]),
      { tipo: 'enfriar', segundos: 300 },
    ],
  },
  {
    id: 's-series-corta',
    nombre: 'Series de un minuto',
    familia: 'Velocidad',
    resumen: '8 × (1 min fuerte + 90 s andando)',
    porque:
      'Un minuto es corto a propósito: cabe entero en el esfuerzo que quieres entrenar sin que te hundas al final. Si la última serie sale mucho más lenta que la primera, ibas demasiado rápido desde el principio.',
    bloques: [
      { tipo: 'calentar', segundos: 600 },
      ...rep(8, [{ tipo: 'fuerte', segundos: 60 }, { tipo: 'andar', segundos: 90 }]),
      { tipo: 'enfriar', segundos: 300 },
    ],
  },
  {
    id: 's-rodaje',
    nombre: 'Rodaje suave',
    familia: 'Base',
    resumen: '40 min continuos, sin mirar el ritmo',
    porque:
      'La prueba es poder hablar mientras corres. La mayoría del volumen de cualquier corredor debería ir a este ritmo, y casi todo el mundo lo hace demasiado rápido: por eso está escrito «sin mirar el ritmo».',
    bloques: [
      { tipo: 'calentar', segundos: 300 },
      { tipo: 'suave', segundos: 2400 },
      { tipo: 'enfriar', segundos: 300 },
    ],
  },
  {
    id: 's-progresivo',
    nombre: 'Progresivo',
    familia: 'Base',
    resumen: '30 min subiendo de menos a más',
    porque:
      'Empezar suave y acabar fuerte enseña a repartir. Es lo contrario de lo que sale solo, que es salir disparado y llegar arrastrándose, y es la diferencia entre una buena carrera y una mala.',
    bloques: [
      { tipo: 'calentar', segundos: 300 },
      { tipo: 'suave', segundos: 900 },
      { tipo: 'fuerte', segundos: 600 },
      { tipo: 'enfriar', segundos: 300 },
    ],
  },
  {
    id: 's-larga',
    nombre: 'La larga de la semana',
    familia: 'Largas',
    resumen: '60 min a ritmo cómodo',
    porque:
      'La sesión que más mejora el fondo y la que más fácil es estropear yendo rápido. Si acabas fundido, no fue larga: fue una carrera.',
    bloques: [
      { tipo: 'calentar', segundos: 300 },
      { tipo: 'suave', segundos: 3300 },
      { tipo: 'enfriar', segundos: 300 },
    ],
  },
]

// ── Planes ───────────────────────────────────────────────────────────────────

export interface DiaPlan {
  dia: string
  titulo: string
  detalle: string
  /** Sesión que abre este día, si la tiene. Los descansos no la llevan. */
  sesion?: string
  descanso?: boolean
}

export interface Plan {
  id: string
  nombre: string
  lema: string
  semanas: number
  deporte: 'correr' | 'bici'
  /** Qué hace falta traer de casa para que el plan tenga sentido. */
  requisito: string
  dias: (semana: number) => DiaPlan[]
}

const D = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const descanso = (dia: string): DiaPlan => ({ dia, titulo: 'Descanso', detalle: '', descanso: true })

export const PLANES: Plan[] = [
  {
    id: 'p-cero-5k',
    nombre: 'De cero a 5 K',
    lema: 'Ocho semanas alternando carrera y caminata',
    semanas: 8,
    deporte: 'correr',
    requisito: 'Poder andar 30 minutos seguidos sin apuro.',
    dias: (semana) => {
      // Bloque corriendo y bloque andando, en minutos, por semana.
      const tabla: [number, number, number][] = [
        [1, 2, 6], [2, 2, 6], [3, 2, 5], [4, 2, 5],
        [5, 3, 4], [6, 2, 4], [8, 2, 3], [10, 1, 3],
      ]
      const [corre, anda, series] = tabla[Math.min(semana, 8) - 1]
      const s = `${series} × (${corre} min corriendo + ${anda} min andando)`
      return [
        descanso(D[0]),
        { dia: D[1], titulo: `${series} × ${corre} min`, detalle: s, sesion: 's-primera' },
        descanso(D[2]),
        { dia: D[3], titulo: `${series} × ${corre} min`, detalle: s, sesion: 's-primera' },
        { dia: D[4], titulo: 'Andar', detalle: '30 min fácil, para mover las piernas' },
        descanso(D[5]),
        semana >= 6
          ? { dia: D[6], titulo: 'Continuo', detalle: `${Math.min(30, 10 + semana * 3)} min sin parar`, sesion: 's-rodaje' }
          : { dia: D[6], titulo: 'Larga suave', detalle: `${series + 1} × (${corre} min + ${anda} min)`, sesion: 's-primera' },
      ]
    },
  },
  {
    id: 'p-10k',
    nombre: '10 K en 8 semanas',
    lema: 'Para quien ya corre 5 K seguidos',
    semanas: 8,
    deporte: 'correr',
    requisito: 'Correr 5 km sin parar y salir tres días por semana.',
    dias: (semana) => [
      descanso(D[0]),
      { dia: D[1], titulo: 'Series', detalle: `${Math.min(10, 5 + semana)} × 1 min fuerte`, sesion: 's-series-corta' },
      { dia: D[2], titulo: 'Rodaje', detalle: '35 min suaves', sesion: 's-rodaje' },
      descanso(D[3]),
      { dia: D[4], titulo: 'Progresivo', detalle: '30 min de menos a más', sesion: 's-progresivo' },
      descanso(D[5]),
      { dia: D[6], titulo: 'Larga', detalle: `${45 + semana * 5} min cómodos`, sesion: 's-larga' },
    ],
  },
  {
    id: 'p-volver',
    nombre: 'Volver a correr',
    lema: 'Después de una parada larga o una lesión',
    semanas: 6,
    deporte: 'correr',
    requisito: 'El alta de quien te haya tratado. Esto no sustituye a nadie.',
    dias: (semana) => [
      descanso(D[0]),
      { dia: D[1], titulo: `${2 + semana} × 3 min`, detalle: 'Con 2 min andando entre medias', sesion: 's-primera' },
      descanso(D[2]),
      { dia: D[3], titulo: 'Andar rápido', detalle: '30 min, sin correr' },
      descanso(D[4]),
      { dia: D[5], titulo: `${2 + semana} × 3 min`, detalle: 'Igual que el martes', sesion: 's-primera' },
      descanso(D[6]),
    ],
  },
]

export const buscarSesion = (id?: string) => SESIONES.find(s => s.id === id) ?? null
export const buscarPlan = (id?: string | null) => PLANES.find(p => p.id === id) ?? null

/** Duración total de una sesión, en segundos. */
export const duracionSesion = (s: Sesion) => s.bloques.reduce((a, b) => a + b.segundos, 0)
