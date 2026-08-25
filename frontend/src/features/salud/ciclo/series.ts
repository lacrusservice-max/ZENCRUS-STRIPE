/**
 * LAS SERIES QUE SE CRUZAN CON EL CICLO
 * ═══════════════════════════════════════════════════════════════════════════
 * Reúne, de todo lo que ZENCRUS ya sabe del día a día, lo que se puede leer
 * contra la fase del ciclo: entrenamiento, comida, descanso y check-in.
 *
 * ── Esta es la mitad que a las apps de ciclo les falta ─────────────────────
 * Flo, Clue y Ovia tienen el ciclo y no tienen nada de esto. Aquí ya estaba
 * todo: las sesiones en `/workout/sessions`, las kcal en disco por día, el
 * sueño y los pasos en `healthTrackerStore`, el check-in en `recoveryStore`.
 * Este archivo no captura ningún dato nuevo; solo pone en la misma tabla lo
 * que llevaba meses guardado en cinco sitios distintos.
 *
 * ── Un día, un número ──────────────────────────────────────────────────────
 * Cada serie se reduce a un valor por día porque el ciclo se cuenta en días.
 * Dos sesiones el mismo día se suman en volumen y se promedian en esfuerzo: el
 * volumen es una cantidad y el esfuerzo es una valoración, y sumar
 * valoraciones no significa nada.
 *
 * ── Los días sin dato NO son ceros ─────────────────────────────────────────
 * Un día sin entrenar no es «volumen 0», es un día sin dato, y no aparece en
 * el mapa. Meterlo como cero hundiría la media de la fase que caiga en semana
 * de descanso y la app «descubriría» un efecto que solo es el calendario de
 * entrenamiento. Es el mismo error que ya se corrigió en el sueño derivado.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { aFechaLocal, sumarDias, hoyLocal } from '@/utils/fechas'
import { useHealthTrackerStore } from '@/store/healthTrackerStore'
import { useRecoveryStore } from '@/store/recoveryStore'
import { listarSesiones } from '@/services/sessionService'
import type { Serie } from './correlacion'

/** Cuánto se mira hacia atrás. Un año da para doce ciclos y no satura memoria. */
const DIAS = 365

/** Añade a un acumulador por fecha. */
const sumar = (m: Record<string, number>, f: string, v: number) => {
  m[f] = (m[f] ?? 0) + v
}

