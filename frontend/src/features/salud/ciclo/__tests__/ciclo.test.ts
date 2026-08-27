/**
 * PRUEBAS DEL MOTOR DE CICLO
 * ═══════════════════════════════════════════════════════════════════════════
 * Este es el único trozo del módulo donde un error no se ve. Una fase mal
 * pintada salta a la vista; una banda de predicción medio día estrecha, no —y
 * es la que alguien usa para decidir si se lleva compresas de viaje.
 *
 * Las pruebas van sobre casos que de verdad ocurren: la que se salta días de
 * registro, la que mancha a mitad de mes, la de ciclos de 34 días, la que
 * lleva tres meses sin regla.
 */

import { derivarPeriodos, diaDeCiclo } from '../periodos'
import { enVentanaFertil } from '@/nucleo/ciclo/fases'
import {
  estadisticas, predecir, marcoFases, faseDeDia,
  calcularConfianza, confianzaProyectada,
} from '../prediccion'
import {
  detectarCambioTermico, curvaTemperatura, type LecturaTemperatura,
} from '../temperatura'
import { detectarAnomalias } from '../anomalias'
import { sumarDias } from '@/utils/fechas'
import type { RegistroDia } from '@/store/cicloStore'

// ── Utilidades de las pruebas ───────────────────────────────────────────────

type Logs = Record<string, RegistroDia>

/** Marca `dias` de sangrado a partir de `inicio`. */
function sangrar(logs: Logs, inicio: string, dias = 5, nivel = 3): Logs {
  for (let i = 0; i < dias; i++) {
    logs[sumarDias(inicio, i)] = { ...(logs[sumarDias(inicio, i)] ?? {}), sangrado: { level: nivel } }
  }
  return logs
}

/** Un historial con ciclos de las duraciones dadas, empezando en `inicio`. */
function historial(inicio: string, duraciones: number[], diasSangrado = 5): Logs {
  const logs: Logs = {}
  let f = inicio
  sangrar(logs, f, diasSangrado)
  for (const d of duraciones) {
    f = sumarDias(f, d)
    sangrar(logs, f, diasSangrado)
  }
  return logs
}

// ── Derivar periodos ────────────────────────────────────────────────────────

describe('derivarPeriodos', () => {
  it('sin registros no inventa ningún periodo', () => {
    expect(derivarPeriodos({}).periodos).toEqual([])
  })

  it('reconoce un periodo simple y cuenta sus días de sangrado', () => {
    const { periodos } = derivarPeriodos(sangrar({}, '2026-03-01', 5))
    expect(periodos).toHaveLength(1)
    expect(periodos[0].inicio).toBe('2026-03-01')
    expect(periodos[0].diasSangrado).toBe(5)
  })

  it('separa dos periodos y calcula la duración del ciclo', () => {
    const { periodos } = derivarPeriodos(historial('2026-03-01', [28]))
    expect(periodos).toHaveLength(2)
    expect(periodos[0].duracionCiclo).toBe(28)
    // La del último no se sabe todavía y NO se rellena con la media.
    expect(periodos[1].duracionCiclo).toBeNull()
  })

  it('un día sin apuntar en mitad del periodo no lo parte en dos', () => {
    // Sangra los días 1, 2, 4 y 5: se saltó el 3. Es un solo periodo.
    const logs: Logs = {}
    for (const d of ['2026-03-01', '2026-03-02', '2026-03-04', '2026-03-05']) {
      logs[d] = { sangrado: { level: 3 } }
    }
    expect(derivarPeriodos(logs).periodos).toHaveLength(1)
  })

  it('el manchado no abre un periodo', () => {
    const logs = sangrar({}, '2026-03-01', 5)
    logs['2026-03-16'] = { sangrado: { level: 1 } }   // manchado de ovulación
    const { periodos } = derivarPeriodos(logs)
    expect(periodos).toHaveLength(1)
  })

  it('el sangrado a mitad de ciclo se aparta como intermenstrual, no como regla', () => {
    const logs = sangrar({}, '2026-03-01', 5)
    logs['2026-03-12'] = { sangrado: { level: 3 } }   // día 12: por debajo del mínimo
    const { periodos, intermenstrual } = derivarPeriodos(logs)
    expect(periodos).toHaveLength(1)
    expect(intermenstrual).toHaveLength(1)
    expect(intermenstrual[0].diaDeCiclo).toBe(12)
  })

  it('un inicio declarado a mano gana sobre la deducción', () => {
    const logs = sangrar({}, '2026-03-01', 5)
    const { periodos } = derivarPeriodos(logs, ['2026-03-10'])
    expect(periodos).toHaveLength(2)
    expect(periodos[1].inicio).toBe('2026-03-10')
    expect(periodos[1].declarado).toBe(true)
  })

  it('sitúa cualquier fecha en su día de ciclo', () => {
    const { periodos } = derivarPeriodos(historial('2026-03-01', [28]))
    expect(diaDeCiclo(periodos, '2026-03-01')).toBe(1)
    expect(diaDeCiclo(periodos, '2026-03-15')).toBe(15)
    expect(diaDeCiclo(periodos, '2026-03-29')).toBe(1)     // ya es el siguiente
    expect(diaDeCiclo(periodos, '2026-02-01')).toBeNull()  // antes de todo registro
  })
})

