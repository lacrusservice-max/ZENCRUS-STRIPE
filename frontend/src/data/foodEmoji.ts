// Emoji para cualquier alimento.
//
// El catálogo viene de Open Food Facts, así que los nombres son reales y sucios:
// "Pechuguita de Pollo Asada al Horno", "Nutella", "Coca-Cola Zero". No se puede
// mapear por identificador, hay que reconocer palabras. Las reglas van de lo más
// específico a lo más general y gana la primera que coincida, de modo que
// "leche de almendras" caiga en almendra y no en leche.

interface Rule { emoji: string; words: string[] }

/**
 * El orden importa: lo específico primero.
 *
 * Una palabra normal coincide como prefijo de palabra, para que "frijol"
 * también encuentre "frijoles". Una palabra con "=" delante exige la palabra
 * completa: sin eso, "agua" coincidía dentro de "aguacate" y el aguacate salía
 * dibujado como un vaso de agua.
 */
const RULES: Rule[] = [
  // Marcas y platos con nombre propio — antes que cualquier ingrediente suelto.
  // El chocolate va aquí arriba porque "chocolate con leche" lo capturaba la
  // regla de lácteos, y el embutido antes que las aves porque "salchicha de
  // pavo" es antes un embutido que un ave.
  { emoji: '🍫', words: ['nutella', 'chocolate', 'cacao', 'cocoa'] },
  { emoji: '🥓', words: ['salchicha', 'sausage', 'chorizo', 'tocino', 'bacon', 'jamon', 'jamón'] },
  { emoji: '🌮', words: ['chilaquil', 'tostada', 'sope', 'gordita', 'huarache'] },
  { emoji: '🫔', words: ['tamal'] },
  { emoji: '🍲', words: ['pozole', 'menudo', 'birria', 'mole'] },
  { emoji: '🥪', words: ['torta de', 'sandwich', 'sándwich', 'baguette'] },

  // Proteína animal
  { emoji: '🍗', words: ['pollo', 'chicken', 'pechuga', 'pavo', 'turkey', 'muslo'] },
  { emoji: '🥩', words: ['res', 'beef', 'carne', 'steak', 'bistec', 'ternera', 'cordero', 'lamb'] },
  { emoji: '🥓', words: ['tocino', 'bacon', 'panceta', 'jamon', 'ham', 'chorizo', 'salchicha', 'sausage', 'cerdo', 'pork'] },
  { emoji: '🐟', words: ['salmon', 'atun', 'tuna', 'pescado', 'fish', 'merluza', 'bacalao', 'tilapia', 'sardina'] },
  { emoji: '🦐', words: ['camaron', 'shrimp', 'gamba', 'langostino', 'marisco', 'pulpo', 'calamar'] },
  { emoji: '🥚', words: ['huevo', 'egg', 'clara', 'yema'] },

  // Bebidas — después de la proteína animal, para que "atún en agua" sea
  // pescado y no agua. Lo concreto antes que "leche" o "agua"
  { emoji: '☕', words: ['cafe', 'coffee', 'espresso', 'capuchino', 'cappuccino', 'latte'] },
  { emoji: '🍵', words: ['te verde', 'green tea', 'matcha', 'infusion', 'te negro'] },
  { emoji: '🥤', words: ['refresco', 'soda', 'cola', 'gaseosa', 'sprite', 'fanta', 'pepsi'] },
  { emoji: '🧃', words: ['jugo', 'zumo', 'juice', 'nectar'] },
  { emoji: '🍺', words: ['cerveza', 'beer', 'lager'] },
  { emoji: '🍷', words: ['vino', 'wine'] },
  // "=agua" exige la palabra entera: si no, atrapa "aguacate".
  { emoji: '💧', words: ['=agua', '=aguas', 'water', 'mineral'] },

  // Lácteos
  { emoji: '🧀', words: ['queso', 'cheese', 'panela', 'mozzarella', 'cheddar', 'parmesano'] },
  { emoji: '🥛', words: ['leche', 'milk', 'lacteo'] },
  { emoji: '🍦', words: ['helado', 'ice cream', 'nieve'] },
  { emoji: '🧈', words: ['mantequilla', 'butter', 'margarina'] },
  { emoji: '🥣', words: ['yogur', 'yoghurt', 'yogurt', 'griego', 'skyr', 'kefir'] },

  // Cereales y panadería
  // Sin "integral": es un adjetivo, no un alimento, y hacía que "arroz
  // integral" se dibujara como una rebanada de pan.
  { emoji: '🍞', words: ['pan ', 'pan de', 'bread', 'bollo', 'baguette', 'brioche', 'telera', 'bolillo'] },
  { emoji: '🥐', words: ['croissant', 'cuernito', 'hojaldre'] },
  { emoji: '🌮', words: ['tortilla', 'taco', 'quesadilla', 'nixtamal'] },
  { emoji: '🌯', words: ['burrito', 'wrap', 'fajita'] },
  { emoji: '🍕', words: ['pizza'] },
  { emoji: '🍝', words: ['pasta', 'espagueti', 'spaghetti', 'macarron', 'fideo', 'noodle', 'lasagna'] },
  { emoji: '🍚', words: ['arroz', 'rice', 'risotto'] },
  { emoji: '🥣', words: ['avena', 'oat', 'cereal', 'granola', 'muesli', 'porridge'] },
  { emoji: '🥞', words: ['hotcake', 'pancake', 'panqueque', 'waffle', 'gofre'] },

  // Legumbres y frutos secos
  { emoji: '🫘', words: ['frijol', 'bean', 'lenteja', 'lentil', 'garbanzo', 'chickpea', 'haba', 'alubia'] },
  // Sin la palabra suelta "nut": aparece dentro de nutella, donut o nutrition.
  { emoji: '🥜', words: ['cacahuate', 'mani', 'peanut', 'nuez', 'nueces', 'almendra', 'almond', 'pistacho', 'avellana', 'anacardo', 'walnut', 'hazelnut'] },

  // Frutas
  { emoji: '🍌', words: ['platano', 'banana', 'banano'] },
  { emoji: '🍎', words: ['manzana', 'apple'] },
  { emoji: '🍊', words: ['naranja', 'orange', 'mandarina', 'tangerina'] },
  { emoji: '🍋', words: ['limon', 'lemon', 'lima'] },
  { emoji: '🍓', words: ['fresa', 'strawberry', 'frutilla'] },
  { emoji: '🫐', words: ['arandano', 'blueberry', 'mora', 'frambuesa', 'berry'] },
  { emoji: '🍇', words: ['uva', 'grape', 'pasa'] },
  { emoji: '🍉', words: ['sandia', 'watermelon'] },
  { emoji: '🍈', words: ['melon', 'cantaloupe'] },
  { emoji: '🍍', words: ['piña', 'pina', 'pineapple'] },
  { emoji: '🥭', words: ['mango'] },
  { emoji: '🍑', words: ['durazno', 'peach', 'melocoton', 'nectarina'] },
  { emoji: '🍐', words: ['pera', 'pear'] },
  { emoji: '🥝', words: ['kiwi'] },
  { emoji: '🥥', words: ['coco', 'coconut'] },
  { emoji: '🥑', words: ['aguacate', 'avocado', 'palta', 'guacamole'] },

  // Verduras
  { emoji: '🥦', words: ['brocoli', 'broccoli', 'coliflor', 'cauliflower'] },
  { emoji: '🥬', words: ['espinaca', 'spinach', 'lechuga', 'lettuce', 'kale', 'acelga', 'col', 'ensalada', 'salad'] },
  { emoji: '🥕', words: ['zanahoria', 'carrot'] },
  { emoji: '🍅', words: ['tomate', 'tomato', 'jitomate', 'salsa'] },
  { emoji: '🥔', words: ['papa', 'patata', 'potato', 'camote', 'batata'] },
  { emoji: '🌽', words: ['maiz', 'corn', 'elote', 'choclo'] },
  { emoji: '🧅', words: ['cebolla', 'onion'] },
  { emoji: '🧄', words: ['ajo', 'garlic'] },
  { emoji: '🌶️', words: ['chile', 'pepper', 'pimiento', 'jalapeño', 'jalapeno', 'picante'] },
  { emoji: '🥒', words: ['pepino', 'cucumber', 'calabacin', 'zucchini', 'calabaza'] },
  { emoji: '🍄', words: ['champiñon', 'champinon', 'hongo', 'mushroom', 'seta'] },

  // Dulces y procesados
  { emoji: '🍪', words: ['galleta', 'cookie', 'biscuit'] },
  { emoji: '🍰', words: ['pastel', 'cake', 'tarta', 'torta', 'cheesecake'] },
  { emoji: '🍩', words: ['dona', 'donut', 'rosquilla'] },
  { emoji: '🍬', words: ['dulce', 'candy', 'caramelo', 'gomita'] },
  { emoji: '🍯', words: ['miel', 'honey', 'jarabe', 'sirope'] },
  { emoji: '🍟', words: ['papas fritas', 'french fries', 'frituras', 'chips'] },
  { emoji: '🍔', words: ['hamburguesa', 'burger'] },
  { emoji: '🌭', words: ['hot dog', 'hotdog', 'perrito'] },
  { emoji: '🍿', words: ['palomita', 'popcorn'] },

  // Despensa
  { emoji: '🫒', words: ['aceite', 'oil', 'oliva', 'olive'] },
  { emoji: '🧂', words: ['=sal', 'salt', 'especia', 'condimento', 'pimienta'] },
  { emoji: '🍲', words: ['sopa', 'soup', 'caldo', 'broth', 'guiso', 'estofado', 'crema de'] },
  { emoji: '🥫', words: ['conserva', 'enlatado', 'lata', 'canned'] },
  { emoji: '💪', words: ['proteina', 'protein', 'whey', 'caseina', 'suplemento', 'creatina'] },
  { emoji: '🥗', words: ['vegano', 'vegetariano', 'tofu', 'seitan', 'tempeh', 'soja', 'soya'] },
]

