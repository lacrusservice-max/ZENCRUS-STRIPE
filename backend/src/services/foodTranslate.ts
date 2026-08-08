/**
 * Traducción de términos de búsqueda español → inglés.
 *
 * Tanto el catálogo propio (USDA, en inglés) como FatSecret devuelven mejores
 * resultados en inglés: "pollo" trae marcas sueltas o platos regionales,
 * mientras que "chicken breast" trae la ficha genérica verificada. Traducir la
 * consulta antes de buscar es lo que hace utilizable el catálogo para alguien
 * que escribe en español. Esto es normalización de la búsqueda, no generación
 * de datos nutricionales — la IA/reglas de aquí nunca tocan un valor.
 */
export const ES_EN: Record<string, string> = {
  pollo: 'chicken', pechuga: 'chicken breast', pavo: 'turkey', res: 'beef',
  carne: 'beef', cerdo: 'pork', puerco: 'pork', jamon: 'ham', tocino: 'bacon',
  pescado: 'fish', salmon: 'salmon', atun: 'tuna', camaron: 'shrimp',
  huevo: 'egg', huevos: 'eggs', clara: 'egg white',
  leche: 'milk', queso: 'cheese', yogur: 'yogurt', mantequilla: 'butter',
  arroz: 'rice', pan: 'bread', pasta: 'pasta', avena: 'oats', tortilla: 'tortilla',
  papa: 'potato', patata: 'potato', camote: 'sweet potato', maiz: 'corn',
  frijol: 'beans', frijoles: 'beans', lenteja: 'lentils', garbanzo: 'chickpeas',
  manzana: 'apple', platano: 'banana', naranja: 'orange', fresa: 'strawberry',
  uva: 'grapes', piña: 'pineapple', sandia: 'watermelon', aguacate: 'avocado',
  brocoli: 'broccoli', espinaca: 'spinach', lechuga: 'lettuce', zanahoria: 'carrot',
  tomate: 'tomato', jitomate: 'tomato', cebolla: 'onion', pepino: 'cucumber',
  almendra: 'almonds', nuez: 'walnuts', cacahuate: 'peanuts',
  aceite: 'oil', azucar: 'sugar', miel: 'honey', sal: 'salt',
  agua: 'water', cafe: 'coffee', cerveza: 'beer', vino: 'wine', jugo: 'juice',
  proteina: 'protein powder', chocolate: 'chocolate', galleta: 'cookie',
}

/** Traduce las palabras que conoce y deja el resto tal cual. Sin cambios → null. */
export function toEnglish(q: string): string | null {
  const words = q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/)
  const mapped = words.map(w => ES_EN[w] ?? w)
  const out = mapped.join(' ')
  return out === words.join(' ') ? null : out
}
