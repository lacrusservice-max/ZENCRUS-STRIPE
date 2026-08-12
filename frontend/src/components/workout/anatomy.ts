/**
 * ANATOMÍA · LOS TRAZOS
 * ─────────────────────
 * La figura humana con la que ZENCRUS enseña qué se ha entrenado. Dibujada a
 * mano, path a path, sobre un lienzo de 200 × 440.
 *
 * ── Solo se dibuja la MITAD IZQUIERDA ───────────────────────────────────────
 * Cada músculo par existe una sola vez y el otro lado se pinta con
 * `translate(200,0) scale(-1,1)`. Dos motivos: la simetría queda exacta —a
 * mano, un pectoral acaba siempre dos píxeles más alto que el otro y se nota—,
 * y hay la mitad de trazos que mantener cuando se retoque el dibujo.
 *
 * ── La silueta NO lleva contorno ────────────────────────────────────────────
 * Con contorno, las dos mitades espejadas dejan una costura negra por el centro
 * del torso y de la entrepierna: dos trazos pegados por el eje. El contorno se
 * reserva para los MÚSCULOS, donde separar una pieza de la siguiente es
 * justamente lo que se quiere.
 *
 * ── Proporciones ────────────────────────────────────────────────────────────
 * Canon de ocho cabezas, el de la figura atlética. Eje de simetría en x = 100.
 * Los anchos que gobiernan la silueta, medidos desde el eje:
 *   hombro 30 · axila 40 · costillas 39 · CINTURA 32 · cadera 39 · entrepierna 0
 * Es la V que hace que un cuerpo se lea como un cuerpo: si la cintura no es la
 * parte más estrecha, el dibujo sale con forma de tonel por mucho músculo que
 * se le pinte encima.
 *
 * ── El dibujo no es un diagrama de libro ────────────────────────────────────
 * Los grupos son los que la app sabe medir, no los que existen en un atlas: el
 * catálogo clasifica en doce y pintar el sóleo aparte del gemelo sugeriría un
 * dato que no tenemos. Cada forma coincide con un grupo del catálogo o no está.
 */

export const LIENZO = { ancho: 200, alto: 440 }

/** El otro lado. Se aplica a un grupo entero, no a cada trazo. */
export const ESPEJO = `translate(${LIENZO.ancho}, 0) scale(-1, 1)`

export type Vista = 'frente' | 'espalda'

/** Un trazo con dueño: qué grupo muscular es y si tiene gemelo al otro lado. */
export interface Trazo {
  /** Grupo del catálogo, o null si es silueta sin músculo asignado. */
  grupo: string | null
  d: string
  /** Si se espeja al otro lado. Los centrados (abdomen, lumbares) no. */
  par: boolean
}

// ── Silueta ──────────────────────────────────────────────────────────────────
// El cuerpo por debajo de los músculos: lo que da la forma humana y hace que un
// grupo sin entrenar se lea como «apagado» y no como «agujero».

/**
 * Cabeza y cuello, de una pieza.
 *
 * Van juntos a propósito. Dibujados por separado quedaba una junta visible bajo
 * la mandíbula y la cabeza parecía apoyada encima del cuerpo en vez de salir de
 * él. El trapecio del cuello se ensancha hacia abajo hasta morir en los hombros.
 */
const CABEZA_CUELLO = `M100,18 C112,18 122,29 122,44 C122,56 116,66 107,69
  C106,74 106,78 108,82 C112,86 118,88 100,88 Z`

/** Torso: hombro, axila, costillas, cintura y cadera. Mitad izquierda. */
const TORSO = `M100,80 C90,80 80,83 72,88
  C63,94 58,105 59,119
  C60,133 61,141 61,149
  C63,161 66,170 68,180
  C68,193 64,205 61,217
  C60,227 64,234 70,240
  L100,240 Z`

/** Pierna: muslo, rodilla, gemelo, tobillo y pie. Mitad izquierda. */
const PIERNA = `M70,240 C64,252 60,270 61,292
  C62,311 65,327 69,337
  C67,346 66,353 67,361
  C64,375 63,391 65,403
  C66,412 69,419 72,421
  L72,429 C72,433 76,435 82,435
  L93,435 C96,435 97,432 96,428
  C94,419 92,407 92,393
  C93,377 95,361 94,349
  C94,341 95,335 96,327
  C98,309 99,287 99,263
  L99,240 Z`

