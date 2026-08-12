/**
 * CATÁLOGO DE EJERCICIOS · clasificador
 * ────────────────────────────────────
 * Convierte los 206 vídeos de `EJERCICIOS CONTENIDO` en un catálogo con
 * material, grupo muscular, patrón de movimiento y si vale para casa o gimnasio.
 *
 * ── Por qué un programa y no una hoja a mano ────────────────────────────────
 * Clasificar 206 ejercicios a mano se hace una vez y se rompe la siguiente vez
 * que añades vídeos: nadie se acuerda del criterio seis meses después. Aquí el
 * criterio está escrito, se aplica igual a todos y el día que lleguen 300 más
 * se vuelve a ejecutar.
 *
 * Lo que el nombre del fichero NO dice —el grupo muscular— se deduce de
 * palabras clave del movimiento. Las que no encajan salen listadas al final
 * para revisarlas a mano en vez de quedar mal clasificadas en silencio.
 *
 *   node scripts/catalogar-ejercicios.js
 */

const fs = require('fs')
const path = require('path')

const RAIZ = '/Users/sergio/Desktop/APP C+E/EJERCICIOS CONTENIDO'
const VIDEOS = path.join(RAIZ, 'full-library-NTRkdOevZfhYISO5pBWekIctpb7YNr')
const POSTERS = path.join(RAIZ, 'posters')
const SALIDA = path.join(__dirname, '..', 'database', 'exercises.json')

// ── Material ────────────────────────────────────────────────────────────────
// El primer token del nombre casi siempre lo dice. Lo que no empieza por uno
// de estos es peso corporal: burpee, diamond-push-up, mountain-climber…
const MATERIAL = {
  barbell:    { id: 'barbell',    es: 'Barra',        casa: false },
  ez:         { id: 'barbell',    es: 'Barra Z',      casa: false },
  dumbbell:   { id: 'dumbbell',   es: 'Mancuernas',   casa: true  },
  kettlebell: { id: 'kettlebell', es: 'Pesa rusa',    casa: true  },
  cable:      { id: 'cable',      es: 'Polea',        casa: false },
  machine:    { id: 'machine',    es: 'Máquina',      casa: false },
  smith:      { id: 'machine',    es: 'Multipower',   casa: false },
  band:       { id: 'band',       es: 'Banda',        casa: true  },
  plate:      { id: 'plate',      es: 'Disco',        casa: false },
  landmine:   { id: 'landmine',   es: 'Landmine',     casa: false },
  bodyweight: { id: 'bodyweight', es: 'Peso corporal', casa: true },
}
const PESO_CORPORAL = { id: 'bodyweight', es: 'Peso corporal', casa: true }

/**
 * Peso corporal que necesita barra fija o anillas: en casa no suele haberlo.
 * Se marca aparte para no prometer una dominada a quien entrena en el salón.
 */
const NECESITA_BARRA = /pull-up|chin-up|hanging|inverted|parralel|parallel|dip/

// ── Grupo muscular ──────────────────────────────────────────────────────────
// Orden importante: gana la primera que casa, así que lo específico va antes.
const GRUPOS = [
  ['glutes',     'Glúteo',      /hip-thrust|glute|hip-abduction|kickback|frog-pump/],
  ['hamstrings', 'Femoral',     /romanian|deadlift|leg-curl|good-morning|hamstring|swing/],
  ['quads',      'Cuádriceps',  /squat|lunge|leg-press|leg-extension|step-up|split|sissy|bulgarian|wall-sit|box-jump|jump/],
  ['calves',     'Gemelo',      /calf|heel-raise/],
  ['chest',      'Pecho',       /bench-press|chest|fly|flye|pec|push-up|pushup|dip|pullover/],
  ['back',       'Espalda',     /row|pulldown|pull-up|chin-up|lat-|shrug|inverted|deadlift|rack-pull|superman|back-extension/],
  ['shoulders',  'Hombro',      /shoulder|lateral-raise|front-raise|overhead-press|military|face-pull|upright|arnold|rear-delt|reverse-fly|clean-and-press|push-press/],
  ['biceps',     'Bíceps',      /curl(?!-up)|bicep|hammer|preacher|concentration|drag-curl/],
  ['triceps',    'Tríceps',     /tricep|pushdown|push-down|skull|overhead-extension|kickback|close-grip|diamond|french/],
  ['forearms',   'Antebrazo',   /wrist|forearm|grip/],
  ['core',       'Core',        /ab-|abdominal|crunch|plank|sit-?up|leg-raise|knee-raise|russian|wood-chop|mountain-climber|hollow|dead-bug|v-up|toe-touch|oblique|bicycle|side-bend|windmill/],
  ['fullbody',   'Cuerpo entero', /burpee|clean|snatch|thruster|turkish|carry|man-maker|complex/],
]

// ── Patrón de movimiento ────────────────────────────────────────────────────
// Sirve para proponer sustitutos: si la máquina está ocupada, se busca otro
// ejercicio del MISMO patrón, no simplemente del mismo músculo.
const PATRONES = [
  ['push-horizontal', /bench-press|chest-press|push-up|pushup|fly|flye|dip/],
  ['push-vertical',   /overhead-press|shoulder-press|military|push-press|handstand/],
  ['pull-horizontal', /row|face-pull|rear-delt|inverted/],
  ['pull-vertical',   /pulldown|pull-up|chin-up|pullover/],
  ['squat',           /squat|leg-press|lunge|step-up|split|sissy|wall-sit/],
  ['hinge',           /deadlift|rack-pull|romanian|good-morning|hip-thrust|swing|back-extension/],
  ['core',            /side-bend|windmill|sit-?up|knee-raise|toe-touch/],
  ['carry',           /carry|farmer|suitcase/],
  ['isolation',       /curl|extension|raise|calf|fly|flye|shrug|kickback|pushdown/],
  ['core',            /crunch|plank|sit-up|leg-raise|russian|wood-chop|hollow|dead-bug/],
]