// ── Estadísticas ────────────────────────────────────────────────────────────

describe('estadisticas', () => {
  it('con un solo ciclo no inventa una desviación de cero', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28]))
    const e = estadisticas(periodos)
    expect(e.usados).toBe(1)
    expect(e.desviacion).toBeNull()
    expect(e.regularidad).toBe('sin_datos')
  })

  it('aparta del cálculo el ciclo imposible pero lo sigue contando', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 27, 75, 29]))
    const e = estadisticas(periodos)
    expect(e.ciclos).toBe(4)
    expect(e.usados).toBe(3)          // el de 75 días no entra
    expect(e.masLargo).toBe(29)
  })

  /* Cuatro niveles desde el prompt maestro: ≤2 muy regular · 3-4 regular ·
     5-7 algo irregular · >7 irregular. Antes eran tres y el ≤2 se llamaba
     «regular» a secas. */
  it('clasifica la regularidad en los cuatro niveles del documento', () => {
    const muyRegular = estadisticas(derivarPeriodos(historial('2026-01-01', [28, 28, 29, 27])).periodos)
    expect(muyRegular.regularidad).toBe('muy_regular')

    const dispersa = estadisticas(derivarPeriodos(historial('2026-01-01', [22, 35, 26, 40])).periodos)
    expect(dispersa.regularidad).toBe('irregular')
  })
})

// ── Predicción ──────────────────────────────────────────────────────────────

