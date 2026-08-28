/**
 * EL INFORME PARA CONSULTA
 * ═══════════════════════════════════════════════════════════════════════════
 * Un papel que se imprime y se lleva a una consulta hereda la autoridad del
 * sitio donde se enseña. Lo que hay que garantizar no es el formato: es que
 * diga de dónde vienen sus números y que no cuele una estimación entre las
 * medidas.
 */

import { construirInforme, informeHTML, fechaLarga, type EntradaInforme } from '../informe'
import type { Periodo } from '../periodos'
import type { Estadisticas } from '../prediccion'

const est: Estadisticas = {
  ciclos: 3, usados: 3, media: 28.3, mediana: 28, desviacion: 1.2,
  masCorto: 27, masLargo: 30, mediaSangrado: 4.5, regularidad: 'regular',
}

const periodos: Periodo[] = [
  { inicio: '2026-06-02', fin: '2026-06-06', diasSangrado: 5, duracionCiclo: 28, declarado: false },
  { inicio: '2026-06-30', fin: '2026-07-04', diasSangrado: 4, duracionCiclo: 30, declarado: true },
  { inicio: '2026-07-30', fin: null, diasSangrado: 4, duracionCiclo: null, declarado: false },
]

const base: EntradaInforme = {
  hoy: '2026-08-27',
  nombre: 'Ana',
  modo: 'Seguimiento',
  anticonceptivo: null,
  periodos,
  estadisticas: est,
  anomalias: [],
  fechasRegistradas: ['2026-06-02', '2026-06-30', '2026-07-30'],
  sintomas: [{ etiqueta: 'Cólicos', dias: 7, de: 12 }],
  temperatura: [],
}

const inf = (e: Partial<EntradaInforme> = {}) => construirInforme({ ...base, ...e })
const html = (e: Partial<EntradaInforme> = {}) => informeHTML(inf(e))

describe('el informe dice qué es', () => {
  it('avisa de que no es una historia clínica ni un diagnóstico', () => {
    const h = html().toLowerCase()
    /* Se normalizan los espacios: el aviso ocupa varias líneas en el HTML y
       comparar con saltos de línea dentro haría que un reajuste del formato
       rompiera una prueba que es sobre lo que DICE, no sobre cómo se envuelve. */
    const plano = h.replace(/\s+/g, ' ')
    expect(plano).toContain('no son una historia clínica')
    expect(plano).toContain('ninguna cifra de este documento es un diagnóstico')
  })

  it('dice explícitamente que no lleva predicciones', () => {
    expect(html()).toContain('no incluye ninguna predicción')
  })

  it('y por construcción no puede llevarlas', () => {
    /* La entrada no tiene ningún campo de predicción, así que no hay forma de
       que se cuele una sin cambiar el tipo. Esta prueba existe para que el
       día que alguien añada `proximoPeriodo` a `EntradaInforme` tenga que
       venir aquí y decidirlo a propósito. */
    const claves = Object.keys(base)
    for (const prohibida of ['prediccion', 'proximoPeriodo', 'ventanaFertil', 'marco']) {
      expect(claves).not.toContain(prohibida)
    }
  })

  it('dice que se generó sin sacar los datos del teléfono', () => {
    expect(html()).toContain('no salieron del dispositivo')
  })
})

describe('lo medido y lo reconstruido se distinguen', () => {
  it('cada ciclo dice si el inicio lo puso ella o lo dedujo la app', () => {
    const h = html()
    expect(h).toContain('lo indicó ella')
    expect(h).toContain('deducido del registro')
    expect(h).toContain('puede estar')   // la advertencia del desfase
  })

  it('el ciclo en curso no inventa una duración', () => {
    /* El último periodo no sabe cuánto dura hasta que empiece el siguiente.
       Rellenarlo con la media sería guardar una estimación como si fuera un
       hecho, justo en la tabla que alguien va a leer como hechos. */
    expect(inf().ciclos[0].duracion).toBeNull()
    expect(html()).toContain('en curso')
  })

  it('los porcentajes de síntomas dicen sobre cuántos días se calculan', () => {
    const h = html()
    expect(h).toContain('7 de 12')
    expect(h).toContain('58 %')
    expect(h).toContain('no sobre los días transcurridos')
  })
})

describe('el orden y el contenido', () => {
  it('los ciclos van del más reciente al más antiguo', () => {
    expect(inf().ciclos.map(c => c.inicio))
      .toEqual(['2026-07-30', '2026-06-30', '2026-06-02'])
  })

  it('las señales de consulta van primero y traen su pregunta', () => {
    const r = inf({
      anomalias: [
        { tipo: 'irregularidad', mensaje: 'Informativa', nivel: 'informativa' },
        { tipo: 'ciclo_corto', mensaje: 'De consulta', nivel: 'consulta', pregunta: '¿Es normal?' },
      ],
    })
    expect(r.senales[0]).toMatchObject({ mensaje: 'De consulta', consulta: true })
    expect(informeHTML(r)).toContain('¿Es normal?')
  })

  it('el rango de fechas sale del primer y último día registrado', () => {
    const r = inf()
    expect(r.desde).toBe('2026-06-02')
    expect(r.hasta).toBe('2026-07-30')
    expect(r.diasRegistrados).toBe(3)
  })

  it('sin datos no se inventa un rango', () => {
    const r = inf({ fechasRegistradas: [], periodos: [] })
    expect(r.desde).toBeNull()
    expect(informeHTML(r)).toContain('Sin datos registrados')
  })
})

describe('la temperatura', () => {
  const lecturas = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      fecha: `2026-07-${String(i + 1).padStart(2, '0')}`,
      celsius: 36.4 + i * 0.05,
      disturbed: false,
    }))

  it('con dos o más mediciones se dibuja la curva', () => {
    const h = html({ temperatura: lecturas(6) })
    expect(h).toContain('<svg')
    expect(h).toContain('Temperatura basal')
  })

  it('con una sola no se dibuja nada: una medición no es una curva', () => {
    const h = html({ temperatura: lecturas(1) })
    expect(h).not.toContain('<svg')
  })
})

describe('el texto que viene del registro no puede romper la hoja', () => {
  it('un nombre con etiquetas se escapa', () => {
    const h = html({ nombre: '<script>alert(1)</script>' })
    expect(h).not.toContain('<script>alert')
    expect(h).toContain('&lt;script&gt;')
  })

  it('y un ampersand también', () => {
    expect(html({ modo: 'Salud & ciclo' })).toContain('Salud &amp; ciclo')
  })
})

describe('las fechas no se van de zona horaria', () => {
  it('el 1 de enero se lee como el 1 de enero', () => {
    /* Con `new Date('2026-01-01')` el texto se interpreta como UTC y en México
       se imprime el 31 de diciembre. Se parte la cadena a mano. */
    expect(fechaLarga('2026-01-01')).toBe('1 de enero de 2026')
    expect(fechaLarga('2026-12-31')).toBe('31 de diciembre de 2026')
  })
})