const ESTIRAMIENTO = /stretch/

// ── Nombre legible en español ───────────────────────────────────────────────
const PALABRAS = {
  barbell:'con barra', dumbbell:'con mancuerna', dumbbells:'con mancuernas', kettlebell:'con pesa rusa',
  cable:'en polea', machine:'en máquina', smith:'en multipower', band:'con banda', ez:'con barra Z',
  bodyweight:'peso corporal', plate:'con disco', landmine:'landmine',
  bench:'banca', press:'press', squat:'sentadilla', deadlift:'peso muerto', row:'remo',
  curl:'curl', extension:'extensión', raise:'elevación', lateral:'lateral', front:'frontal',
  rear:'posterior', overhead:'sobre la cabeza', pulldown:'jalón', 'pull-up':'dominada',
  'chin-up':'dominada supina', dip:'fondo', fly:'apertura', flye:'apertura', shrug:'encogimiento',
  lunge:'zancada', 'hip-thrust':'empuje de cadera', 'calf':'gemelo', crunch:'encogimiento abdominal',
  plank:'plancha', 'push-up':'flexión', burpee:'burpee', swing:'swing', thruster:'thruster',
  incline:'inclinado', decline:'declinado', seated:'sentado', standing:'de pie', kneeling:'de rodillas',
  'single-arm':'a una mano', 'single-leg':'a una pierna', close:'cerrado', wide:'abierto',
  narrow:'estrecho', reverse:'inverso', hammer:'martillo', preacher:'predicador', romanian:'rumano',
  bulgarian:'búlgara', goblet:'goblet', sumo:'sumo', front:'frontal', back:'trasero',
  stretch:'estiramiento', variation:'variante', one:'I', two:'II', three:'III', four:'IV',
}

function legible(slug) {
  return slug.split('-')
    .map(w => PALABRAS[w] ?? w)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^./, c => c.toUpperCase())
}

function clasificar(slug) {
  const primero = slug.split('-')[0]
  const mat = MATERIAL[primero] ?? PESO_CORPORAL

  let grupo = null, grupoEs = null
  for (const [id, es, re] of GRUPOS) {
    if (re.test(slug)) { grupo = id; grupoEs = es; break }
  }

  let patron = null
  for (const [id, re] of PATRONES) { if (re.test(slug)) { patron = id; break } }

  const esEstiramiento = ESTIRAMIENTO.test(slug)
  // Casa: material que cabe en un salón Y que no pide barra fija.
  const casa = mat.casa && !NECESITA_BARRA.test(slug)

  return {
    slug,
    nombre: legible(slug),
    equipment: mat.id,
    equipmentEs: mat.es,
    muscle: grupo,
    muscleEs: grupoEs,
    pattern: esEstiramiento ? 'stretch' : patron,
    home: casa || esEstiramiento,   // estirar se puede en cualquier sitio
    gym: true,                       // todo se puede hacer en un gimnasio
    video: `${slug}.mp4`,
    poster: `${slug}.webp`,
  }
}

// ── Ejecución ───────────────────────────────────────────────────────────────

const slugs = fs.readdirSync(VIDEOS)
  .filter(f => f.endsWith('.mp4'))
  .map(f => f.replace(/\.mp4$/, ''))
  .sort()

const posters = new Set(
  fs.readdirSync(POSTERS).filter(f => f.endsWith('.webp')).map(f => f.replace(/\.webp$/, '')),
)

const catalogo = []
const sinPoster = []
const sinGrupo = []

for (const slug of slugs) {
  if (!posters.has(slug)) sinPoster.push(slug)
  const e = clasificar(slug)
  if (!e.muscle) sinGrupo.push(slug)
  catalogo.push(e)
}

fs.mkdirSync(path.dirname(SALIDA), { recursive: true })
fs.writeFileSync(SALIDA, JSON.stringify({
  generado: new Date().toISOString(),
  total: catalogo.length,
  ejercicios: catalogo,
}, null, 2))

// ── Informe ─────────────────────────────────────────────────────────────────
const cuenta = (campo) => catalogo.reduce((m, e) => {
  const k = e[campo] ?? '—sin clasificar—'
  m[k] = (m[k] || 0) + 1; return m
}, {})

const tabla = (titulo, obj) => {
  console.log(`\n${titulo}`)
  Object.entries(obj).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`))
}

console.log(`\n${catalogo.length} ejercicios catalogados → ${path.relative(process.cwd(), SALIDA)}`)
tabla('POR GRUPO MUSCULAR', cuenta('muscleEs'))
tabla('POR MATERIAL', cuenta('equipmentEs'))
tabla('POR PATRÓN', cuenta('pattern'))
console.log(`\nDISPONIBILIDAD`)
console.log(`  ${catalogo.filter(e => e.home).length.toString().padStart(4)}  se pueden hacer en casa`)
console.log(`  ${catalogo.filter(e => !e.home).length.toString().padStart(4)}  solo en gimnasio`)

if (sinPoster.length) console.log(`\n⚠️  SIN PÓSTER (${sinPoster.length}): ${sinPoster.join(', ')}`)
if (sinGrupo.length) {
  console.log(`\n⚠️  SIN GRUPO MUSCULAR — revisar a mano (${sinGrupo.length}):`)
  sinGrupo.forEach(s => console.log(`     ${s}`))
}
