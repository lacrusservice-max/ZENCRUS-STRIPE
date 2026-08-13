/**
 * LOS CUATRO PROGRAMAS DE ARRANQUE
 * ────────────────────────────────
 * Los que trae ZENCRUS de fábrica. Van en la base como filas con `user_id` a
 * null —eso es lo que los hace públicos— y se siembran con
 * `scripts/sembrar-programas.ts`.
 *
 * ── Por qué cuatro y no veinte ──────────────────────────────────────────────
 * Un catálogo de veinte programas parece generoso y es lo contrario: obliga a
 * elegir entre cosas que quien empieza no sabe distinguir, y la mayoría se
 * quedan sin abrir. Estos cuatro cubren los cuatro casos que de verdad
 * existen hoy: no sé nada y voy al gimnasio, quiero músculo, no tengo material,
 * y ya sé lo que hago.
 *
 * ── Los slugs son REALES ────────────────────────────────────────────────────
 * Todos salen del catálogo de 206. Un slug inventado se guardaría igual y la
 * serie entraría en el historial, pero el ejercicio no contaría en el mapa del
 * cuerpo ni encontraría su imagen: fallo silencioso de los caros. Hay una
 * comprobación en el script de siembra que aborta si alguno no existe.
 *
 * ── `deload_every` o porcentajes, nunca los dos ─────────────────────────────
 * La doble progresión no sabe bajar sola, así que sus programas llevan
 * `deloadEvery: 4` y el motor recorta series y peso esa semana. Los de
 * porcentajes ya escriben la bajada en su propia lista y llevan `null`: con las
 * dos cosas a la vez, la cuarta semana se descontaría dos veces y saldría un
 * peso ridículo.
 */

import type { Plan } from '../services/programas'

export interface ProgramaArranque {
  name: string
  description: string
  weeks: number
  daysPerWeek: number
  goal: 'strength' | 'hypertrophy' | 'endurance' | 'general'
  level: 'beginner' | 'intermediate' | 'advanced'
  mode: 'gym' | 'home' | 'outdoor' | 'class'
  deloadEvery: number | null
  plan: Plan
}

