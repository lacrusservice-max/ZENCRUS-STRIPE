/**
 * El icono de racha, conectado.
 *
 * Va aparte de `IconoRacha` para que ese componente siga siendo solo dibujo:
 * así se puede colocar en una maqueta o en otra pantalla pasándole los números
 * a mano, sin arrastrar el store detrás.
 */

import { useEffect } from 'react'
import { useStreakStore } from '@/store/streakStore'
import { useAuthStore } from '@/store/authStore'
import { IconoRacha } from './IconoRacha'

export function RachaFlotante() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const { currentStreak, getTodayActivity, load } = useStreakStore()

  useEffect(() => { if (isAuthenticated) void load() }, [isAuthenticated])

  if (!isAuthenticated) return null

  const hoy = getTodayActivity()
  const encendida = hoy.loggedFood || hoy.loggedWorkout || hoy.checkInDone

  return <IconoRacha dias={currentStreak} encendida={encendida} />
}