/** Brazo: hombro, brazo, codo, antebrazo y mano. Mitad izquierda. */
const BRAZO = `M72,88 C60,92 50,101 45,114
  C41,127 40,143 41,159
  C42,173 43,187 43,201
  C43,215 45,229 47,239
  C48,250 52,259 57,261
  C62,262 65,258 64,251
  C63,241 62,229 62,215
  C62,199 63,183 64,167
  C65,149 67,125 71,101 Z`

const SILUETA_COMUN: Trazo[] = [
  { grupo: null, d: CABEZA_CUELLO, par: true },
  { grupo: null, d: TORSO, par: true },
  { grupo: null, d: BRAZO, par: true },
  { grupo: null, d: PIERNA, par: true },
]

export const SILUETA: Record<Vista, Trazo[]> = {
  frente: SILUETA_COMUN,
  espalda: SILUETA_COMUN,
}

// ── Vista de frente ──────────────────────────────────────────────────────────

export const FRENTE: Trazo[] = [
  // Deltoides anterior. Va ANTES que el pectoral para que el pecho monte
  // encima por la axila, que es el orden en que se ven de frente.
  {
    grupo: 'shoulders', par: true,
    d: `M73,89 C62,93 53,102 49,115
        C46,125 48,134 55,136 C62,136 67,129 69,118
        C70,108 72,96 73,89 Z`,
  },

  // Pectoral. Ancho junto a la axila y en punta hacia el esternón, con el borde
  // inferior recto: es lo que separa un pecho de una mancha redonda.
  {
    grupo: 'chest', par: true,
    d: `M99,97 C89,94 78,96 71,103
        C64,110 63,124 68,134
        C75,142 90,143 97,136
        C99,132 99,110 99,97 Z`,
  },

  // Bíceps, en el tercio alto del brazo.
  {
    grupo: 'biceps', par: true,
    d: `M53,127 C48,134 46,147 47,160
        C48,171 52,178 57,177 C62,176 64,169 64,158
        C64,145 61,133 57,128 Z`,
  },

  // Antebrazo: grueso junto al codo, afilado hacia la muñeca.
  {
    grupo: 'forearms', par: true,
    d: `M47,184 C44,193 43,206 44,219
        C45,230 47,238 51,240 C55,240 57,235 58,225
        C58,212 57,197 55,187 Z`,
  },

  // Abdomen. Centrado, así que NO se espeja: una sola pieza que cruza el eje.
  // Empieza BAJO las costillas (y=150, no y=134) y se estrecha hacia el ombligo.
  // Empezando más arriba tapaba el esternón y parecía un peto.
  {
    grupo: 'core', par: false,
    d: `M100,148 C94,148 88,150 86,155
        C84,163 84,178 85,191
        C86,202 90,210 95,215 L105,215
        C110,210 114,202 115,191
        C116,178 116,163 114,155
        C112,150 106,148 100,148 Z`,
  },

  // Cuádriceps: masa que baja del pliegue de la cadera y muere sobre la rodilla.
  {
    grupo: 'quads', par: true,
    d: `M74,246 C68,258 65,278 66,297
        C67,313 70,325 75,332
        C82,334 89,330 92,321
        C95,308 96,289 95,270
        C94,257 91,248 88,244 Z`,
  },

  // Gemelo de frente: apenas asoma a los lados de la tibia.
  {
    grupo: 'calves', par: true,
    d: `M70,356 C67,366 66,381 67,393
        C68,403 71,409 75,410 C79,410 81,404 81,393
        C81,379 79,364 76,357 Z`,
  },
]

// ── Vista de espalda ─────────────────────────────────────────────────────────

