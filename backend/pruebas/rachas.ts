/**
 * LAS RACHAS, SOBRE SERIES ESCRITAS A MANO
 *
 * Sin base de datos: es aritmética de calendario, y ahí es donde se esconden
 * los errores. Cada caso describe una situación que un usuario puede vivir, no
 * un número que resultó estar bien.
 */

import { calcularRachas, sumarDias, DiaActividad } from '../src/services/streaks'
import { ok, igual, seccion } from './apoyo'

type Marca = 'comida' | 'entreno' | 'checkin' | 'agua' | 'protegido'

const dia = (date: string, ...marcas: Marca[]): DiaActividad => ({
  date,
  loggedFood: marcas.includes('comida'),
  loggedWorkout: marcas.includes('entreno'),
  checkInDone: marcas.includes('checkin'),
  drankWater: marcas.includes('agua'),
  protegido: marcas.includes('protegido'),
})

export function pruebasDeRachas(): void {
  seccion('Aritmética de fechas')

  igual(sumarDias('2098-01-01', -1), '2097-12-31', 'cruza el año hacia atrás')
  igual(sumarDias('2098-02-28', 1), '2098-03-01', 'febrero de año no bisiesto')
  igual(sumarDias('2096-02-28', 1), '2096-02-29', 'febrero de año bisiesto')
  igual(sumarDias('2098-10-25', -1), '2098-10-24', 'el domingo del cambio de hora')
  igual(sumarDias('2098-08-12', 0), '2098-08-12', 'sumar cero no mueve nada')

  let f = '2098-01-01'
  for (let i = 0; i < 365; i++) f = sumarDias(f, 1)
  igual(f, '2099-01-01', 'encadenar 365 días no se desvía')

  seccion('Rachas')

  igual(
    calcularRachas([], '2098-03-10'),
    { current: 0, longest: 0, totalActive: 0, lastActiveDate: null },
    'sin actividad, todo a cero',
  )

  igual(
    calcularRachas([
      dia('2098-03-06', 'comida'),
      dia('2098-03-07', 'entreno'),
      dia('2098-03-08', 'checkin'),
      dia('2098-03-09', 'comida'),
      dia('2098-03-10', 'comida'),
    ], '2098-03-10').current,
    5,
    'cinco días seguidos hasta hoy',
  )

  // El día no ha terminado: quien abre la app por la mañana no puede ver un cero.
  igual(
    calcularRachas([
      dia('2098-03-08', 'comida'),
      dia('2098-03-09', 'comida'),
    ], '2098-03-10').current,
    2,
    'hoy todavía vacío: la racha se cuenta desde ayer',
  )

  igual(
    calcularRachas([
      dia('2098-03-07', 'comida'),
      dia('2098-03-08', 'comida'),
    ], '2098-03-10').current,
    0,
    'dos días sin nada rompen la racha',
  )

  igual(
    calcularRachas([
      dia('2098-03-06', 'comida'),
      dia('2098-03-07', 'comida'),
      // el 8 falta entero
      dia('2098-03-09', 'comida'),
      dia('2098-03-10', 'comida'),
    ], '2098-03-10').current,
    2,
    'un hueco sin proteger corta la cadena',
  )

  const conProtector = [
    dia('2098-03-06', 'comida'),
    dia('2098-03-07', 'comida'),
    dia('2098-03-08', 'protegido'),
    dia('2098-03-09', 'comida'),
    dia('2098-03-10', 'comida'),
  ]
  igual(calcularRachas(conProtector, '2098-03-10').current, 5, 'un protector mantiene la cadena viva')
  igual(calcularRachas(conProtector, '2098-03-10').totalActive, 4, 'pero el día protegido no cuenta como activo')

  igual(
    calcularRachas([
      dia('2098-03-10', 'agua'),
      dia('2098-03-09', 'agua'),
    ], '2098-03-10'),
    { current: 0, longest: 0, totalActive: 0, lastActiveDate: null },
    'ocho vasos de agua no son un día de trabajo',
  )

  // La mejor racha puede estar meses atrás: es el motivo por el que el endpoint
  // lee el histórico entero aunque solo pinte doce semanas.
  const conRecordViejo = [
    ...Array.from({ length: 12 }, (_, i) => dia(sumarDias('2098-01-01', i), 'entreno')),
    dia('2098-03-09', 'comida'),
    dia('2098-03-10', 'comida'),
  ]
  igual(calcularRachas(conRecordViejo, '2098-03-10').longest, 12, 'el récord viejo sobrevive')
  igual(calcularRachas(conRecordViejo, '2098-03-10').current, 2, 'la racha en curso es la de ahora')
  igual(calcularRachas(conRecordViejo, '2098-03-10').totalActive, 14, 'los días activos se suman todos')
  igual(calcularRachas(conRecordViejo, '2098-03-10').lastActiveDate, '2098-03-10', 'el último día activo')

  igual(
    calcularRachas(
      Array.from({ length: 9 }, (_, i) => dia(sumarDias('2098-03-02', i), 'comida')),
      '2098-03-10',
    ).longest,
    9,
    'la racha en curso cuenta como mejor racha',
  )

  igual(
    calcularRachas([
      dia('2098-03-09', 'comida'),
      dia('2098-03-07', 'comida'),
      dia('2098-03-10', 'comida'),
      dia('2098-03-08', 'comida'),
    ], '2098-03-10').current,
    4,
    'las filas desordenadas dan lo mismo',
  )

  igual(
    calcularRachas([
      dia('2098-03-10', 'comida'),
      dia('2098-03-15', 'comida'),
    ], '2098-03-10').current,
    1,
    'un día futuro suelto no alarga la racha actual',
  )

  ok(true, '(fin de las pruebas de rachas)')
}