describe('predecir', () => {
  it('sin un solo periodo devuelve null en vez de la media poblacional', () => {
    expect(predecir([], { hoy: '2026-03-10' })).toBeNull()
  })

  /* CAMBIO DE CRITERIO del prompt maestro, y conviene tenerlo a la vista: a
     una usuaria «muy regular» (SD ≤ 2) se le da FECHA PUNTUAL, sin banda.
     Antes había un suelo de un día precisamente para no prometer nunca una
     fecha exacta. Ahora se promete cuando la dispersión medida lo justifica. */
  it('con un ciclo muy regular se da fecha puntual, sin banda', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 28, 28, 28, 28, 28]))
    const p = predecir(periodos, { hoy: '2026-06-10' })!
    expect(p.margenDias).toBe(0)
    expect(p.proximoPeriodo.low).toBe(p.proximoPeriodo.high)
  })

  it('y en cuanto hay dispersión, vuelve a haber banda', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [24, 31, 26, 34, 27]))
    const p = predecir(periodos, { hoy: '2026-06-10' })!
    expect(p.margenDias).toBeGreaterThanOrEqual(2)
    expect(p.proximoPeriodo.low).not.toBe(p.proximoPeriodo.high)
  })

  it('con menos ciclos la banda es MÁS ancha, no más estrecha', () => {
    const pocos = predecir(
      derivarPeriodos(historial('2026-01-01', [26, 31])).periodos,
      { hoy: '2026-03-01' },
    )!
    const muchos = predecir(
      derivarPeriodos(historial('2025-01-01', [26, 31, 26, 31, 26, 31, 26, 31])).periodos,
      { hoy: '2026-03-01' },
    )!
    expect(pocos.margenDias).toBeGreaterThan(muchos.margenDias)
  })

  it('la banda envuelve al día probable', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 30, 27]))
    const p = predecir(periodos, { hoy: '2026-04-01' })!
    expect(p.proximoPeriodo.low <= p.proximoPeriodo.likely).toBe(true)
    expect(p.proximoPeriodo.likely <= p.proximoPeriodo.high).toBe(true)
  })

  it('marca de dónde salió la duración', () => {
    const uno = predecir(derivarPeriodos(sangrar({}, '2026-03-01', 5)).periodos, { hoy: '2026-03-10' })!
    expect(uno.fuenteDuracion).toBe('poblacional')
    expect(uno.confianza).toBeLessThan(30)

    const varios = predecir(
      derivarPeriodos(historial('2026-01-01', [28, 28, 28])).periodos,
      { hoy: '2026-04-01' },
    )!
    expect(varios.fuenteDuracion).toBe('personal')
  })

  it('cuenta el retraso desde el día probable', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 28, 28]))
    const ultimo = periodos[periodos.length - 1].inicio
    const p = predecir(periodos, { hoy: sumarDias(ultimo, 33) })!
    expect(p.retraso).toBe(5)
  })

  it('en anticoncepción continua no predice ovulación y dice por qué', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 28, 28]))
    const p = predecir(periodos, { hoy: '2026-04-01', sinOvulacion: true })!
    expect(p.ovulacion).toBeNull()
    expect(p.ventanaFertil).toBeNull()
    expect(p.motivoSuprimido).toBeTruthy()
  })

  it('la banda de la ovulación es más ancha que la del periodo', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 30, 27]))
    const p = predecir(periodos, { hoy: '2026-04-01' })!
    const anchoPeriodo = p.margenDias * 2
    const anchoOv = Math.round(
      (new Date(p.ovulacion!.high).getTime() - new Date(p.ovulacion!.low).getTime()) / 86_400_000,
    )
    expect(anchoOv).toBeGreaterThan(anchoPeriodo)
  })
})

// ── Confianza ───────────────────────────────────────────────────────────────

describe('confianza', () => {
  it('sube con la muestra y baja con la dispersión', () => {
    expect(calcularConfianza(6, 1)).toBeGreaterThan(calcularConfianza(2, 1))
    expect(calcularConfianza(6, 1)).toBeGreaterThan(calcularConfianza(6, 5))
  })

  it('nunca llega a 100', () => {
    expect(calcularConfianza(50, 0)).toBeLessThanOrEqual(95)
  })

  it('sabe decir a cuánto subiría con dos ciclos más', () => {
    expect(confianzaProyectada(3, 2)).toBeGreaterThan(calcularConfianza(3, 2))
  })
})

// ── Fases ───────────────────────────────────────────────────────────────────

describe('marcoFases', () => {
  /* `Ovulación = C − 13`, la fórmula del prompt maestro. Antes se restaban 14.
     La tabla de referencia completa se comprueba en `marco.test.ts`. */
  it('en un ciclo de 28 días la ovulación es el día 15', () => {
    expect(marcoFases(28, 5).diaOvulacion).toBe(15)
  })

  it('en un ciclo de 34 días NO la fija en el día 14', () => {
    const m = marcoFases(34, 5)
    expect(m.diaOvulacion).toBe(21)
    expect(faseDeDia(14, m)).toBe('folicular')   // el 14 aún es folicular
    expect(faseDeDia(21, m)).toBe('ovulatoria')
  })

  it('en un ciclo corto la ovulación no cae dentro del sangrado', () => {
    const m = marcoFases(21, 6)
    expect(m.diaOvulacion).toBeGreaterThan(m.diasPeriodo)
  })

  /* La fase ovulatoria dura UN día —el de la ovulación—, no un tramo. La
     ventana fértil, que sí son seis días, es otra cosa y se consulta con
     `enVentanaFertil`. */
  it('las cuatro fases se recorren en orden', () => {
    const m = marcoFases(28, 5)
    expect(faseDeDia(1, m)).toBe('menstrual')
    expect(faseDeDia(8, m)).toBe('folicular')
    expect(faseDeDia(15, m)).toBe('ovulatoria')
    expect(faseDeDia(16, m)).toBe('lutea')
    expect(faseDeDia(25, m)).toBe('lutea')
  })

  it('la ventana fértil abarca seis días y se consulta aparte', () => {
    const m = marcoFases(28, 5)
    expect(enVentanaFertil(10, m)).toBe(true)   // Ov − 5
    expect(enVentanaFertil(16, m)).toBe(true)   // Ov + 1
    expect(enVentanaFertil(9, m)).toBe(false)
    expect(enVentanaFertil(17, m)).toBe(false)
    // Y un día fértil puede seguir siendo folicular: son ejes distintos.
    expect(faseDeDia(12, m)).toBe('folicular')
    expect(enVentanaFertil(12, m)).toBe(true)
  })
})

