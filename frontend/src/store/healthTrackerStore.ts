import { hoyLocal, haceDias, aFechaLocal } from '@/utils/fechas'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export interface StepEntry {
  /* Si existe la entrada, es porque ese día se registró: aquí no hay nulls. El
     «no registrado» se representa por la AUSENCIA de entrada, y es el resumen
     —DailyHealthSummary— el que lo traduce a null para quien pinta. */
  date: string
  steps: number
  caloriesBurned: number
  distanceKm: number
  activeMinutes: number
}

export interface HeartRateEntry {
  timestamp: string
  bpm: number
  type: 'resting' | 'active' | 'peak'
}

export interface SleepEntry {
  date: string
  bedtime: string
  wakeTime: string
  totalHours: number
  quality: 'poor' | 'fair' | 'good' | 'excellent'
  /**
   * Si la calidad la dijo quien durmió, o si se dedujo de las horas.
   *
   * Importa porque son cosas distintas: ocho horas dando vueltas en la cama no
   * son un sueño «excelente», y hasta ahora la app lo llamaba así porque solo
   * miraba el reloj. Lo que se deduce se puede seguir enseñando, pero no puede
   * presentarse con la misma autoridad que lo que alguien ha declarado.
   */
  qualitySource: 'declarada' | 'derivada'
  /**
   * null = no se puede saber, que es SIEMPRE mientras no haya un sensor.
   *
   * Aquí había `totalHours * 0.2` y `totalHours * 0.25`: dos constantes que se
   * enseñaban en la pantalla del tracker como «Sueño profundo: 1.6 h» y «REM:
   * 2 h». No eran una estimación declarada como tal, eran una multiplicación
   * presentada como medición — el mismo patrón que el pulso de 65 y los pasos
   * al azar que documenta este archivo más abajo.
   *
   * Se quedan en el modelo porque el día que haya de dónde sacarlas se
   * rellenan; hasta entonces valen null y no se pintan.
   */
  deepSleepHours: number | null
  remSleepHours: number | null
}

export interface DailyHealthSummary {
  date: string
  /** null = ese día no se registró nada. Cero pasos es otra cosa. */
  steps: number | null
  caloriesBurned: number | null
  distanceKm: number | null
  activeMinutes: number | null
  /** null = no hay ni una medición ese día. No es lo mismo que cero. */
  avgHeartRate: number | null
  /** null = no hay ni una medición ese día. No es lo mismo que cero. */
  restingHeartRate: number | null
  /** null = esa noche no se registró. */
  sleepHours: number | null
  sleepQuality: SleepEntry['quality'] | null
}

/**
 * EL DÍA EN QUE OCURRIÓ, NO EL DÍA EN UTC.
 *
 * Las mediciones se guardan con `new Date().toISOString()`, que es UTC, y las
 * fechas de la app vienen de `hoyLocal()`. Comparar la una con la otra por
 * `timestamp.startsWith(fecha)` desplaza el día entero.
 *
 * Comprobado: una medición tomada a las 19:30 en México se guarda como
 * `2026-08-20T01:30Z`, así que `startsWith('2026-08-19')` da false y la
 * medición de esa tarde NO cuenta como de hoy. En la práctica, todo lo que
 * alguien registre después de las seis de la tarde se cae del día.
 *
 * Al revés pasa igual: en Madrid, algo medido a la 01:00 se guarda con la fecha
 * del día anterior y aparece en el día que no es.
 */
const diaLocalDe = (timestamp: string): string => aFechaLocal(new Date(timestamp))

/** Más viejo que esto, el pulso en reposo ya no describe cómo estás hoy. */
/**
 * LOS PASOS DE HOY SON LOS DE HOY.
 *
 * `todaySteps` es un contador suelto, persistido, y NADIE lo reinicia al cambiar
 * de día: los únicos que lo escriben son `setTodaySteps` y `addSteps`. Quien
 * registraba 8.000 pasos el lunes y abría la app el miércoles se encontraba esos
 * mismos 8.000 presentados como los de hoy —en la portada, en el resumen semanal
 * y en el anillo de movimiento— hasta que volviera a registrar.
 *
 * Peor aún: `addSteps` sumaba sobre ese arrastre, así que 2.000 pasos el
 * miércoles se convertían en 10.000 y se guardaban así en el historial. El dato
 * no solo se enseñaba mal: se escribía mal.
 *
 * El historial sí lleva la fecha en cada entrada, así que es la fuente de verdad
 * y `todaySteps` pasa a ser un espejo del que nadie depende para saber el día.
 */