/** Quita acentos y baja a minúsculas para que "piña" y "pina" coincidan igual. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Expresión de cada palabra, compilada una sola vez. */
const matcherCache = new Map<string, RegExp>()

function matcher(word: string): RegExp {
  const hit = matcherCache.get(word)
  if (hit) return hit
  const exact = word.startsWith('=')
  const w = (exact ? word.slice(1) : word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Exacta: la palabra completa. Normal: prefijo de palabra, para que "frijol"
  // encuentre "frijoles". Si la palabra ya trae espacios se busca tal cual.
  const re = new RegExp(
    /\s/.test(w) ? w : exact ? `(^|\\s)${w}($|\\s)` : `(^|\\s)${w}`,
  )
  matcherCache.set(word, re)
  return re
}

const cache = new Map<string, string>()

/**
 * Emoji que mejor representa un alimento.
 *
 * `category` es la categoría que devuelve la fuente externa (si la hay) y se
 * consulta después del nombre: el nombre es más específico y por tanto más fiable.
 */
export function emojiForFood(name: string, category?: string): string {
  const key = `${name}|${category ?? ''}`
  const hit = cache.get(key)
  if (hit) return hit

  const haystacks = [normalize(name), category ? normalize(category) : '']
  let found = '🍽️'

  outer: for (const h of haystacks) {
    if (!h) continue
    for (const rule of RULES) {
      for (const w of rule.words) {
        if (matcher(w).test(h)) { found = rule.emoji; break outer }
      }
    }
  }

  cache.set(key, found)
  return found
}
