/**
 * NOMBRES EN ESPAÑOL
 * ──────────────────
 * Compone el nombre de cada ejercicio en el orden que usa el español, que es el
 * contrario al inglés:
 *
 *   incline dumbbell bench press  →  Press de banca inclinado con mancuerna
 *   [modif] [material] [movimiento]  →  [MOVIMIENTO] [modif] [material]
 *
 * La versión anterior traducía palabra por palabra y salía «Con mancuerna
 * alternating forward zancada»: un diccionario no puede arreglar el orden.
 *
 * ── Cómo se compone ─────────────────────────────────────────────────────────
 * 1. Se saca el MOVIMIENTO (el sustantivo): press, remo, sentadilla…
 * 2. Se sacan los MODIFICADORES y se concuerdan en género con él —«inclinado»
 *    con press, «inclinada» con sentadilla—, que es lo que delata a una
 *    traducción automática cuando falla.
 * 3. Se añade el material con su preposición: «con mancuerna», «en polea».
 *
 * Los ejercicios con nombre propio asentado en español (press francés, peso
 * muerto rumano, face pull) van en OVERRIDES: ninguna regla los sacaría bien y
 * traducirlos literalmente sonaría a extranjero.
 */

const fs = require('fs')
const path = require('path')
const CATALOGO = path.join(__dirname, '..', 'database', 'exercises.json')

// ── Movimientos: sustantivo y género ────────────────────────────────────────
const MOV = {
  press:'Press|m', curl:'Curl|m', row:'Remo|m', rows:'Remo|m', squat:'Sentadilla|f',
  squats:'Sentadilla|f', lunge:'Zancada|f', lunges:'Zancada|f', deadlift:'Peso muerto|m',
  deadlifts:'Peso muerto|m', raise:'Elevación|f', raises:'Elevación|f', fly:'Apertura|f',
  shrug:'Encogimiento|m', shrugs:'Encogimiento|m', pulldown:'Jalón|m', extension:'Extensión|f',
  pullover:'Pullover|m', thruster:'Thruster|m', snatch:'Arrancada|f', clean:'Cargada|f',
  crunch:'Encogimiento abdominal|m', plank:'Plancha|f', dips:'Fondos|m', burpee:'Burpee|m',
  swing:'Swing|m', carry:'Paseo|m', twist:'Giro|m', bend:'Flexión lateral|f',
  kickback:'Patada|f', pushdown:'Extensión|f', downs:'Extensión|f', thrust:'Empuje|m',
  bridge:'Puente|m', windmill:'Molino|m', chopper:'Leñador|m', climber:'Escalador|m',
  stretch:'Estiramiento|m', situp:'Abdominal|m', superman:'Superman|m', supermans:'Superman|m',
  abduction:'Abducción|f', pulls:'Tirón|m', mornings:'Buenos días|m', pec:'Contractor|m',
  drive:'Empuje|m', step:'Subida|f', jump:'Salto|m', sit:'Sentadilla isométrica|f',
  skullcrusher:'Press francés|m', crossover:'Cruce|m',
}

// ── Modificadores: base sin género, se concuerda al componer ────────────────
// Los que acaban en «o» cambian a «a» con movimiento femenino.
const MOD = {
  incline:'inclinado', decline:'declinado', seated:'sentado', standing:'de pie',
  kneeling:'de rodillas', alternating:'alternado', reverse:'inverso', lateral:'lateral',
  side:'lateral', front:'frontal', rear:'posterior', romanian:'rumano', sumo:'sumo',
  bulgarian:'búlgaro', goblet:'goblet', hammer:'martillo', preacher:'predicador',
  concentration:'concentrado', drag:'drag', split:'dividido', walking:'caminando',
  elevated:'elevado', high:'alto', low:'bajo', banded:'con banda', loaded:'cargado',
  assisted:'asistido', inverted:'invertido', hanging:'colgado', diamond:'diamante',
  spinal:'espinal', jefferson:'Jefferson', curtsy:'reverencia', farmers:'del granjero',
  gorilla:'gorila', russian:'ruso', military:'militar', power:'de potencia',
  straight:'recto', donkey:'burro', narrow:'estrecho', close:'cerrado', wide:'abierto',
  neutral:'neutro', underhand:'supino', overhead:'sobre la cabeza', bent:'inclinado',
  over:'', forward:'al frente', back:'trasero', behind:'tras la espalda',
  laying:'tumbado', bilateral:'bilateral', unilateral:'unilateral', stiff:'con piernas rígidas',
  supinating:'con supinación', box:'al cajón', wall:'en la pared', rope:'con cuerda',
  cross:'cruzado', body:'', figure:'', chest:'al pecho', face:'a la cara',
  machine:'en máquina', muscle:'muscle', pec:'', deck:'',
}

