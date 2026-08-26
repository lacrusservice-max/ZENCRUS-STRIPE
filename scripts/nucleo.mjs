#!/usr/bin/env node
/**
 * EL NÚCLEO COMPARTIDO: COPIAR Y VIGILAR
 * ═══════════════════════════════════════════════════════════════════════════
 * Copia `nucleo/ciclo/` dentro de la app y del servidor, y comprueba que las
 * copias no se hayan tocado.
 *
 *     node scripts/nucleo.mjs            copia
 *     node scripts/nucleo.mjs --verificar falla si algo difiere
 *
 * ── Por qué se copia en vez de compartirse de verdad ───────────────────────
 * Es lo primero que se piensa —un paquete en `node_modules` y listo— y aquí no
 * se puede, por tres motivos que no dependen de las ganas:
 *
 *   1. El servidor compila con `rootDir: ./src`. tsc se niega a compilar nada
 *      de fuera, y ampliarlo cambia dónde cae `dist/server.js`, que es
 *      literalmente lo que Railway arranca. Tocarlo es arriesgar producción
 *      para ahorrar una copia.
 *   2. La ruta del proyecto lleva un espacio —«APP C+E»— y eso ya rompe dos
 *      scripts del build de iOS. Una dependencia `file:../nucleo` con un
 *      espacio en medio es pedir problemas donde menos se ven.
 *   3. Metro necesita `watchFolders` y alias para salir de `frontend/`, y ese
 *      camino se rompe en los builds donde solo se sube esa carpeta.
 *
 * ── Y entonces, ¿qué se gana? ──────────────────────────────────────────────
 * Lo que se quería: que la lógica se ESCRIBA una sola vez y que separarla sea
 * imposible sin enterarse. Las copias llevan una cabecera que dice que son
 * generadas, y `--verificar` está enganchado al `type-check` de los dos lados:
 * editar la copia equivocada no compila. Es más tosco que un paquete y
 * consigue lo mismo sin poner en riesgo el despliegue.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEN = join(RAIZ, 'nucleo', 'ciclo')

const DESTINOS = [
  join(RAIZ, 'frontend', 'src', 'nucleo', 'ciclo'),
  join(RAIZ, 'backend', 'src', 'nucleo', 'ciclo'),
]

/**
 * La cabecera de las copias.
 *
 * Va con la ruta de la fuente y el comando exacto, porque quien abra el
 * archivo por un salto del editor no tiene por qué saber que esto existe.
 */
const marca = (archivo) => `/* ─────────────────────────────────────────────────────────────────────────
 * ARCHIVO GENERADO — NO LO EDITES AQUÍ
 *
 * La fuente es  nucleo/ciclo/${archivo}
 * Para cambiarlo: edita ahí y corre  npm run nucleo
 *
 * Existe copiado porque la app y el servidor los compilan cadenas distintas
 * que no pueden leer una carpeta común. El motivo largo está en
 * scripts/nucleo.mjs.
 * ───────────────────────────────────────────────────────────────────────── */

`

const verificar = process.argv.includes('--verificar')

const archivos = readdirSync(ORIGEN).filter(f => f.endsWith('.ts'))
if (!archivos.length) {
  console.error('nucleo: no hay nada en nucleo/ciclo')
  process.exit(1)
}

const problemas = []
let copiados = 0

for (const destino of DESTINOS) {
  if (!verificar) mkdirSync(destino, { recursive: true })

  for (const archivo of archivos) {
    const esperado = marca(archivo) + readFileSync(join(ORIGEN, archivo), 'utf8')
    const ruta = join(destino, archivo)

    if (verificar) {
      if (!existsSync(ruta)) {
        problemas.push(`FALTA   ${rel(ruta)}`)
        continue
      }
      if (readFileSync(ruta, 'utf8') !== esperado) problemas.push(`DIFIERE ${rel(ruta)}`)
    } else {
      // Solo se escribe si cambió: así el vigilante de Metro no recarga la app
      // cada vez que alguien corre el script sin haber tocado nada.
      if (!existsSync(ruta) || readFileSync(ruta, 'utf8') !== esperado) {
        writeFileSync(ruta, esperado)
        copiados++
        console.log(`  ↳ ${rel(ruta)}`)
      }
    }
  }
}

function rel(p) {
  return p.slice(RAIZ.length + 1)
}

if (verificar) {
  if (problemas.length) {
    console.error('\n✖ El núcleo compartido está descuadrado:\n')
    problemas.forEach(p => console.error(`   ${p}`))
    console.error(`
   Alguien editó una copia en vez de la fuente, o cambió la fuente sin copiar.

   Si el cambio bueno está en nucleo/ciclo/ :   npm run nucleo
   Si está en una copia: muévelo a nucleo/ciclo/ y luego  npm run nucleo
`)
    process.exit(1)
  }
  console.log('✓ El núcleo compartido cuadra en los dos lados.')
} else {
  console.log(copiados
    ? `✓ Núcleo copiado (${copiados} ${copiados === 1 ? 'archivo' : 'archivos'}).`
    : '✓ Núcleo ya estaba al día.')
}
