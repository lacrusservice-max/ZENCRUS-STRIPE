/**
 * ENTRENAMIENTO, PARA EL RESTO DE LA APP
 * ──────────────────────────────────────
 * Tres pantallas de fuera de Entrena necesitan saber cuatro cosas del
 * entrenamiento: si se ha entrenado hoy, qué se hizo, y los totales de siempre.
 *
 * Antes lo leían del historial que el store guardaba en el teléfono. Ese
 * historial ya no existe —lo realizado vive en el servidor— y sin este hook las
 * tres se habrían quedado enseñando ceros para siempre, que es la forma más
 * silenciosa de romper algo.
 *
 * ── Por qué un hook y no un store ───────────────────────────────────────────
 * Porque no hay nada que compartir ni que mantener sincronizado: cada pantalla
 * pregunta al entrar y pinta lo que le devuelven. Un store añadiría un estado
 * global que puede quedarse viejo, para ahorrar tres peticiones que el
 * limitador de `/api/workout` ni nota.
 */

import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { getResumen, Resumen } from '@/services/statsService'

export interface EntrenoResumen {
  /** null mientras se pide o si no se pudo. */
  datos: Resumen | null
  cargando: boolean
  /** ¿Hay un entrenamiento terminado hoy? Lo decide el servidor. */
  entrenadoHoy: boolean
}

/**
 * El resumen de entrenamiento, refrescado al entrar en la pantalla.
 *
 * `useFocusEffect` y no `useEffect`: se vuelve a estas pantallas justo después
 * de terminar un entrenamiento, y con `useEffect` seguirían diciendo que hoy no
 * se ha entrenado hasta cerrar la app.
 */
export function useEntrenoResumen(dias = 400): EntrenoResumen {
  const [datos, setDatos] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(true)

  useFocusEffect(useCallback(() => {
    let vivo = true
    getResumen(dias)
      .then(r => { if (vivo) setDatos(r) })
      .catch(() => { if (vivo) setDatos(null) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [dias]))

  return { datos, cargando, entrenadoHoy: datos?.entrenadoHoy ?? false }
}
