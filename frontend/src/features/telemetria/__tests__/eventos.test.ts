/**
 * La garantía del módulo, probada con lo que de verdad se registra en el ciclo.
 *
 * Si alguna de estas pruebas se pone en rojo, no es un fallo de estilo: es que
 * un dato de salud puede salir del teléfono.
 */

import { sanear, rutaSinParametros, CLAVES_PERMITIDAS_SENSIBLES } from '@/nucleo/telemetria/eventos'
import type { Evento } from '@/nucleo/telemetria/eventos'

const base = (e: Partial<Evento>): Evento => ({
  nombre: 'control_usado', seccion: 'salud', props: {},
  ocurrioEn: '2026-08-28T07:00:00.000Z', sesionId: 's1', ...e,
})

describe('de salud no sale ni un valor', () => {
  it('tira el nivel de sangrado y se queda con QUÉ control se usó', () => {
    const r = sanear(base({ props: { tracker: 'sangrado', nivel: 4, level: 4, valor: 4 } }))
    expect(r.props).toEqual({ tracker: 'sangrado' })
  })

  it('tira los síntomas, las zonas de dolor y las notas', () => {
    const r = sanear(base({
      props: {
        tracker: 'dolor', zonas: 'abdomen_bajo,ovarios', intensity: 8,
        sintoma: 'nauseas', nota: 'me dolió mucho hoy', animo: -1,
      },
    }))
    expect(r.props).toEqual({ tracker: 'dolor' })
  })

  /* El caso realista: alguien mete el registro entero «para depurar». */
  it('tira un registro completo colado en props', () => {
    const r = sanear(base({
      props: {
        sangrado: JSON.stringify({ level: 5 }),
        temperatura_basal: 36.7,
        fecha: '2026-08-26',
      },
    }))
    expect(r.props).toEqual({})
  })

  it('lo que sí pasa es la forma del flujo', () => {
    const r = sanear(base({
      props: { tracker: 'dolor', paso: 2, total_pasos: 4, resultado: 'abandonado', ms: 1830 },
    }))
    expect(r.props).toEqual({ tracker: 'dolor', paso: 2, total_pasos: 4, resultado: 'abandonado', ms: 1830 })
  })

  it('la lista blanca no lleva ninguna clave de contenido', () => {
    const prohibidas = /valor|nivel|level|sintoma|zona|nota|intens|celsius|temperatura|animo|fecha/i
    for (const c of CLAVES_PERMITIDAS_SENSIBLES) expect(c).not.toMatch(prohibidas)
  })
})

describe('fuera de salud se es menos estricto, pero no ingenuo', () => {
  it('admite claves libres', () => {
    const r = sanear(base({ seccion: 'entrena', props: { ejercicio: 'sentadilla', series: 4 } }))
    expect(r.props).toEqual({ ejercicio: 'sentadilla', series: 4 })
  })

  it('sigue tirando objetos y texto largo, que es como se escapan las cosas', () => {
    const r = sanear(base({
      seccion: 'social',
      props: {
        ok: true,
        objeto: { a: 1 } as never,
        mensaje: 'x'.repeat(200),
      },
    }))
    expect(r.props).toEqual({ ok: true })
  })
})

describe('la ruta no cuenta lo que hizo', () => {
  it('quita los parámetros: la fecha del registro es un dato', () => {
    expect(rutaSinParametros('/salud/ciclo/registrar?fecha=2026-08-26'))
      .toBe('/salud/ciclo/registrar')
  })

  it('anonimiza fechas e identificadores metidos en la propia ruta', () => {
    expect(rutaSinParametros('/salud/ciclo/dia/2026-08-26')).toBe('/salud/ciclo/dia/:id')
    expect(rutaSinParametros('/social/post/8f14e45fceea167a5a36dedd')).toBe('/social/post/:id')
  })

  it('deja intacto lo que sí interesa saber', () => {
    expect(rutaSinParametros('/salud/ciclo/estadisticas')).toBe('/salud/ciclo/estadisticas')
  })

  it('la limpia también dentro del evento', () => {
    const r = sanear(base({ pantalla: '/salud/ciclo/registrar?fecha=2026-08-26' }))
    expect(r.pantalla).toBe('/salud/ciclo/registrar')
  })
})

describe('las dos fechas', () => {
  it('el evento lleva cuándo PASÓ, no cuándo se envió', () => {
    const r = sanear(base({ ocurrioEn: '2026-08-28T06:12:00.000Z' }))
    expect(r.ocurrioEn).toBe('2026-08-28T06:12:00.000Z')
  })
})

// ── La derivación de sección ────────────────────────────────────────────────

import { seccionDeRuta } from '@/nucleo/telemetria/eventos'

describe('de qué sección es cada ruta', () => {
  /* Esta es la prueba con más peso del fichero. Si una ruta de salud se
     derivara a otra sección, se le aplicaría el filtro flojo y sus props
     dejarían de pasar por la lista blanca. */
  it.each([
    '/salud', '/salud/ciclo', '/salud/ciclo/registrar', '/salud/ciclo/estadisticas',
    '/salud/ciclo/informe', '/salud/ciclo/hoy', '/SALUD/Ciclo',
  ])('%s es salud', ruta => {
    expect(seccionDeRuta(ruta)).toBe('salud')
  })

  it.each([
    ['/workout', 'entrena'],
    ['/workout/sesion', 'entrena'],
    ['/(tabs)/nutrition', 'nutricion'],
    ['/recipe/123', 'nutricion'],
    ['/social', 'social'],
    ['/aire-libre/running', 'aire_libre'],
    ['/(tabs)/chat', 'zena'],
    ['/(auth)/login', 'acceso'],
    ['/(onboarding)/paso1', 'acceso'],
  ] as const)('%s es %s', (ruta, esperada) => {
    expect(seccionDeRuta(ruta)).toBe(esperada)
  })

  /* Esto lo destapó el primer dato real: `/` caía en el caso por defecto,
     que era 'perfil', y mezclaba el tráfico de la portada con el del perfil
     sin forma de separarlos. Una sección real como cajón de sastre corrompe
     el eje por el que más se va a agrupar. */
  it('la portada es su propia sección, no perfil', () => {
    expect(seccionDeRuta('/')).toBe('inicio')
    expect(seccionDeRuta('/(tabs)')).toBe('inicio')
  })

  it('el perfil de verdad sigue siendo perfil', () => {
    expect(seccionDeRuta('/(tabs)/profile')).toBe('perfil')
  })

  it('una ruta desconocida va al cajón, no a una sección real', () => {
    expect(seccionDeRuta('/algo/que/no/existe')).toBe('otra')
  })

  /* El caso que de verdad importa: una ruta de salud que además contiene una
     palabra de otra sección sigue siendo salud, porque se comprueba primero. */
  it('salud gana aunque la ruta mencione otra sección', () => {
    expect(seccionDeRuta('/salud/ciclo/correlaciones?con=workout')).toBe('salud')
  })
})
