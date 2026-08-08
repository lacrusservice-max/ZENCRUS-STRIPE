/**
 * FOTOGRAFÍAS DE RECETA · ZENCRUS
 * ═══════════════════════════════
 *
 * Las fotos que vienen con la app, empaquetadas. Se resuelven por id de receta
 * y no por un campo del store porque `require` necesita una ruta literal en
 * tiempo de compilación: no se puede construir desde una cadena guardada.
 *
 * Cuando alguien cocina y toma su propia foto, esa gana — `userPhotoUri` tiene
 * prioridad en todas las pantallas. Estas son solo el punto de partida para que
 * el recetario no arranque vacío.
 *
 * Todas con licencia CC0 1.0 (dominio público) desde Openverse.
 */

import { ImageSource } from 'expo-image'

/** `require` de un asset empaquetado devuelve un número; una foto del
 *  usuario, un `{uri}`. `RecipePhoto` acepta ambos. */
type Photo = ImageSource | number

/**
 * Marcos donde se muestra una receta, con su proporción real.
 *
 * `contain` no recorta, pero si la foto no comparte proporción con el marco
 * deja bandas. Una variante por marco las elimina sin sacrificar nada del
 * plato. Cuando una receta no tiene variante para un marco, cae en la genérica
 * y se comporta como antes.
 */
export type PhotoVariant = 'hero' | 'detail' | 'card' | 'cook'

/** Variantes por receta. Solo las que existen; el resto usa la genérica. */
const VARIANTS: Record<string, Partial<Record<PhotoVariant, Photo>>> = {
  r2: {
    hero:   require('../../assets/recipes/ensalada-pollo-aguacate-hero.jpg'),
    detail: require('../../assets/recipes/ensalada-pollo-aguacate-detail.jpg'),
    card:   require('../../assets/recipes/ensalada-pollo-aguacate-card.jpg'),
    cook:   require('../../assets/recipes/ensalada-pollo-aguacate-cook.jpg'),
  },
}

export const RECIPE_PHOTOS: Record<string, Photo> = {
  r1: require('../../assets/recipes/bowl-pollo-arroz.jpg'),
  // Generada con IA para esta receta: encuadre pensado para el marco, con el
  // plato centrado y la franja inferior despejada para el título.
  r2: require('../../assets/recipes/ensalada-pollo-aguacate.jpg'),
  r3: require('../../assets/recipes/avena-frutas.jpg'),
  r4: require('../../assets/recipes/salmon-verduras.jpg'),
  r5: require('../../assets/recipes/omelette-espinaca.jpg'),
  r6: require('../../assets/recipes/batido.jpg'),
}

/** Crédito del autor, para imprimirlo sobre la imagen. */
export const RECIPE_CREDITS: Record<string, string> = {
  r1: 'Muhammad Yeasin · CC0',
  // Imagen propia: no lleva crédito de terceros.
  r2: '',
  r3: 'cogdogblog · CC0',
  r4: 'usembassynewzealand · CC0',
  r5: 'o.tacke · CC0',
  r6: 'CC0',
}

/**
 * Fuente de imagen para una receta, en orden de prioridad:
 * la foto del usuario, la de archivo, o nada.
 */
export function photoFor(
  recipeId: string,
  userPhotoUri?: string,
  variant?: PhotoVariant,
): Photo | undefined {
  // La foto del usuario manda siempre: es su plato, no una de archivo.
  if (userPhotoUri) return { uri: userPhotoUri }
  if (variant) {
    const v = VARIANTS[recipeId]?.[variant]
    if (v) return v
  }
  return RECIPE_PHOTOS[recipeId]
}
