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
 */

import { useEffect, useRef } from 'react'
import { usePathname } from 'expo-router'
import { registrar } from './cola'
import { rutaSinParametros, seccionDeRuta } from '@/nucleo/telemetria/eventos'

/**
 * Registra cada cambio de pantalla. Se llama UNA vez, en el layout raíz.
 */
export function useTelemetriaNavegacion(): void {
  const ruta = usePathname()
  const anterior = useRef<{ ruta: string; desde: number } | null>(null)

  useEffect(() => {
    if (!ruta) return

    const limpia = rutaSinParametros(ruta)
    const ahora = Date.now()

    /* La pantalla que se deja: aquí es donde se sabe cuánto duró. */
    const previa = anterior.current
    if (previa && previa.ruta !== limpia) {
      registrar('pantalla_dejada', seccionDeRuta(previa.ruta), {
        pantalla: previa.ruta,
        props: { ms: ahora - previa.desde },
      })
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
