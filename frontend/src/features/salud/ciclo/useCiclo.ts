/**
 * EL CICLO, YA CALCULADO
 * ═══════════════════════════════════════════════════════════════════════════
 * Un solo sitio donde el registro crudo se convierte en lo que las pantallas
 * enseñan: periodos, fase, predicción, estadísticas y señales.
 *
 * ── Por qué un hook y no cálculo en cada pantalla ──────────────────────────
 * Porque si cada pantalla deriva sus propios periodos, tarde o temprano dos de
 * ellas discrepan —la cinta dice día 21 y el calendario día 22— y ese es el
 * tipo de fallo que destruye la confianza en un módulo de salud. Aquí se
 * calcula una vez y todas leen lo mismo.
 *
 * ── El coste está medido ───────────────────────────────────────────────────
 * Derivar dos años de registro es recorrer unas 800 claves. Se memoiza contra
 * `logs`, `inicios` y el modo, así que solo se rehace cuando algo cambia de
 * verdad, no en cada render.
 */

import { useMemo } from 'react'
import { useCicloStore } from '@/store/cicloStore'
import { hoyLocal } from '@/utils/fechas'
import { PHASES, mixPhases, nextPhase, type PhaseTokens } from '@/theme/salud/tokens'
import { derivarPeriodos, type Periodo, type SangradoIntermenstrual } from './periodos'
import {
  estadisticas, predecir, marcoFases,
  type Estadisticas, type Prediccion, type MarcoFases,
} from './prediccion'
import { detectarAnomalias, type Anomalia } from './anomalias'
import { MODO, type Modo } from './modos'

export interface EstadoCiclo {
  /** `false` hasta que hay al menos un periodo del que partir. */
  hayDatos: boolean
  periodos: Periodo[]
  intermenstrual: SangradoIntermenstrual[]
  estadisticas: Estadisticas
  /** `null` sin historial, o en los modos que no predicen. */
  prediccion: Prediccion | null
  anomalias: Anomalia[]
  modo: Modo
  /**
   * El marco de fases. Sale de la predicción cuando la hay; si no, del ciclo
   * de referencia, y entonces `hayDatos` es false y la pantalla lo dice.
   */
  marco: MarcoFases
  /** Tema de hoy, ya interpolado con la fase siguiente. */
  tema: PhaseTokens
  /** Días que faltan para el día probable. Negativo si ya pasó. */
  faltan: number | null
}

export function useCiclo(fecha?: string): EstadoCiclo {
  const logs = useCicloStore(s => s.logs)
  const inicios = useCicloStore(s => s.inicios)
  const modoId = useCicloStore(s => s.perfil.modo)
  /* Dos selectores de números sueltos y NO uno que devuelva `{duracion,
     sangrado}`.
     Un selector que construye un objeto devuelve uno NUEVO en cada llamada;
     Zustand los compara con `Object.is`, así que siempre le parece que cambió,
     vuelve a renderizar, vuelve a construirlo… y React corta con «Maximum
     update depth exceeded». El síntoma no señala aquí: la pila apuntaba a un
     `AsyncStorage.getItem` de otro store. */
  const duracionDeclarada = useCicloStore(s => s.perfil.duracionDeclarada ?? null)
  const sangradoDeclarado = useCicloStore(s => s.perfil.sangradoDeclarado ?? null)

  return useMemo(() => {
    const hoy = fecha ?? hoyLocal()
    const modo = MODO[modoId]
    const { periodos, intermenstrual } = derivarPeriodos(logs, inicios)
    const est = estadisticas(periodos)

    /* El modo decide si se predice. En embarazo o sin ciclo no hay nada que
       predecir y forzar un número sería peor que el hueco: ver modos.ts. */
    const prediccion = modo.predice
      ? predecir(periodos, {
        hoy,
        sinOvulacion: !modo.ovula,
        declarado: { duracion: duracionDeclarada, sangrado: sangradoDeclarado },
      })
      : null

    const marco = prediccion?.marco
      ?? marcoFases(
        est.media ?? duracionDeclarada ?? 28,
        est.mediaSangrado ?? sangradoDeclarado ?? 5,
      )

    const anomalias = periodos.length
      ? detectarAnomalias({
        periodos, estadisticas: est, intermenstrual, hoy,
        diaProbable: prediccion?.proximoPeriodo.likely ?? null,
        margenDias: prediccion?.margenDias ?? 3,
      })
      : []

    /* El tema se desliza dentro de la fase en vez de saltar el día del cambio:
       un ciclo es continuo y el color también. */
    const fase = prediccion?.fase ?? 'folicular'
    const inicioFase = marco.limites[fase]
    const sig = nextPhase(fase)
    const finFase = marco.limites[sig] > inicioFase
      ? marco.limites[sig]
      : marco.duracion + marco.limites.menstrual
    const dia = prediccion?.diaDeCiclo ?? inicioFase
    const t = Math.max(0, Math.min(1, (dia - inicioFase) / Math.max(1, finFase - inicioFase)))
    const tema = prediccion ? mixPhases(fase, sig, t) : PHASES.folicular

    return {
      hayDatos: periodos.length > 0,
      periodos,
      intermenstrual,
      estadisticas: est,
      prediccion,
      anomalias,
      modo,
      marco,
      tema,
      faltan: prediccion
        ? marco.duracion - prediccion.diaDeCiclo + 1
        : null,
    }
  }, [logs, inicios, modoId, fecha, duracionDeclarada, sangradoDeclarado])
}