export const ESPALDA: Trazo[] = [
  // Trapecio. Diagonal del cuello al hombro: lo primero que se ve de una
  // espalda, y por eso va el primero y por encima llega el deltoides.
  {
    grupo: 'back', par: true,
    d: `M100,84 C92,85 82,89 74,96
        C69,101 67,107 68,113
        C74,115 85,112 92,107
        C97,103 100,97 100,90 Z`,
  },

  // Dorsal ancho: el triángulo de la axila a la cintura. Es lo que da la V, y
  // por eso su borde exterior sigue al de la silueta y el interior se cierra
  // hacia el centro de la espalda baja.
  {
    grupo: 'back', par: true,
    d: `M68,115 C62,125 59,141 60,157
        C61,172 65,185 71,195
        C78,199 88,196 93,189
        C97,180 99,165 99,148
        C99,131 97,119 95,112
        C86,110 75,111 68,115 Z`,
  },

  // Deltoides posterior.
  {
    grupo: 'shoulders', par: true,
    d: `M72,89 C61,93 52,102 48,115
        C45,125 47,134 54,136 C61,136 66,129 68,118
        C69,108 71,96 72,89 Z`,
  },

  // Tríceps. Ocupa DOS TERCIOS del brazo por detrás y es mayor que el bíceps.
  // Si en el dibujo saliera igual de pequeño, mentiría sobre el brazo.
  {
    grupo: 'triceps', par: true,
    d: `M52,126 C47,134 45,150 46,165
        C47,176 51,182 57,181 C62,180 64,172 64,159
        C64,144 61,132 57,127 Z`,
  },

  {
    grupo: 'forearms', par: true,
    d: `M47,185 C44,194 43,207 44,220
        C45,231 47,238 51,240 C55,240 57,235 58,225
        C58,212 57,197 55,188 Z`,
  },

  // Lumbares. Centrado como el abdomen, por el mismo motivo.
  {
    grupo: 'core', par: false,
    d: `M100,198 C94,198 89,201 87,207
        C85,215 86,225 89,232 L111,232
        C114,225 115,215 113,207
        C111,201 106,198 100,198 Z`,
  },

  // Glúteo: redondo, de la cresta ilíaca al pliegue.
  {
    grupo: 'glutes', par: true,
    d: `M100,232 C90,232 81,236 76,244
        C72,252 72,263 77,270
        C83,277 93,278 100,274 Z`,
  },

  // Isquiotibiales: del pliegue del glúteo a la corva.
  {
    grupo: 'hamstrings', par: true,
    d: `M77,274 C71,286 68,302 69,318
        C70,328 73,335 78,337
        C85,337 91,331 94,321
        C97,308 98,292 96,280
        C92,275 84,273 77,274 Z`,
  },

  // Gemelo de espalda: aquí se ve entero, con sus dos cabezas.
  {
    grupo: 'calves', par: true,
    d: `M70,352 C66,362 64,379 65,393
        C66,404 70,411 75,412
        C81,412 85,405 86,393
        C87,378 85,361 81,353
        C78,350 73,350 70,352 Z`,
  },
]

export const TRAZOS: Record<Vista, Trazo[]> = { frente: FRENTE, espalda: ESPALDA }

// ── Detalle ──────────────────────────────────────────────────────────────────

/**
 * Las líneas que convierten una forma en un músculo.
 *
 * Se pintan ENCIMA de todo, sin relleno y sin toque: son surcos, no piezas. Un
 * abdomen sin las divisiones del recto es un rectángulo redondeado; con dos
 * líneas transversales y la línea alba pasa a leerse como un abdomen, y no hace
 * falta dibujar seis cuadrados que a este tamaño serían ruido.
 *
 * Van en un color con alfa, no en negro: sobre un músculo apagado un surco
 * negro se vería como una grieta.
 */
export const DETALLES: Record<Vista, string[]> = {
  frente: [
    // Línea alba, del esternón al ombligo.
    'M100,150 L100,212',
    // Divisiones del recto abdominal.
    'M87,170 L113,170',
    'M86,190 L114,190',
    // Surco entre los pectorales.
    'M100,99 L100,138',
  ],
  espalda: [
    // Surco de la columna.
    'M100,90 L100,196',
    // Pliegue bajo el glúteo, que es lo que lo separa del femoral.
    'M78,272 C86,277 94,277 100,274',
    'M122,272 C114,277 106,277 100,274',
  ],
}

/** Qué grupos se ven en cada vista. Sirve para no prometer lo que no se pinta. */
export const GRUPOS_VISIBLES: Record<Vista, string[]> = {
  frente: ['chest', 'shoulders', 'biceps', 'forearms', 'core', 'quads', 'calves'],
  espalda: ['back', 'shoulders', 'triceps', 'forearms', 'core', 'glutes', 'hamstrings', 'calves'],
}

/** Nombre en español de cada grupo, para las etiquetas. */
export const NOMBRE_GRUPO: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  quads: 'Cuádriceps',
  hamstrings: 'Femoral',
  glutes: 'Glúteos',
  calves: 'Gemelos',
  core: 'Core',
  fullbody: 'Cuerpo entero',
}