const pasosDeHoy = (historial: StepEntry[]): StepEntry | null =>
  historial.find(e => e.date === hoyLocal()) ?? null

/** Más viejo que esto, el pulso en reposo ya no describe cómo estás hoy. */
const VENTANA_PULSO_DIAS = 7

const STEPS_PER_CALORIE = 0.04
const STEPS_PER_KM = 1312

function stepsToCalories(steps: number): number {
  return Math.round(steps * STEPS_PER_CALORIE)
}

function stepsToKm(steps: number): number {
  return Math.round((steps / STEPS_PER_KM) * 10) / 10
}

const today = () => hoyLocal()

/**
 * AQUÍ HABÍA SIETE DÍAS DE PASOS Y DE SUEÑO INVENTADOS
 * ═══════════════════════════════════════════════════
 * `DEMO_STEPS` y `DEMO_SLEEP` generaban una semana entera con `Math.random()`,
 * y `todaySteps` arrancaba con un número al azar entre 2.000 y 5.000. No eran
 * un ejemplo de una pantalla de bienvenida: eran el ESTADO INICIAL del store, y
 * el store persiste. O sea que se inventaban una vez, se guardaban en el
 * teléfono y a partir de ahí pasaban por datos del usuario.
 *
 * El síntoma se veía en la app: abrir Salud enseñaba 2.519 pasos, y al volver
 * un rato después 3.458. Nadie había andado. Y el «Score de recuperación» se
 * calculaba con ese sueño falso, así que el número que la app da como
 * indicación de cómo estás salía de un dado.
 *
 * No hay dato hasta que alguien lo registra. Un cero honesto se puede rellenar;
 * un número inventado no se puede distinguir de uno real.
 */

interface HealthTrackerState {
  stepHistory: StepEntry[]
  heartRateHistory: HeartRateEntry[]
  sleepHistory: SleepEntry[]
  todaySteps: number
  isTrackingSteps: boolean
  stepGoal: number
  sleepGoal: number
  hrGoal: { min: number; max: number }
  load: () => Promise<void>
  addSteps: (steps: number) => void
  setTodaySteps: (steps: number) => void
  logHeartRate: (bpm: number, type: HeartRateEntry['type']) => void
  /** `quality` opcional: si va, es la percibida y manda; si no, se deduce de las horas. */
  logSleep: (entry: Omit<SleepEntry, 'totalHours' | 'quality' | 'qualitySource' | 'deepSleepHours' | 'remSleepHours'>
    & { quality?: SleepEntry['quality'] }) => void
  startStepTracking: () => void
  stopStepTracking: () => void
  getTodaySummary: () => DailyHealthSummary
  getWeeklySummary: () => DailyHealthSummary[]
  getAvgHeartRate: (date?: string) => number | null
  getRestingHeartRate: (date?: string) => number | null
  getSleepForDate: (date: string) => SleepEntry | null
  getStepsForDate: (date: string) => StepEntry | null
  getTodayProgress: () => { registrado: boolean; steps: number; pct: number; calories: number; km: number; activeMin: number }
}

