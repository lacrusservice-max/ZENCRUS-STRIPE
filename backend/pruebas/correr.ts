/**
 * Corre las tres suites seguidas y devuelve un solo marcador.
 *
 * Van en este orden y en el mismo proceso a propósito: la contaminación entre
 * suites —una que deja algo escrito y a la siguiente le cuadran mal las
 * cuentas— solo aparece si se ejecutan juntas. Cuando cada una corría por su
 * lado, un fallo así pasaba desapercibido hasta la segunda vuelta.
 *
 *   npm run test:e2e
 */

import { pruebasDeRachas } from './rachas'
import { pruebasDeTracking } from './tracking'
import { pruebasDeMigracion } from './migracion'
import { pruebasDeConfirmaciones } from './confirmaciones'
import { pruebasDeCatalogo } from './catalogo'
import { pruebasDeCuidado } from './cuidado'
import { pruebasDeDescomposicion } from './descomposicion'
import { resumen, limpiar } from './apoyo'

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗')
  console.log('║  PRUEBAS e2e · /tracking y confirmaciones de ZENA             ║')
  console.log('║  Escriben en la base REAL con fechas centinela de 2098.      ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  pruebasDeRachas()
  await pruebasDeTracking()
  await pruebasDeMigracion()
  await pruebasDeConfirmaciones()
  await pruebasDeCatalogo()
  await pruebasDeCuidado()
  await pruebasDeDescomposicion()

  const fallidas = resumen()
  process.exit(fallidas === 0 ? 0 : 1)
}

main().catch(async err => {
  console.error('\nSe rompió antes de terminar:', err)
  // Que un fallo a mitad no deje filas centinela en producción.
  await limpiar().catch(() => {})
  resumen()
  process.exit(1)
})
