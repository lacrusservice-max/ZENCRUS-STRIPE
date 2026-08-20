/**
 * El icono de racha, conectado — y la forma de volver a ver la celebración.
 *
 * Va aparte de `IconoRacha` para que ese componente siga siendo solo dibujo:
 * así se puede colocar en una maqueta pasándole los números a mano, sin
 * arrastrar el store detrás.
 *
 * ── Mantener pulsado la reproduce ───────────────────────────────────────────
 * La celebración salta una vez al día y se va sola a los diez segundos. Eso
 * está bien para quien usa la app, y es un incordio para quien la construye o
 * quiere enseñarla: hay que esperar a mañana. Con la pulsación larga se ve
 * cuando se quiera, y —esto es lo importante— NO gasta el candado del día: es
 * una repetición, no la celebración de verdad.
 */

import { useEffect, useState } from 'react'
import { useStreakStore } from '@/store/streakStore'
import { useAuthStore } from '@/store/authStore'
import { useRachaDelDia } from '@/hooks/useRachaDelDia'
import { IconoRacha } from './IconoRacha'
import { RachaEncendida } from './RachaEncendida'

export function RachaFlotante() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const { currentStreak, getTodayActivity, load } = useStreakStore()
  const { semana } = useRachaDelDia()
  const [repetir, setRepetir] = useState(false)

  useEffect(() => { if (isAuthenticated) void load() }, [isAuthenticated])

  if (!isAuthenticated) return null

  const hoy = getTodayActivity()
  const encendida = hoy.loggedFood || hoy.loggedWorkout || hoy.checkInDone

  return (
    <>
      <IconoRacha
        dias={currentStreak}
        encendida={encendida}
        onRepetir={() => setRepetir(true)}
      />
      <RachaEncendida
        visible={repetir}
        dias={currentStreak}
        semana={semana}
        onCerrar={() => setRepetir(false)}
      />
    </>
  )
}