export const PROGRAMAS: ProgramaArranque[] = [
  // ═══ 1 · Empezar en el gimnasio ═════════════════════════════════════════
  {
    name: 'Fuerza desde cero',
    description:
      'Tres días por semana y cinco ejercicios en total. Subes 2,5 kg cada vez que completas las cinco repeticiones en todas las series, así que el programa avanza a tu ritmo y no al del calendario. Es lo más rápido que progresa alguien que empieza.',
    weeks: 8,
    daysPerWeek: 3,
    goal: 'strength',
    level: 'beginner',
    mode: 'gym',
    /**
     * Sin descarga programada. Quien empieza todavía no acumula fatiga
     * suficiente para necesitarla en ocho semanas, y bajar la carga a la cuarta
     * frenaría justo la progresión que hace que valga la pena venir.
     */
    deloadEvery: null,
    plan: {
      dias: [
        {
          dia: 1, nombre: 'Día A', foco: 'quads',
          ejercicios: [
            { slug: 'barbell-squat', nombre: 'Sentadilla con barra', series: 5, reps: '5', descanso: 180, progresion: 'doble', incremento: 5 },
            { slug: 'barbell-bench-press', nombre: 'Press de banca con barra', series: 5, reps: '5', descanso: 180, progresion: 'doble', incremento: 2.5 },
            { slug: 'barbell-bent-over-row', nombre: 'Remo inclinado con barra', series: 5, reps: '5', descanso: 150, progresion: 'doble', incremento: 2.5 },
          ],
        },
        {
          dia: 2, nombre: 'Día B', foco: 'shoulders',
          ejercicios: [
            { slug: 'barbell-squat', nombre: 'Sentadilla con barra', series: 5, reps: '5', descanso: 180, progresion: 'doble', incremento: 5 },
            { slug: 'barbell-overhead-press', nombre: 'Press sobre la cabeza con barra', series: 5, reps: '5', descanso: 180, progresion: 'doble', incremento: 2.5 },
            // Una sola serie, y no es un descuido: cinco series pesadas de peso
            // muerto dejan una fatiga que se paga en la sentadilla del día
            // siguiente. Con una basta para progresar al principio.
            { slug: 'barbell-deadlift', nombre: 'Peso muerto con barra', series: 1, reps: '5', descanso: 180, progresion: 'doble', incremento: 5, notas: 'Una serie de verdad. Calienta antes con series suaves: no cuentan.' },
          ],
        },
        {
          dia: 3, nombre: 'Día A', foco: 'chest',
          ejercicios: [
            { slug: 'barbell-squat', nombre: 'Sentadilla con barra', series: 5, reps: '5', descanso: 180, progresion: 'doble', incremento: 5 },
            { slug: 'barbell-bench-press', nombre: 'Press de banca con barra', series: 5, reps: '5', descanso: 180, progresion: 'doble', incremento: 2.5 },
            { slug: 'barbell-bent-over-row', nombre: 'Remo inclinado con barra', series: 5, reps: '5', descanso: 150, progresion: 'doble', incremento: 2.5 },
          ],
        },
      ],
    },
  },

  // ═══ 2 · Hipertrofia ════════════════════════════════════════════════════
  {
    name: 'Empuje, tirón y pierna',
    description:
      'Cuatro días repartidos por patrón de movimiento, con rangos de 6 a 12 repeticiones. Cada cuatro semanas baja la carga para que el cuerpo recupere: es cuando de verdad se construye.',
    weeks: 12,
    daysPerWeek: 4,
    goal: 'hypertrophy',
    level: 'intermediate',
    mode: 'gym',
    deloadEvery: 4,
    plan: {
      dias: [
        {
          dia: 1, nombre: 'Empuje', foco: 'chest',
          ejercicios: [
            { slug: 'barbell-bench-press', nombre: 'Press de banca con barra', series: 4, reps: '6-8', descanso: 150, progresion: 'doble', incremento: 2.5 },
            { slug: 'barbell-incline-bench-press', nombre: 'Press de banca inclinado con barra', series: 3, reps: '8-10', descanso: 120, progresion: 'doble', incremento: 2.5 },
            { slug: 'dumbbell-seated-overhead-press', nombre: 'Press sentado sobre la cabeza con mancuerna', series: 3, reps: '8-10', descanso: 120, progresion: 'doble', incremento: 2 },
            { slug: 'dumbbell-lateral-raise', nombre: 'Elevación lateral con mancuerna', series: 3, reps: '12-15', descanso: 75, progresion: 'doble', incremento: 1 },
            { slug: 'cable-rope-pushdown', nombre: 'Extensión con cuerda en polea', series: 3, reps: '10-12', descanso: 75, progresion: 'doble', incremento: 2.5 },
          ],
        },
        {
          dia: 2, nombre: 'Tirón', foco: 'back',
          ejercicios: [
            { slug: 'pull-ups', nombre: 'Dominadas', series: 4, reps: '6-10', descanso: 150, progresion: 'fija', carga: 'bodyweight', notas: 'Si te sobran, cuelga peso. Si no llegas, usa la asistida.' },
            { slug: 'barbell-bent-over-row', nombre: 'Remo inclinado con barra', series: 4, reps: '8-10', descanso: 120, progresion: 'doble', incremento: 2.5 },
            { slug: 'dumbbell-single-arm-row', nombre: 'Remo a una mano con mancuerna', series: 3, reps: '10-12', descanso: 90, progresion: 'doble', incremento: 2 },
            { slug: 'dumbbell-hammer-curl', nombre: 'Curl martillo con mancuerna', series: 3, reps: '10-12', descanso: 75, progresion: 'doble', incremento: 1 },
            { slug: 'dumbbell-curl', nombre: 'Curl con mancuerna', series: 3, reps: '10-12', descanso: 75, progresion: 'doble', incremento: 1 },
          ],
        },
        {
          dia: 3, nombre: 'Pierna', foco: 'quads',
          ejercicios: [
            { slug: 'barbell-squat', nombre: 'Sentadilla con barra', series: 4, reps: '6-8', descanso: 180, progresion: 'doble', incremento: 5 },
            { slug: 'barbell-stiff-leg-deadlifts', nombre: 'Peso muerto con piernas rígidas con barra', series: 3, reps: '8-10', descanso: 150, progresion: 'doble', incremento: 5 },
            { slug: 'machine-leg-press', nombre: 'Press de pierna en máquina', series: 3, reps: '10-12', descanso: 120, progresion: 'doble', incremento: 5 },
            { slug: 'machine-leg-extension', nombre: 'Extensión de pierna en máquina', series: 3, reps: '12-15', descanso: 75, progresion: 'doble', incremento: 2.5 },
            { slug: 'elbow-side-plank', nombre: 'Plancha de codo lateral', series: 3, duracion: 30, descanso: 60, progresion: 'tiempo', incremento: 5, carga: 'bodyweight' },
          ],
        },
        {
          dia: 4, nombre: 'Torso completo', foco: 'shoulders',
          ejercicios: [
            { slug: 'barbell-overhead-press', nombre: 'Press sobre la cabeza con barra', series: 4, reps: '6-8', descanso: 150, progresion: 'doble', incremento: 2.5 },
            { slug: 'chin-ups', nombre: 'Dominadas supinas', series: 3, reps: '6-10', descanso: 120, progresion: 'fija', carga: 'bodyweight' },
            { slug: 'barbell-close-grip-bench-press', nombre: 'Press de banca agarre cerrado con barra', series: 3, reps: '8-10', descanso: 120, progresion: 'doble', incremento: 2.5 },
            { slug: 'dumbbell-row-bilateral', nombre: 'Remo bilateral con mancuerna', series: 3, reps: '10-12', descanso: 90, progresion: 'doble', incremento: 2 },
            { slug: 'bodyweight-russian-twist', nombre: 'Giro ruso', series: 3, reps: '15-20', descanso: 60, progresion: 'fija', carga: 'bodyweight' },
          ],
        },
      ],
    },
  },

  // ═══ 3 · En casa ════════════════════════════════════════════════════════
  {
    name: 'En casa, sin material',
    description:
      'Seis semanas con lo que ya tienes: el suelo y tu peso. Tres días de cuerpo entero. No hay kilos que subir, así que la progresión son repeticiones y segundos.',
    weeks: 6,
    daysPerWeek: 3,
    goal: 'general',
    level: 'beginner',
    mode: 'home',
    /**
     * Sin descarga: no hay carga que bajar. Lo único que recortaría son series,
     * y en un programa de peso corporal de seis semanas eso es quitar por
     * quitar.
     */
    deloadEvery: null,
    plan: {
      dias: [
        {
          dia: 1, nombre: 'Cuerpo entero A', foco: 'quads',
          ejercicios: [
            { slug: 'bodyweight-squat', nombre: 'Sentadilla', series: 3, reps: '12-20', descanso: 75, progresion: 'fija', carga: 'bodyweight' },
            { slug: 'bodyweight-knee-push-ups', nombre: 'Flexiones con rodillas', series: 3, reps: '8-15', descanso: 75, progresion: 'fija', carga: 'bodyweight', notas: 'Cuando te salgan 15 limpias, pasa a las normales.' },
            { slug: 'inverted-row', nombre: 'Remo invertido', series: 3, reps: '8-12', descanso: 90, progresion: 'fija', carga: 'bodyweight', notas: 'Bajo una mesa firme si no tienes barra.' },
            { slug: 'elbow-side-plank', nombre: 'Plancha de codo lateral', series: 3, duracion: 25, descanso: 45, progresion: 'tiempo', incremento: 5, carga: 'bodyweight' },
          ],
        },
        {
          dia: 2, nombre: 'Cuerpo entero B', foco: 'glutes',
          ejercicios: [
            { slug: 'bodyweight-reverse-lunge', nombre: 'Zancada inversa', series: 3, reps: '10-14', descanso: 75, progresion: 'fija', carga: 'bodyweight' },
            { slug: 'incline-push-up', nombre: 'Flexiones inclinadas', series: 3, reps: '10-15', descanso: 75, progresion: 'fija', carga: 'bodyweight' },
            { slug: 'supermans', nombre: 'Superman', series: 3, reps: '12-15', descanso: 60, progresion: 'fija', carga: 'bodyweight' },
            { slug: 'bodyweight-hip-abduction', nombre: 'Abducción de cadera', series: 3, reps: '15-20', descanso: 60, progresion: 'fija', carga: 'bodyweight' },
          ],
        },
        {
          dia: 3, nombre: 'Cuerpo entero C', foco: 'core',
          ejercicios: [
            { slug: 'bodyweight-box-squat', nombre: 'Sentadilla al cajón', series: 3, reps: '12-20', descanso: 75, progresion: 'fija', carga: 'bodyweight', notas: 'Con una silla vale.' },
            { slug: 'bench-dips', nombre: 'Fondos de banca', series: 3, reps: '8-15', descanso: 75, progresion: 'fija', carga: 'bodyweight' },
            { slug: 'bodyweight-alternating-lateral-lunge', nombre: 'Zancada alternada lateral', series: 3, reps: '10-12', descanso: 75, progresion: 'fija', carga: 'bodyweight' },
            { slug: 'bodyweight-russian-twist', nombre: 'Giro ruso', series: 3, reps: '15-25', descanso: 60, progresion: 'fija', carga: 'bodyweight' },
          ],
        },
      ],
    },
  },

  // ═══ 4 · Fuerza por porcentajes ═════════════════════════════════════════
  {
    name: 'Fuerza por porcentajes',
    description:
      'Doce semanas periodizadas sobre tu máximo estimado: tres subiendo la intensidad y una bajando, tres veces. Necesita que ya tengas marcas registradas en los básicos, porque el peso de cada día sale de ellas.',
    weeks: 12,
    daysPerWeek: 4,
    goal: 'strength',
    level: 'advanced',
    mode: 'gym',
    /**
     * Null a propósito: la bajada YA está escrita en el cuarto valor de cada
     * lista de porcentajes. Poner aquí un 4 además la descontaría dos veces.
     */
    deloadEvery: null,
    plan: {
      dias: [
        {
          dia: 1, nombre: 'Sentadilla pesada', foco: 'quads',
          ejercicios: [
            { slug: 'barbell-squat', nombre: 'Sentadilla con barra', series: 5, reps: '5', descanso: 210, progresion: 'porcentaje', pct: [0.75, 0.80, 0.85, 0.65] },
            { slug: 'barbell-stiff-leg-deadlifts', nombre: 'Peso muerto con piernas rígidas con barra', series: 3, reps: '8', descanso: 150, progresion: 'porcentaje', pct: [0.55, 0.60, 0.65, 0.50] },
            { slug: 'machine-leg-press', nombre: 'Press de pierna en máquina', series: 3, reps: '10', descanso: 120, progresion: 'doble', incremento: 5 },
          ],
        },
        {
          dia: 2, nombre: 'Banca pesada', foco: 'chest',
          ejercicios: [
            { slug: 'barbell-bench-press', nombre: 'Press de banca con barra', series: 5, reps: '5', descanso: 210, progresion: 'porcentaje', pct: [0.75, 0.80, 0.85, 0.65] },
            { slug: 'barbell-overhead-press', nombre: 'Press sobre la cabeza con barra', series: 4, reps: '6', descanso: 150, progresion: 'porcentaje', pct: [0.65, 0.70, 0.75, 0.60] },
            { slug: 'cable-bar-pushdown', nombre: 'Extensión en polea', series: 3, reps: '10-12', descanso: 75, progresion: 'doble', incremento: 2.5 },
          ],
        },
        {
          dia: 3, nombre: 'Peso muerto pesado', foco: 'hamstrings',
          ejercicios: [
            { slug: 'barbell-deadlift', nombre: 'Peso muerto con barra', series: 4, reps: '4', descanso: 240, progresion: 'porcentaje', pct: [0.78, 0.83, 0.88, 0.65] },
            { slug: 'barbell-bent-over-row', nombre: 'Remo inclinado con barra', series: 4, reps: '6-8', descanso: 150, progresion: 'doble', incremento: 2.5 },
            { slug: 'pull-ups', nombre: 'Dominadas', series: 3, reps: '6-10', descanso: 120, progresion: 'fija', carga: 'bodyweight' },
          ],
        },
        {
          dia: 4, nombre: 'Técnica y volumen', foco: 'shoulders',
          ejercicios: [
            { slug: 'barbell-squat', nombre: 'Sentadilla con barra', series: 4, reps: '3', descanso: 180, progresion: 'porcentaje', pct: [0.65, 0.70, 0.72, 0.55], notas: 'Rápido y limpio. No es un día de esfuerzo, es de técnica.' },
            { slug: 'barbell-close-grip-bench-press', nombre: 'Press de banca agarre cerrado con barra', series: 4, reps: '6', descanso: 150, progresion: 'porcentaje', pct: [0.60, 0.65, 0.70, 0.55] },
            { slug: 'dumbbell-lateral-raise', nombre: 'Elevación lateral con mancuerna', series: 4, reps: '12-15', descanso: 75, progresion: 'doble', incremento: 1 },
            { slug: 'elbow-side-plank', nombre: 'Plancha de codo lateral', series: 3, duracion: 45, descanso: 60, progresion: 'tiempo', incremento: 5, carga: 'bodyweight' },
          ],
        },
      ],
    },
  },
]