export const useHealthTrackerStore = create<HealthTrackerState>()(
  persist(
    (set, get) => ({
      stepHistory: [],
      heartRateHistory: [],
      sleepHistory: [],
      todaySteps: 0,
      isTrackingSteps: false,
      stepGoal: 10000,
      sleepGoal: 8,
      hrGoal: { min: 50, max: 90 },

      load: async () => {},

      addSteps: (steps) => {
        // Sobre los de hoy, no sobre el arrastre del último día registrado.
        get().setTodaySteps((pasosDeHoy(get().stepHistory)?.steps ?? 0) + steps)
      },

      setTodaySteps: (steps) => {
        const date = today()
        const entry: StepEntry = {
          date,
          steps,
          caloriesBurned: stepsToCalories(steps),
          distanceKm: stepsToKm(steps),
          activeMinutes: Math.floor(steps / 100),
        }
        set(s => ({
          todaySteps: steps,
          stepHistory: [
            entry,
            ...s.stepHistory.filter(e => e.date !== date),
          ].slice(0, 90),
        }))
      },

      logHeartRate: (bpm, type) => {
        const entry: HeartRateEntry = {
          timestamp: new Date().toISOString(),
          bpm,
          type,
        }
        set(s => ({
          heartRateHistory: [entry, ...s.heartRateHistory].slice(0, 500),
        }))
      },

      logSleep: (sleepData) => {
        const bedH = parseInt(sleepData.bedtime.split(':')[0])
        const bedM = parseInt(sleepData.bedtime.split(':')[1])
        const wakeH = parseInt(sleepData.wakeTime.split(':')[0])
        const wakeM = parseInt(sleepData.wakeTime.split(':')[1])
        let totalMins = (wakeH * 60 + wakeM) - (bedH * 60 + bedM)
        if (totalMins < 0) totalMins += 1440
        const totalHours = Math.round((totalMins / 60) * 10) / 10

        /* Manda lo que diga quien durmió. La duración solo decide cuando nadie
           lo ha dicho, y entonces queda marcada como deducida: ocho horas en
           blanco mirando el techo no son un sueño excelente, y ese era el
           veredicto que salía de mirar solo el reloj. */
        const quality: SleepEntry['quality'] = sleepData.quality ?? (
          totalHours >= 7.5 ? 'excellent' :
          totalHours >= 6.5 ? 'good' :
          totalHours >= 5.5 ? 'fair' : 'poor'
        )

        const entry: SleepEntry = {
          date: sleepData.date,
          bedtime: sleepData.bedtime,
          wakeTime: sleepData.wakeTime,
          totalHours,
          quality,
          qualitySource: sleepData.quality ? 'declarada' : 'derivada',
          deepSleepHours: null,
          remSleepHours: null,
        }
        set(s => ({
          sleepHistory: [entry, ...s.sleepHistory.filter(e => e.date !== sleepData.date)].slice(0, 90),
        }))
      },

      startStepTracking: () => set({ isTrackingSteps: true }),
      stopStepTracking: () => set({ isTrackingSteps: false }),

      getTodaySummary: () => {
        const hoy = pasosDeHoy(get().stepHistory)
        const todaySleep = get().getSleepForDate(today())
        return {
          date: today(),
          steps: hoy?.steps ?? null,
          caloriesBurned: hoy?.caloriesBurned ?? null,
          distanceKm: hoy?.distanceKm ?? null,
          activeMinutes: hoy?.activeMinutes ?? null,
          avgHeartRate: get().getAvgHeartRate(today()),
          restingHeartRate: get().getRestingHeartRate(),
          sleepHours: todaySleep?.totalHours ?? null,
          sleepQuality: todaySleep?.quality ?? null,
        }
      },

      getWeeklySummary: () => {
        const { stepHistory, sleepHistory } = get()
        return Array.from({ length: 7 }, (_, i) => {
          const date = haceDias(i)
          /* La columna de hoy salía de `todaySteps` en vez del historial, que es
             como se colaba el arrastre del último día registrado en el día de
             hoy. El historial ya tiene la entrada de hoy si existe. */
          const step = stepHistory.find(e => e.date === date)
          const sleep = sleepHistory.find(e => e.date === date)
          return {
            date,
            steps: step?.steps ?? null,
            caloriesBurned: step?.caloriesBurned ?? null,
            distanceKm: step?.distanceKm ?? null,
            activeMinutes: step?.activeMinutes ?? null,
            avgHeartRate: get().getAvgHeartRate(date),
            restingHeartRate: get().getRestingHeartRate(date),
            sleepHours: sleep?.totalHours ?? null,
            sleepQuality: sleep?.quality ?? null,
          }
        })
      },

      /**
       * SIN PULSACIONES NO HAY PULSO, Y SE DICE.
       *
       * Aquí había un `return 72` y en el de abajo un `return 65`, que se
       * disparaban justo cuando no había ninguna medición. No eran valores por
       * defecto inofensivos: el 65 entraba en el score de recuperación
       * (recoveryStore) y salía convertido en un «70 · Score de hoy» en verde,
       * a 40 px, en una app recién instalada que no había medido nada. El
       * usuario leía que estaba recuperado al 70 %, y el texto de ayuda de al
       * lado remataba diciendo que el número venía «de sueño y frecuencia
       * cardíaca» —dándole procedencia falsa a una constante.
       *
       * Un número medio y creíble es peor que un hueco: el hueco se ve, y el
       * número se cree.
       */
      /**
       * Un pico no entra en una media.
       *
       * Esto promediaba los tres tipos juntos y la pantalla lo rotulaba «BPM
       * promedio hoy». Un pico de 180 tomado al acabar de correr y un reposo de
       * 55 de por la mañana dan 118: un número que no le ha pasado al corazón de
       * nadie en todo el día. No estaba inventado —los dos extremos son reales—
       * pero la etiqueta le daba un significado que no tiene, que es el mismo
       * vicio por el que se han quitado el 72 y el 65.
       *
       * Un pico es por definición un extremo, y los extremos se miran aparte.
       */
      getAvgHeartRate: (date) => {
        const { heartRateHistory } = get()
        const sinPicos = heartRateHistory.filter(e => e.type !== 'peak')
        const entries = date
          ? sinPicos.filter(e => diaLocalDe(e.timestamp) === date)
          : sinPicos.slice(0, 10)
        if (!entries.length) return null
        return Math.round(entries.reduce((sum, e) => sum + e.bpm, 0) / entries.length)
      },

      /**
       * El `date` es nuevo, y arregla algo que el fallback tapaba.
       *
       * Sin fecha responde por los últimos siete registros —el pulso en reposo
       * de estos días—, que es lo que quiere la portada. Pero `getWeeklySummary`
       * lo llamaba SIN fecha para cada uno de los siete días, así que pintaba el
       * pulso de hoy en el martes pasado y en el lunes anterior: una línea plana
       * que parecía una semana medida y era el mismo dato repetido siete veces.
       */
      getRestingHeartRate: (date) => {
        const resting = get().heartRateHistory.filter(e => e.type === 'resting')
        /**
         * Siete DÍAS, no siete registros.
         *
         * `slice(0, 7)` cogía los siete últimos apuntes sin mirar cuándo se
         * hicieron, y el historial guarda hasta 500 y se persiste. Con una sola
         * medición de hace tres meses y ninguna desde entonces, la pantalla
         * seguía anunciando «FC en reposo actual: 62 BPM» indefinidamente, con
         * su etiqueta «Atlético» al lado. No es un número inventado: es uno
         * caducado presentado como de ahora, que engaña igual.
         *
         * Y de paso el score de recuperación no volvía a dar null nunca, así que
         * el estado «sin datos» era inalcanzable para cualquiera que se hubiera
         * medido una vez en su vida.
         */
        const desde = haceDias(VENTANA_PULSO_DIAS)
        const entries = date
          ? resting.filter(e => diaLocalDe(e.timestamp) === date)
          : resting.filter(e => diaLocalDe(e.timestamp) >= desde)
        if (!entries.length) return null
        return Math.round(entries.reduce((s, e) => s + e.bpm, 0) / entries.length)
      },

      getSleepForDate: (date) => {
        return get().sleepHistory.find(e => e.date === date) ?? null
      },

      /**
       * `null` significa SIN REGISTRAR, y no es lo mismo que cero.
       *
       * Antes, para hoy devolvía siempre un objeto —aunque nadie hubiera
       * apuntado nada— así que quien lo pintaba no tenía forma de distinguir
       * «no hay dato» de «anduve 0 pasos». Con datos inventados de fondo daba
       * igual; ahora que el historial arranca vacío, es la diferencia entre una
       * gráfica honesta y una llena de ceros que parecen medidos.
       */
      getStepsForDate: (date) => get().stepHistory.find(e => e.date === date) ?? null,

      getTodayProgress: () => {
        const { stepGoal } = get()
        const hoy = pasosDeHoy(get().stepHistory)
        const steps = hoy?.steps ?? 0
        return {
          /** Si nadie lo ha apuntado hoy, no hay progreso que enseñar. */
          registrado: hoy != null,
          steps,
          // La guarda del cero evita un 'NaN%' de anchura si la meta llegara a 0.
          pct: stepGoal > 0 ? Math.min(100, Math.round((steps / stepGoal) * 100)) : 0,
          calories: stepsToCalories(steps),
          km: stepsToKm(steps),
          activeMin: Math.floor(steps / 100),
        }
      },
    }),
    {
      name: 'zencrus-health-tracker',
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * Versión 1: se tira lo que había guardado.
       *
       * Sin esto el arreglo no llegaría a nadie que ya tenga la app: el estado
       * inicial solo se usa la PRIMERA vez, y a partir de ahí manda lo que hay
       * en disco — que es justamente la semana inventada. Cambiar el código sin
       * migrar habría dejado los números falsos exactamente donde estaban.
       *
       * Se descarta todo el historial en vez de intentar salvar algo: no hay
       * forma de saber qué entradas eran inventadas y cuáles se registraron a
       * mano después, y conservar un dato dudoso es peor que empezar limpio.
       * Los objetivos sí se conservan, que esos sí los eligió el usuario.
       */
      version: 1,
      migrate: (guardado: any, versionPrevia: number) => {
        if (versionPrevia >= 1) return guardado
        return {
          ...guardado,
          stepHistory: [],
          heartRateHistory: [],
          sleepHistory: [],
          todaySteps: 0,
        }
      },
    }
  )
)
