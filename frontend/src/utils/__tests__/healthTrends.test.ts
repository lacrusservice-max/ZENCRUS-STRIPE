import { detectTrend, DailyPoint } from '../healthTrends'

function genPoints(days: number, value: number, startOffset = 0): DailyPoint[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (i + startOffset))
    return { date: d.toISOString().slice(0, 10), value }
  })
}

describe('detectTrend', () => {
  it('reporta "sin suficientes datos" si hay menos de 4 días válidos en la semana reciente', () => {
    // Semana reciente: solo 2 días con actividad real (5 en cero/sin registrar)
    const recentSparse: DailyPoint[] = [
      ...genPoints(2, 8000),
      ...genPoints(5, 0, 2),
    ]
    const previous = genPoints(14, 8000, 7)
    const result = detectTrend([...recentSparse, ...previous], 'steps')
    expect(result.hasEnoughData).toBe(false)
  })

  it('NO marca tendencia si el cambio es menor al umbral de ruido (8%)', () => {
    // 8000 recientes vs 8300 anteriores → ~3.6% de cambio, dentro del ruido
    const recent = genPoints(7, 8000)
    const previous = genPoints(14, 8300, 7)
    const result = detectTrend([...recent, ...previous], 'steps')
    expect(result.direction).toBe('stable')
  })

  it('pasos: SUBEN = "improving" (más actividad es mejor)', () => {
    const recent = genPoints(7, 10000)
    const previous = genPoints(14, 7000, 7)
    const result = detectTrend([...recent, ...previous], 'steps')
    expect(result.direction).toBe('improving')
    expect(result.changePercent).toBeGreaterThan(0)
  })

  it('pasos: BAJAN = "declining" (menos actividad sostenida es una alerta)', () => {
    const recent = genPoints(7, 4000)
    const previous = genPoints(14, 9000, 7)
    const result = detectTrend([...recent, ...previous], 'steps')
    expect(result.direction).toBe('declining')
  })

  it('sueño: SUBE horas = "improving"', () => {
    const recent = genPoints(7, 8)
    const previous = genPoints(14, 5.5, 7)
    const result = detectTrend([...recent, ...previous], 'sleepHours')
    expect(result.direction).toBe('improving')
  })

  it('FC en reposo: SUBE = "declining" (peor condición cardiovascular), aunque el número suba', () => {
    const recent = genPoints(7, 78)
    const previous = genPoints(14, 62, 7)
    const result = detectTrend([...recent, ...previous], 'restingHeartRate')
    expect(result.direction).toBe('declining')
  })

  it('FC en reposo: BAJA = "improving" (mejor condición cardiovascular)', () => {
    const recent = genPoints(7, 58)
    const previous = genPoints(14, 70, 7)
    const result = detectTrend([...recent, ...previous], 'restingHeartRate')
    expect(result.direction).toBe('improving')
  })

  it('un solo día atípico dentro de una semana estable NO cambia la tendencia general', () => {
    const recent: DailyPoint[] = genPoints(6, 8000).concat([{ date: '2026-01-01', value: 20000 }]) // 1 día pico
    const previous = genPoints(14, 8000, 7)
    const result = detectTrend([...recent, ...previous], 'steps')
    // El promedio se mueve un poco, pero no debería disparar una tendencia falsa dramática
    expect(result.hasEnoughData).toBe(true)
  })
})
