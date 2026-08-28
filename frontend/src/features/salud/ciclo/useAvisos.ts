/**
 * MANTENER LOS AVISOS AL DÍA
 * ═══════════════════════════════════════════════════════════════════════════
 * Traduce el estado del ciclo a las fechas que necesitan los recordatorios y
 * los reprograma cuando algo cambia.
 *
 * ── Va en el layout del módulo, no en la pantalla de ajustes ───────────────
 * Los avisos que cuelgan de la predicción caducan en cuanto ella registra
 * sangrado: el día probable se mueve y el «faltan dos días» que estaba
 * programado pasa a ser mentira. Si esto viviera en la pantalla de ajustes,
 * solo se corregiría cuando entrara ahí — que es casi nunca, porque los
 * ajustes se tocan una vez y no se vuelven a mirar. En el layout se corrige al
 * abrir el módulo y después de cada guardado, que es cuando de verdad cambia.
 *
 * ── La ventana fértil que se avisa es la PRÓXIMA ───────────────────────────
 * Si la de este ciclo ya pasó, la siguiente no es «dentro de un mes» a ojo:
 * son los mismos días de ciclo contados desde el próximo periodo previsto. Sin
 * eso, avisar de la ventana fértil solo funcionaría durante la primera mitad
 * del ciclo y a partir de ahí se callaría sin decir por qué.
 */

import { useEffect } from 'react'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from './useCiclo'
import { sincronizarAvisos, type ContextoAvisos } from './avisos'
import { hoyLocal, sumarDias } from '@/utils/fechas'

export function useAvisosDelCiclo(activo: boolean): void {
  const avisos = useCicloStore(s => s.avisos)
  const cargado = useCicloStore(s => s.cargado)
  const { prediccion, marco, modo } = useCiclo()

  useEffect(() => {
    /* Sin haber leído el disco todavía, `prediccion` es null y se cancelarían
       los avisos buenos para volver a ponerlos medio segundo después. */
    if (!activo || !cargado) return

    const proximoPeriodo = prediccion?.proximoPeriodo.likely ?? null

    /* El primer día de la ventana fértil que aún no ha pasado. La de este
       ciclo si queda por delante; si no, la del siguiente, contada desde el
       próximo periodo previsto. */
    let inicioFertil: string | null = null
    if (prediccion && modo.ovula) {
      const [desde] = marco.ventanaFertil
      const deEsteCiclo = sumarDias(hoyLocal(), desde - prediccion.diaDeCiclo)
      inicioFertil = deEsteCiclo > hoyLocal()
        ? deEsteCiclo
        : proximoPeriodo
          ? sumarDias(proximoPeriodo, desde - 1)
          : null
    }

    const ctx: ContextoAvisos = { proximoPeriodo, inicioFertil, predice: modo.predice }
    void sincronizarAvisos(avisos, ctx)
  }, [activo, cargado, avisos, prediccion, marco, modo])
}