// ── Partes del cuerpo cuando actúan como complemento ────────────────────────
const PARTE = {
  chest:'de pecho', bench:'de banca', leg:'de pierna', calf:'de gemelo',
  hip:'de cadera', knee:'de rodilla', wrist:'de muñeca', elbow:'de codo',
  tricep:'de tríceps', glute:'de glúteo', delt:'de deltoides', abdominals:'abdominal',
  shoulder:'de hombro', lat:'de dorsal', spinal:'espinal',
}

// ── Material ────────────────────────────────────────────────────────────────
const MATERIAL = {
  barbell:'con barra', ez:'con barra Z', dumbbell:'con mancuerna',
  kettlebell:'con pesa rusa', cable:'en polea', machine:'en máquina',
  smith:'en multipower', band:'con banda', plate:'con disco',
  landmine:'en landmine', bodyweight:'',
}

// ── Agarres y barras especiales ─────────────────────────────────────────────
const AGARRE = {
  't':'con barra T', 'v':'con barra V', 'bar':'', 'grip':'agarre',
  'neutral-grip':'agarre neutro', 'close-grip':'agarre cerrado',
  'wide-grip':'agarre abierto', 'underhand-grip':'agarre supino',
}

// ── Nombres propios que ninguna regla saca bien ─────────────────────────────
const OVERRIDES = {
  'barbell-bench-press':'Press de banca con barra',
  'barbell-close-grip-bench-press':'Press de banca agarre cerrado con barra',
  'dumbbell-bench-press':'Press de banca con mancuernas',
  'barbell-bent-over-row':'Remo inclinado con barra',
  'barbell-deadlift':'Peso muerto con barra',
  'barbell-romanian-deadlift':'Peso muerto rumano con barra',
  'band-romanian-deadlift':'Peso muerto rumano con banda',
  'barbell-clean-and-press':'Cargada y press con barra',
  'band-high-face-pull':'Face pull alto con banda',
  'cable-face-pull':'Face pull en polea',
  'band-wood-chopper':'Leñador con banda',
  'cable-wood-chopper':'Leñador en polea',
  'bodyweight-mountain-climber':'Escalador',
  'mountain-climber':'Escalador',
  'burpee':'Burpee',
  'diamond-push-ups':'Flexiones diamante',
  'push-ups':'Flexiones',
  'pull-ups':'Dominadas',
  'chin-ups':'Dominadas supinas',
  'hanging-knee-raises':'Elevación de rodillas colgado',
  'inverted-rows':'Remo invertido',
  'parralel-bar-dips':'Fondos en paralelas',
  'wall-sit':'Sentadilla isométrica en pared',
  'good-mornings':'Buenos días con barra',
  'supermans':'Superman',
  'jump-squats':'Sentadillas con salto',
  'box-jump':'Salto al cajón',
  'bulgarian-split-squats':'Sentadilla búlgara',
  'lunge-walking':'Zancadas caminando',
  'forward-lunges':'Zancadas al frente',
  'single-leg-glute-bridge':'Puente de glúteo a una pierna',
  'hand-elevated-push-ups':'Flexiones con manos elevadas',
  'elbow-plank':'Plancha con antebrazos',
  'narrow-push-ups':'Flexiones estrechas',
  'incline-push-ups':'Flexiones inclinadas',
  'decline-push-ups':'Flexiones declinadas',
  'plate-front-raise':'Elevación frontal con disco',
  'pull-up-assisted':'Dominada asistida',
  'hand-plank':'Plancha con manos',
  'dumbbell-goblet-alternating-curtsy-lunge':'Zancada curtsy alternada goblet con mancuerna',
  'dumbbell-goblet-bulgarian-split-squat':'Sentadilla búlgara goblet con mancuerna',
}

/**
 * «Goblet», «drag curl», «muscle snatch» y «curtsy» se quedan en inglés a
 * propósito: es como se dicen en un gimnasio hispanohablante. Traducirlos
 * —«sentadilla en copa»— sonaría a manual, no a como habla la gente.
 */

// ── Composición ─────────────────────────────────────────────────────────────

/**
 * Grupos de palabras que hay que resolver ANTES de trocear.
 *
 * «neutral grip» no son dos modificadores sueltos: es uno solo, y tratarlo como
 * dos produce «remo neutro agarre». Lo mismo con «bent over» o «single arm».
 */