// ── Temperatura basal ───────────────────────────────────────────────────────

describe('cambio térmico', () => {
  const dia = (i: number) => sumarDias('2026-03-01', i)
  const curva = (temps: number[]): LecturaTemperatura[] =>
    temps.map((celsius, i) => ({ fecha: dia(i), celsius }))

  it('detecta el escalón de una curva bifásica', () => {
    const c = detectarCambioTermico(curva([
      36.40, 36.35, 36.42, 36.38, 36.40, 36.36,   // línea de cobertura: 36.47
      36.60, 36.65, 36.70,                         // tres altas, la última +0.23
    ]))
    expect(c).not.toBeNull()
    expect(c!.lineaCobertura).toBeCloseTo(36.47, 2)
    // La ovulación se sitúa el día ANTES de la primera subida.
    expect(c!.fechaOvulacion).toBe(dia(5))
    expect(c!.fechaConfirmacion).toBe(dia(8))
  })

  it('una curva plana no confirma nada', () => {
    expect(detectarCambioTermico(curva([
      36.40, 36.41, 36.39, 36.40, 36.42, 36.38, 36.40, 36.41, 36.39,
    ]))).toBeNull()
  })

  it('tres lecturas que solo rozan la línea no son un escalón', () => {
    expect(detectarCambioTermico(curva([
      36.40, 36.35, 36.42, 36.38, 36.40, 36.36,
      36.50, 36.51, 36.52,   // por encima, pero sin las dos décimas
    ]))).toBeNull()
  })

  it('la noche mala se aparta del cálculo', () => {
    const xs = curva([36.40, 36.35, 36.42, 36.38, 36.40, 36.36, 36.60, 36.65, 36.70])
    // Una fiebre metida en medio de la base rompería la línea de cobertura.
    const conFiebre = [...xs]
    conFiebre.splice(3, 0, { fecha: dia(20), celsius: 37.60, disturbed: true })
    expect(detectarCambioTermico(conFiebre)).not.toBeNull()
  })

  it('sin lecturas suficientes no arriesga una respuesta', () => {
    expect(detectarCambioTermico(curva([36.4, 36.5, 36.6]))).toBeNull()
  })

  it('la curva se entrega partida en las dos mesetas', () => {
    const c = curvaTemperatura(curva([
      36.40, 36.35, 36.42, 36.38, 36.40, 36.36, 36.60, 36.65, 36.70,
    ]))!
    expect(c.corte).toBe(6)
    expect(c.max).toBeGreaterThan(c.min)
  })
})

// ── Anomalías ───────────────────────────────────────────────────────────────

