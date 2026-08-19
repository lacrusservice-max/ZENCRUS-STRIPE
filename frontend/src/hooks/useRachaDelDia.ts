/**
 * CUÁNDO SE ENCIENDE LA RACHA
 * ═══════════════════════════
 * Una vez al día, en el PRIMER gesto que cuenta. Da igual cuál sea: apuntar una
 * comida, empezar la rutina o terminar un ejercicio.
 *
 * ── Por qué «el primero» y no «cada uno» ────────────────────────────────────
 * Porque quien desayuna y luego entrena haría dos gestos que cuentan el mismo
 * día, y vería la misma celebración dos veces en una mañana. La segunda ya no
 * celebra nada: interrumpe. Y a la tercera se aprende a darle a «Continuar» sin
 * mirar, que es la forma de matar una recompensa.
 *
 * ── Y por qué el candado va en disco ────────────────────────────────────────
 * En memoria bastaría para una sesión, pero la app se cierra y se reabre veinte
 * veces al día. Un candado que se olvida al cerrar es un candado que no cierra:
 * volvería a saltar en la comida, y en la cena.
 *
 * El propio `markActivity` del store de rachas es idempotente, así que llamarlo
 * de más no suma días. Lo que hay que controlar aquí es solo la CELEBRACIÓN.
 */

import { useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useStreakStore, type DailyActivity } from '@/store/streakStore'
import { hoyLocal } from '@/utils/fechas'

const CLAVE = 'zencrus-racha-celebrada'

/** Qué gestos encienden el día. */
export type Gesto = 'loggedFood' | 'loggedWorkout'

export function useRachaDelDia() {
  const { currentStreak, weekActivity, markActivity, load } = useStreakStore()
  const [visible, setVisible] = useState(false)
  const [celebradoHoy, setCelebradoHoy] = useState<string | null>(null)

  useEffect(() => {
    void AsyncStorage.getItem(CLAVE).then(v => setCelebradoHoy(v))
  }, [])

  /**
   * Se llama después de un gesto que cuenta. Marca el día y, si es el primero
   * de hoy, enciende la pantalla.
   *
   * Devuelve si celebró, por si quien llama quiere encadenar algo detrás.
   */
  const registrarGesto = useCallback(async (gesto: Gesto): Promise<boolean> => {
    const hoy = hoyLocal()
    await markActivity(hoy, { [gesto]: true } as Partial<DailyActivity>)

    /* Se relee de disco en vez de fiarse del estado: entre que se montó el hook
       y ahora pueden haber pasado horas —y hasta un cambio de día— o haberlo
       celebrado otra pantalla. */
    const ya = await AsyncStorage.getItem(CLAVE)
    if (ya === hoy) return false

    await AsyncStorage.setItem(CLAVE, hoy)
    setCelebradoHoy(hoy)
    setVisible(true)
    return true
  }, [markActivity])

  const cerrar = useCallback(() => {
    setVisible(false)
    /* Al cerrar se recarga: la racha que se acaba de encender tiene que verse
       ya en el icono de la cabecera, sin esperar a la siguiente apertura. */
    void load()
  }, [load])

  /**
   * De la semana del store a siete casillas de lunes a domingo.
   *
   * `weekActivity` viene en días naturales hacia atrás desde hoy, así que el
   * primero no es lunes: hay que colocarlos por su fecha, o la fila diría que
   * cumpliste el lunes cuando fue el jueves.
   */
  const semana = (() => {
    const casillas = Array<boolean>(7).fill(false)
    for (const d of weekActivity ?? []) {
      const [a, m, dd] = d.date.split('-').map(Number)
      const js = new Date(a, m - 1, dd).getDay()      // 0 = domingo
      const idx = (js + 6) % 7                        // 0 = lunes
      casillas[idx] = d.loggedFood || d.loggedWorkout || d.checkInDone
    }
    return casillas
  })()

  return {
    visible,
    dias: currentStreak,
    semana,
    yaCelebradoHoy: celebradoHoy === hoyLocal(),
    registrarGesto,
    cerrar,
  }
}