const FRASES = [
  [/neutral-grip/g, 'agarreneutro'], [/close-grip/g, 'agarrecerrado'],
  [/wide-grip/g, 'agarreabierto'], [/underhand-grip/g, 'agarresupino'],
  [/reverse-grip/g, 'agarreinverso'], [/single-arm/g, 'unamano'],
  [/single-leg/g, 'unapierna'], [/bent-over/g, 'inclinado'],
  [/behind-the-back/g, 'traslaespalda'], [/stiff-legged/g, 'piernasrigidas'],
  [/cross-body/g, 'cruzado'], [/t-bar/g, 'barrat'], [/v-bar/g, 'barrav'],
  [/wood-chopper/g, 'lenador'], [/face-pull/g, 'facepull'],
  [/muscle-snatch/g, 'musclesnatch'], [/step-up/g, 'subidacajon'],
  [/hip-thrust/g, 'empujecadera'], [/glute-bridge/g, 'puenteglut'],
]
const COMPUESTAS = {
  agarreneutro:'con agarre neutro', agarrecerrado:'con agarre cerrado',
  agarreabierto:'con agarre abierto', agarresupino:'con agarre supino',
  agarreinverso:'con agarre inverso', unamano:'a una mano', unapierna:'a una pierna',
  traslaespalda:'tras la espalda', piernasrigidas:'con piernas rígidas',
  barrat:'con barra T', barrav:'con barra V',
}
/** Compuestas que SON el movimiento, no un modificador. */
const COMPUESTAS_MOV = {
  lenador:'Leñador|m', facepull:'Face pull|m', musclesnatch:'Muscle snatch|m',
  subidacajon:'Subida al cajón|f', empujecadera:'Empuje de cadera|m',
  puenteglut:'Puente de glúteo|m',
}

/**
 * Palabras que NO son adjetivos y por tanto no concuerdan en género.
 * Sin esta lista, «elevación de gemelo burro» salía «burra».
 */
const INVARIABLES = new Set([
  'burro','gorila','martillo','predicador','diamante','reverencia','goblet','sumo',
  'sumo','Jefferson','sit','drag','sit','de pie','de rodillas','del granjero',
])

/** Concuerda un adjetivo terminado en «o» con el género del movimiento. */
function concordar(adj, genero) {
  if (INVARIABLES.has(adj)) return adj
  if (genero === 'f' && /o$/.test(adj)) return adj.replace(/o$/, 'a')
  return adj
}

function componer(slug) {
  if (OVERRIDES[slug]) return OVERRIDES[slug]

  let s = slug
  for (const [re, a] of FRASES) s = s.replace(re, a)

  const tokens = s.split('-')
  let material = null, movimiento = null, genero = 'm'
  const modificadores = [], partes = []

  // Se recorre de DERECHA a izquierda: en inglés el sustantivo va al final, y
  // así el primero que aparece es el movimiento principal.
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]

    if (!material && MATERIAL[t] !== undefined) { material = MATERIAL[t]; continue }

    if (!movimiento && COMPUESTAS_MOV[t]) {
      const [es, g] = COMPUESTAS_MOV[t].split('|')
      movimiento = es; genero = g; continue
    }
    if (!movimiento && MOV[t]) {
      const [es, g] = MOV[t].split('|')
      movimiento = es; genero = g; continue
    }
    if (COMPUESTAS[t]) { modificadores.push(COMPUESTAS[t]); continue }

    if (PARTE[t] && movimiento) { partes.unshift(PARTE[t]); continue }
    if (MOD[t] !== undefined) { if (MOD[t]) modificadores.unshift(MOD[t]); continue }
    if (AGARRE[t] !== undefined) { if (AGARRE[t]) modificadores.unshift(AGARRE[t]); continue }

    // Números y palabras sueltas se conservan tal cual: mejor un nombre con una
    // palabra rara que uno al que le falta información.
    if (/^\d+$/.test(t)) { modificadores.unshift(`${t}°`); continue }
    if (!['the','and','to','a','of','up','ups','single','arm','legged','feet','heels','degree','variation','one','two','three','four','bar','body','figure'].includes(t)) {
      modificadores.unshift(t)
    }
    if (t === 'single') modificadores.unshift(tokens[i+1] === 'arm' ? 'a una mano' : 'a una pierna')
  }

  if (!movimiento) movimiento = 'Ejercicio'

  const partes2 = partes.length ? ' ' + partes.join(' ') : ''
  const mods = modificadores.length
    ? ' ' + modificadores.map(m => concordar(m, genero)).join(' ')
    : ''
  const mat = material ? ' ' + material : ''

  return (movimiento + partes2 + mods + mat).replace(/\s+/g, ' ').trim()
}

// ── Ejecución ───────────────────────────────────────────────────────────────

const cat = JSON.parse(fs.readFileSync(CATALOGO, 'utf8'))
let conOverride = 0

cat.ejercicios.forEach(e => {
  e.nombre = componer(e.slug)
  if (OVERRIDES[e.slug]) conOverride++
})

cat.generado = new Date().toISOString()
fs.writeFileSync(CATALOGO, JSON.stringify(cat, null, 2))

console.log(`${cat.total} nombres compuestos (${conOverride} con nombre propio asentado)\n`)
console.log('MUESTRA POR GRUPO:')
const vistos = new Set()
cat.ejercicios.forEach(e => {
  if (e.muscleEs && !vistos.has(e.muscleEs)) {
    vistos.add(e.muscleEs)
    console.log(`  ${e.muscleEs.padEnd(14)} ${e.nombre}`)
  }
})
console.log('\nMUESTRA ALEATORIA:')
for (let i = 7; i < cat.ejercicios.length; i += 23) {
  console.log(`  ${cat.ejercicios[i].nombre}`)
}