export async function reunirSeries(): Promise<Serie[]> {
  const series: Serie[] = []

  // ── Entrenamiento ─────────────────────────────────────────────────────
  try {
    const r = await listarSesiones({ limit: 300 })
    const sesiones = (r as any)?.sessions ?? (Array.isArray(r) ? r : [])

    const volumen: Record<string, number> = {}
    const esfuerzoSuma: Record<string, number> = {}
    const esfuerzoCuenta: Record<string, number> = {}
    const minutos: Record<string, number> = {}

    for (const s of sesiones) {
      if (s.status !== 'completed' || !s.started_at) continue
      // La fecha del reloj de quien entrenó, no la de Greenwich.
      const f = aFechaLocal(new Date(s.started_at))
      if (s.total_volume_kg) sumar(volumen, f, s.total_volume_kg)
      if (s.duration_seconds) sumar(minutos, f, s.duration_seconds / 60)
      if (s.perceived_effort != null) {
        sumar(esfuerzoSuma, f, s.perceived_effort)
        sumar(esfuerzoCuenta, f, 1)
      }
    }

    if (Object.keys(volumen).length) {
      series.push({
        metric: 'volumen_kg', label: 'Tu volumen de entrenamiento',
        unidad: 'kg', valores: volumen, direccion: 'mas_es_mejor',
      })
    }
    if (Object.keys(minutos).length) {
      series.push({
        metric: 'minutos_entreno', label: 'Los minutos que entrenas',
        unidad: 'min', valores: minutos, direccion: 'neutro',
      })
    }
    const esfuerzo: Record<string, number> = {}
    for (const f of Object.keys(esfuerzoSuma)) {
      // Promedio, no suma: dos sesiones de esfuerzo 7 no hacen un día de 14.
      esfuerzo[f] = esfuerzoSuma[f] / esfuerzoCuenta[f]
    }
    if (Object.keys(esfuerzo).length) {
      series.push({
        metric: 'esfuerzo', label: 'Lo que te cuesta entrenar',
        valores: esfuerzo, direccion: 'neutro',
      })
    }
  } catch {
    /* Sin red no hay entrenamiento que cruzar, y la pantalla lo dirá con lo
       que falta. No es motivo para dejarla en blanco. */
  }

  // ── Nutrición ─────────────────────────────────────────────────────────
  try {
    const hoy = hoyLocal()
    const fechas = Array.from({ length: DIAS }, (_, i) => sumarDias(hoy, -i))
    const pares = await AsyncStorage.multiGet(fechas.map(f => `nutrition_${f}`))

    const kcal: Record<string, number> = {}
    const proteina: Record<string, number> = {}
    for (const [clave, raw] of pares) {
      if (!raw) continue
      const f = clave.replace('nutrition_', '')
      try {
        const d = JSON.parse(raw)
        let c = 0, p = 0
        for (const comida of d.meals ?? []) {
          for (const e of comida.entries ?? []) {
            if (e.active === false) continue
            c += e.calories ?? 0
            p += e.protein ?? 0
          }
        }
        // Un día abierto y sin nada apuntado no es un día de cero kcal.
        if (c > 0) { kcal[f] = c; proteina[f] = p }
      } catch { /* un día ilegible no puede tumbar el resto */ }
    }

    if (Object.keys(kcal).length) {
      series.push({
        metric: 'kcal', label: 'Lo que comes', unidad: 'kcal',
        valores: kcal, direccion: 'neutro',
      })
      series.push({
        metric: 'proteina', label: 'Tu proteína', unidad: 'g',
        valores: proteina, direccion: 'neutro',
      })
    }
  } catch { /* idem */ }

  // ── Sueño y pasos ─────────────────────────────────────────────────────
  const salud = useHealthTrackerStore.getState()

  const sueno: Record<string, number> = {}
  for (const e of salud.sleepHistory ?? []) {
    if (e.date && e.totalHours) sueno[e.date] = e.totalHours
  }
  if (Object.keys(sueno).length) {
    series.push({
      metric: 'sueno_horas', label: 'Lo que duermes', unidad: 'h',
      valores: sueno, direccion: 'mas_es_mejor',
    })
  }

  const pasos: Record<string, number> = {}
  for (const e of salud.stepHistory ?? []) {
    if (e.date && e.steps) pasos[e.date] = e.steps
  }
  if (Object.keys(pasos).length) {
    series.push({
      metric: 'pasos', label: 'Los pasos que das',
      valores: pasos, direccion: 'mas_es_mejor',
    })
  }

  // ── Check-in de recuperación ──────────────────────────────────────────
  const rec = useRecoveryStore.getState().entries ?? {}
  const energia: Record<string, number> = {}
  const dolorMuscular: Record<string, number> = {}
  const estres: Record<string, number> = {}
  for (const f of Object.keys(rec)) {
    const e: any = rec[f]
    if (e?.energy != null) energia[f] = e.energy
    if (e?.soreness != null) dolorMuscular[f] = e.soreness
    if (e?.stress != null) estres[f] = e.stress
  }
  if (Object.keys(energia).length) {
    series.push({
      metric: 'energia_checkin', label: 'Tu energía al despertar',
      valores: energia, direccion: 'mas_es_mejor',
    })
  }
  if (Object.keys(dolorMuscular).length) {
    series.push({
      metric: 'agujetas', label: 'Cómo recuperas del entreno',
      valores: dolorMuscular, direccion: 'mas_es_mejor',
    })
  }
  if (Object.keys(estres).length) {
    series.push({
      metric: 'estres', label: 'Tu estrés',
      valores: estres, direccion: 'neutro',
    })
  }

  return series
}
