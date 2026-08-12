/**
 * SUBIR LA BIBLIOTECA A R2
 * ────────────────────────
 * Lleva los 206 vídeos y sus 206 pósters al bucket, bajo `library/`.
 *
 * ── Por qué `library/` y no `post/` ─────────────────────────────────────────
 * El resto del bucket son archivos DE alguien: `post/<usuario>/…`, y el backend
 * comprueba que la carpeta lleve tu identificador antes de dejarte usarlos.
 * Esto es contenido del catálogo, no de nadie: va en su propia raíz, y así
 * ninguna de esas comprobaciones se confunde ni hay que ablandarlas.
 *
 * ── Se puede volver a ejecutar ──────────────────────────────────────────────
 * Antes de subir cada fichero pregunta si ya está y con el mismo tamaño. Con
 * 437 MB por medio, un guion que hay que ejecutar de una sentada o empezar de
 * cero es un guion que falla la primera vez que se corta la conexión.
 *
 *   node scripts/subir-biblioteca-r2.js            (sube lo que falte)
 *   node scripts/subir-biblioteca-r2.js --forzar   (vuelve a subirlo todo)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') })
const fs = require('fs')
const path = require('path')
const {
  S3Client, PutObjectCommand, HeadObjectCommand,
} = require(path.join(__dirname, '..', 'backend', 'node_modules', '@aws-sdk', 'client-s3'))

const RAIZ = '/Users/sergio/Desktop/APP C+E/EJERCICIOS CONTENIDO'
const ORIGEN = {
  video:  { dir: path.join(RAIZ, 'full-library-NTRkdOevZfhYISO5pBWekIctpb7YNr'), ext: '.mp4',  tipo: 'video/mp4' },
  poster: { dir: path.join(RAIZ, 'posters'),                                     ext: '.webp', tipo: 'image/webp' },
}

const FORZAR = process.argv.includes('--forzar')
/** Cuántos a la vez. Más no va más rápido: satura la subida y empieza a fallar. */
const A_LA_VEZ = 5

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})
const BUCKET = process.env.R2_BUCKET

const mb = b => (b / 1048576).toFixed(1)

async function yaEsta(key, bytes) {
  if (FORZAR) return false
  try {
    const h = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return h.ContentLength === bytes
  } catch { return false }
}

async function subir(local, key, tipo) {
  const { size } = fs.statSync(local)
  if (await yaEsta(key, size)) return { key, saltado: true, size }

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fs.createReadStream(local),
    ContentLength: size,
    ContentType: tipo,
    // Un año: el contenido del catálogo no cambia, y sin esto cada reproducción
    // vuelve a descargar el vídeo entero.
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  return { key, saltado: false, size }
}

;(async () => {
  if (!BUCKET || !process.env.R2_ACCOUNT_ID) {
    console.error('Faltan las variables R2_* en backend/.env')
    process.exit(1)
  }

  const tareas = []
  for (const [clase, o] of Object.entries(ORIGEN)) {
    for (const f of fs.readdirSync(o.dir).filter(f => f.endsWith(o.ext))) {
      tareas.push({
        local: path.join(o.dir, f),
        key: `library/${clase}/${f}`,
        tipo: o.tipo,
      })
    }
  }

  const totalBytes = tareas.reduce((n, t) => n + fs.statSync(t.local).size, 0)
  console.log(`${tareas.length} ficheros · ${mb(totalBytes)} MB · destino ${BUCKET}/library/\n`)

  let hechos = 0, saltados = 0, subidos = 0, bytesSubidos = 0, fallos = []
  const cola = [...tareas]

  async function trabajador() {
    while (cola.length) {
      const t = cola.shift()
      try {
        const r = await subir(t.local, t.key, t.tipo)
        r.saltado ? saltados++ : (subidos++, bytesSubidos += r.size)
      } catch (e) {
        fallos.push({ key: t.key, error: e.message })
      }
      hechos++
      if (hechos % 10 === 0 || hechos === tareas.length) {
        const pct = ((hechos / tareas.length) * 100).toFixed(0)
        process.stdout.write(`\r  ${String(hechos).padStart(3)}/${tareas.length}  ${pct}%  ·  subidos ${subidos}  saltados ${saltados}  fallos ${fallos.length}   `)
      }
    }
  }

  const t0 = Date.now()
  await Promise.all(Array.from({ length: A_LA_VEZ }, trabajador))
  const seg = ((Date.now() - t0) / 1000).toFixed(0)

  console.log(`\n\n  subidos:  ${subidos} (${mb(bytesSubidos)} MB)`)
  console.log(`  saltados: ${saltados} (ya estaban con el mismo tamaño)`)
  console.log(`  tiempo:   ${seg} s`)

  if (fallos.length) {
    console.log(`\n  ❌ ${fallos.length} fallaron — vuelve a ejecutar y solo reintentará estos:`)
    fallos.slice(0, 10).forEach(f => console.log(`     ${f.key}: ${f.error}`))
    process.exit(1)
  }
  console.log('\n  ✅ biblioteca completa en R2')
})()
