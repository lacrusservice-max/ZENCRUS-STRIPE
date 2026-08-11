/**
 * REFRESCO EN VIVO
 * ────────────────
 * Vuelve a pedir algo cada cierto tiempo mientras la pantalla está delante Y la
 * app en primer plano. En cuanto se cumple una de las dos, para.
 *
 * ── Por qué esto y no websockets ────────────────────────────────────────────
 * Un socket obligaría a autenticar la conexión aparte del JWT, a mantenerla
 * viva contra un servidor que se duerme, y a reconectar a mano cada vez que el
 * teléfono cambia de red. Para un chat entre dos personas en una app de
 * gimnasio, pedir cada pocos segundos mientras la conversación está abierta da
 * el mismo resultado visible con una fracción de las piezas que se pueden
 * romper. Cuando haga falta algo más —salas, escritura en directo, presencia—
 * el sitio donde cambiarlo es este archivo.
 *
 * ── Las dos condiciones no son un adorno ────────────────────────────────────
 * Sin `AppState`, la app seguiría pidiendo con el teléfono en el bolsillo:
 * gasta batería, gasta datos y agota el limitador del servidor sin que nadie
 * esté mirando. Sin el foco, una conversación cerrada seguiría refrescándose
 * detrás de la que estás leyendo.
 */

import { useCallback, useEffect, useRef } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { useFocusEffect } from 'expo-router'

export function useLivePoll(
  tarea: () => void | Promise<void>,
  cada: number,
  activo = true,
): void {
  // La tarea se guarda en una referencia para que cambiarla —cosa que pasa en
  // cada render— no reinicie el reloj y acabe no disparándose nunca.
  const fn = useRef(tarea)
  fn.current = tarea

  const reloj = useRef<ReturnType<typeof setInterval> | null>(null)
  const enCurso = useRef(false)

  const parar = useCallback(() => {
    if (reloj.current) { clearInterval(reloj.current); reloj.current = null }
  }, [])

  const arrancar = useCallback(() => {
    if (reloj.current || !activo) return
    reloj.current = setInterval(async () => {
      // Si la anterior aún no ha vuelto, se salta el turno. Con la red lenta,
      // encadenar peticiones que se pisan deja la lista parpadeando.
      if (enCurso.current) return
      enCurso.current = true
      try { await fn.current() } catch { /* el que llama ya decide qué enseñar */ }
      finally { enCurso.current = false }
    }, cada)
  }, [cada, activo, parar])

  useFocusEffect(useCallback(() => {
    if (!activo) return
    arrancar()

    const sub = AppState.addEventListener('change', (estado: AppStateStatus) => {
      if (estado === 'active') {
        // Al volver del bolsillo se pide YA, sin esperar al siguiente turno:
        // si no, se ven unos segundos de conversación vieja.
        fn.current()
        arrancar()
      } else {
        parar()
      }
    })

    return () => { parar(); sub.remove() }
  }, [arrancar, parar, activo]))

  useEffect(() => parar, [parar])
}