describe('anomalías', () => {
  const base = (logs: Record<string, RegistroDia>, hoy: string) => {
    const { periodos, intermenstrual } = derivarPeriodos(logs)
    const est = estadisticas(periodos)
    const p = predecir(periodos, { hoy })
    return detectarAnomalias({
      periodos, estadisticas: est, intermenstrual, hoy,
      diaProbable: p?.proximoPeriodo.likely ?? null,
      margenDias: p?.margenDias ?? 3,
    })
  }

  it('un solo ciclo largo es un mes raro, no un patrón', () => {
    const a = base(historial('2026-01-01', [28, 38, 28, 29]), '2026-05-10')
    expect(a.find(x => x.tipo === 'ciclo_largo')).toBeUndefined()
  })

  it('tres ciclos largos sí son un patrón', () => {
    const a = base(historial('2026-01-01', [38, 39, 40, 37]), '2026-06-01')
    const larga = a.find(x => x.tipo === 'ciclo_largo')
    expect(larga).toBeDefined()
    expect(larga!.nivel).toBe('consulta')
    expect(larga!.pregunta).toBeTruthy()
  })

  it('ninguna señal nombra una enfermedad', () => {
    const a = base(historial('2026-01-01', [38, 39, 40, 37]), '2026-06-01')
    const prohibidas = /sop|endometriosis|mioma|tiroiditis|diagn/i
    for (const x of a) expect(x.mensaje).not.toMatch(prohibidas)
  })

  it('avisa de la ausencia prolongada', () => {
    const a = base(sangrar({}, '2026-01-01', 5), '2026-05-01')
    expect(a.find(x => x.tipo === 'ausencia_prolongada')).toBeDefined()
  })

  it('el retraso se cuenta desde el borde de la banda, no desde el centro', () => {
    const logs = historial('2026-01-01', [28, 28, 28])
    const inicioUltimo = derivarPeriodos(logs).periodos.slice(-1)[0].inicio
    // Justo en el día probable: no hay retraso que anunciar.
    expect(base(logs, sumarDias(inicioUltimo, 28)).find(x => x.tipo === 'retraso')).toBeUndefined()
    // Bastante más allá del margen: ahora sí.
    expect(base(logs, sumarDias(inicioUltimo, 40)).find(x => x.tipo === 'retraso')).toBeDefined()
  })
})

// ── Correlación cruzada ─────────────────────────────────────────────────────

describe('correlación cruzada', () => {
  const { correlacionar, MIN_OBSERVACIONES, MIN_CICLOS } = require('../correlacion')
  const { marcoFases: marco } = require('../prediccion')

  /** Una serie con `valor` todos los días, y `valorLutea` en fase lútea. */
  function serieSintetica(
    periodos: any[], m: any, valor: number, valorLutea: number,
  ): Record<string, number> {
    const out: Record<string, number> = {}
    for (const p of periodos) {
      const dur = p.duracionCiclo ?? 0
      for (let d = 0; d < dur; d++) {
        const dia = d + 1
        const enLutea = dia >= m.limites.lutea
        out[sumarDias(p.inicio, d)] = enLutea ? valorLutea : valor
      }
    }
    return out
  }

  const m = marco(28, 5)

  it('no dice nada con un solo ciclo, por muy marcado que esté el patrón', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28]))
    const valores = serieSintetica(periodos, m, 100, 50)
    expect(correlacionar({
      series: [{ metric: 'fuerza', label: 'Tu fuerza', valores }],
      periodos, marco: m,
    })).toEqual([])
  })

  it('encuentra el efecto cuando hay ciclos y observaciones de sobra', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 28, 28, 28]))
    const valores = serieSintetica(periodos, m, 100, 90)
    const rs = correlacionar({
      series: [{ metric: 'fuerza', label: 'Tu fuerza', valores }],
      periodos, marco: m,
    })
    const lutea = rs.find((r: any) => r.phase === 'lutea')
    expect(lutea).toBeDefined()
    expect(lutea.efectoPct).toBeLessThan(0)
    expect(lutea.ciclos).toBeGreaterThanOrEqual(MIN_CICLOS)
    expect(lutea.n).toBeGreaterThanOrEqual(MIN_OBSERVACIONES)
  })

  it('con datos planos no inventa un efecto', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 28, 28, 28]))
    const valores = serieSintetica(periodos, m, 100, 100)
    const rs = correlacionar({
      series: [{ metric: 'plano', label: 'Plano', valores }],
      periodos, marco: m,
    })
    for (const r of rs) expect(r.claro).toBe(false)
  })

  it('el intervalo envuelve siempre al efecto', () => {
    const { periodos } = derivarPeriodos(historial('2026-01-01', [28, 28, 28, 28]))
    const valores = serieSintetica(periodos, m, 100, 80)
    for (const r of correlacionar({
      series: [{ metric: 'x', label: 'X', valores }], periodos, marco: m,
    })) {
      expect(r.ciLow).toBeLessThanOrEqual(r.efectoPct)
      expect(r.efectoPct).toBeLessThanOrEqual(r.ciHigh)
    }
  })
})
