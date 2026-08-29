/**
 * TELEMETRÍA · EL ENGANCHE
 * ═══════════════════════════════════════════════════════════════════════════
 * Un solo hook en el layout raíz y toda la navegación queda registrada. No hay
 * que tocar ni una pantalla.
 *
 * ── Por qué así y no llamando a `registrar()` en cada sitio ────────────────
 * Instrumentar a mano tiene dos problemas y el segundo es el grave. El
 * primero: son decenas de pantallas y hay que acordarse en cada una. El
 * segundo: las pantallas que nadie instrumenta son invisibles, y las que nadie
 * instrumenta suelen ser justo las que nadie mira porque a nadie le importan
 * — que es exactamente lo que queríamos descubrir. Un sistema que solo ve lo
 * que alguien decidió mirar confirma lo que ya se creía.
 *
 * Enganchado a la navegación, una pantalla nueva aparece en los datos el día
 * que existe, sin que nadie haga nada.
 *
 * ── Se mide el tiempo de la ANTERIOR ───────────────────────────────────────
 * Cuando se cambia de pantalla se sabe cuánto duró la que se deja, y ese es el
 * dato que dice si algo se usa o solo se cruza. La que está abierta ahora
 * mismo no tiene duración todavía, y se apunta al salir.
 *
 * ── El reloj se para en segundo plano ──────────────────────────────────────
 * Esto no estaba, y el primer evento real que llegó lo delató: 34.563.655 ms
 * en la pantalla de login, o sea nueve horas y media. Nadie mira un login
 * nueve horas: la app se quedó abierta ahí toda la noche.
 *
 * Sin parar el reloj, cada «tiempo en pantalla» lleva dentro lo que el
 * teléfono estuvo en un bolsillo, y la métrica deja de medir lo único que se
 * le pedía —qué pantallas retienen y cuáles se cruzan de paso—. Al irse a
 * segundo plano se apunta lo acumulado y se para; al volver, se reanuda.
 */

import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { usePathname } from 'expo-router'
import { registrar } from './cola'
import { rutaSinParametros, seccionDeRuta } from '@/nucleo/telemetria/eventos'

/**
 * Registra cada cambio de pantalla. Se llama UNA vez, en el layout raíz.
 */
export function useTelemetriaNavegacion(): void {
  const ruta = usePathname()
  const anterior = useRef<{ ruta: string; desde: number } | null>(null)

  /* Al fondo: se apunta lo que llevaba y se para el reloj. Al volver: se
     reanuda desde ahora, de modo que el rato en el bolsillo no cuenta. */
  useEffect(() => {
    const sub = AppState.addEventListener('change', estado => {
      const previa = anterior.current
      if (!previa) return

      if (estado !== 'active') {
        registrar('pantalla_dejada', seccionDeRuta(previa.ruta), {
          pantalla: previa.ruta,
          props: { ms: Date.now() - previa.desde, resultado: 'al_fondo' },
        })
        anterior.current = { ...previa, desde: 0 }
      } else if (previa.desde === 0) {
        anterior.current = { ...previa, desde: Date.now() }
      }
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!ruta) return

    const limpia = rutaSinParametros(ruta)
    const ahora = Date.now()

    /* La pantalla que se deja: aquí es donde se sabe cuánto duró. */
    const previa = anterior.current
    if (previa && previa.ruta !== limpia) {
      /* `desde === 0` significa que ya se apuntó al irse al fondo y el reloj
         está parado: volver directamente a otra pantalla no debe generar un
         segundo evento con una duración inventada desde el epoch. */
      if (previa.desde !== 0) {
        registrar('pantalla_dejada', seccionDeRuta(previa.ruta), {
          pantalla: previa.ruta,
          props: { ms: ahora - previa.desde },
        })
      }
    }

    if (!previa || previa.ruta !== limpia) {
      registrar('pantalla_vista', seccionDeRuta(limpia), {
        pantalla: limpia,
        props: previa ? { origen: previa.ruta } : {},
      })
      anterior.current = { ruta: limpia, desde: ahora }
    }
  }, [ruta])
}
