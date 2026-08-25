// Alimentos genéricos — la base que siempre responde.
//
// Open Food Facts cataloga PRODUCTOS DE MARCA. Buscar "pollo" o "arroz" ahí
// devuelve fideos instantáneos sabor pollo antes que una pechuga, y además su
// buscador cae con 503 con bastante frecuencia. Por eso los alimentos de todos
// los días viven aquí dentro: aparecen al instante, sin red, y encabezan
// cualquier búsqueda. El catálogo en línea se reserva para lo que esta tabla no
// puede cubrir — productos envasados concretos.
//
// Los valores son por 100 g de alimento tal como se come (cocido cuando así se
// indica) y provienen de tablas de composición de referencia.

/**
 * Grupo de alimento. Existe para que la lista de arranque no sea toda del
 * mismo tipo — ver `searchLocal` en `@/services/foodApi`.
 */
export type GrupoAlimento =
  | 'proteina' | 'huevo' | 'lacteo' | 'cereal' | 'legumbre' | 'fruta'
  | 'verdura' | 'grasa' | 'platillo' | 'bebida' | 'snack'

export interface GenericFood {
  name: string
  /** kcal, proteína, carbohidratos, grasa, fibra — por 100 g. */
  k: number; p: number; c: number; f: number; fi: number
  /** Unidad por defecto. 'pza' exige `g` (peso de una pieza). */
  u?: string
  /** Cantidad inicial sugerida. */
  a?: number
  /** Gramos por pieza, para los que se cuentan. */
  g?: number
  /** Otras formas de escribirlo o de llamarlo. */
  alt?: string[]
  /**
   * Prioridad en los resultados. Los básicos que la gente registra a diario
   * suben por encima de los platos preparados que contienen la misma palabra:
   * al buscar "arroz" debe salir antes el arroz blanco que el arroz con pollo.
   */
  pri?: number
  /** A qué grupo pertenece. Lo usa el reparto de la lista de arranque. */
  grp: GrupoAlimento
}

export const GENERIC_FOODS: GenericFood[] = [
  // ── Carnes y aves ──────────────────────────────────────────────────────────
  { name: 'Pechuga de pollo cocida', pri: 3, k: 165, p: 31, c: 0, f: 3.6, fi: 0, alt: ['pollo', 'chicken breast'], grp: 'proteina' },
  { name: 'Muslo de pollo cocido', k: 209, p: 26, c: 0, f: 11, fi: 0, alt: ['pollo'], grp: 'proteina' },
  { name: 'Pollo rostizado', k: 190, p: 29, c: 0, f: 7.4, fi: 0, alt: ['pollo asado'], grp: 'proteina' },
  { name: 'Pechuga de pavo', pri: 3, k: 135, p: 30, c: 0, f: 1, fi: 0, alt: ['pavo', 'turkey'], grp: 'proteina' },
  { name: 'Carne molida de res 90/10', pri: 3, k: 176, p: 20, c: 0, f: 10, fi: 0, alt: ['carne molida', 'res'], grp: 'proteina' },
  { name: 'Bistec de res', pri: 3, k: 217, p: 27, c: 0, f: 11, fi: 0, alt: ['res', 'steak', 'carne'], grp: 'proteina' },
  { name: 'Arrachera', k: 240, p: 27, c: 0, f: 14, fi: 0, alt: ['res'], grp: 'proteina' },
  { name: 'Lomo de cerdo', pri: 3, k: 143, p: 26, c: 0, f: 3.5, fi: 0, alt: ['cerdo', 'puerco'], grp: 'proteina' },
  { name: 'Chuleta de cerdo', k: 231, p: 26, c: 0, f: 14, fi: 0, alt: ['cerdo'], grp: 'proteina' },
  { name: 'Jamón de pavo', k: 104, p: 17, c: 3, f: 3, fi: 0, alt: ['jamon'], grp: 'proteina' },
  { name: 'Jamón serrano', k: 241, p: 31, c: 0, f: 13, fi: 0, alt: ['jamon'], grp: 'proteina' },
  { name: 'Tocino', k: 541, p: 37, c: 1.4, f: 42, fi: 0, alt: ['bacon'], grp: 'proteina' },
  { name: 'Chorizo', k: 455, p: 24, c: 2, f: 38, fi: 0, grp: 'proteina' },
  { name: 'Salchicha de pavo', k: 155, p: 14, c: 3, f: 9, fi: 0, alt: ['salchicha'], grp: 'proteina' },
  { name: 'Carnitas', k: 297, p: 26, c: 0, f: 21, fi: 0, alt: ['cerdo'], grp: 'proteina' },
  { name: 'Barbacoa de res', k: 250, p: 26, c: 0, f: 16, fi: 0, grp: 'proteina' },

  // ── Pescados y mariscos ────────────────────────────────────────────────────
  { name: 'Salmón cocido', pri: 3, k: 208, p: 20, c: 0, f: 13, fi: 0, alt: ['salmon'], grp: 'proteina' },
  { name: 'Atún en agua', pri: 3, k: 116, p: 26, c: 0, f: 1, fi: 0, alt: ['atun', 'tuna'], grp: 'proteina' },
  { name: 'Atún en aceite', k: 198, p: 29, c: 0, f: 8, fi: 0, alt: ['atun'], grp: 'proteina' },
  { name: 'Tilapia cocida', k: 128, p: 26, c: 0, f: 2.7, fi: 0, alt: ['pescado'], grp: 'proteina' },
  { name: 'Filete de pescado blanco', k: 105, p: 23, c: 0, f: 1.2, fi: 0, alt: ['pescado', 'merluza', 'bacalao'], grp: 'proteina' },
  { name: 'Camarón cocido', k: 99, p: 24, c: 0.2, f: 0.3, fi: 0, alt: ['camaron', 'shrimp'], grp: 'proteina' },
  { name: 'Sardinas en aceite', k: 208, p: 25, c: 0, f: 11, fi: 0, alt: ['sardina'], grp: 'proteina' },
  { name: 'Pulpo cocido', k: 164, p: 30, c: 4, f: 2, fi: 0, grp: 'proteina' },

  // ── Huevo y lácteos ────────────────────────────────────────────────────────
  { name: 'Huevo entero', pri: 3, k: 143, p: 12.6, c: 0.7, f: 9.5, fi: 0, u: 'pza', a: 2, g: 50, alt: ['huevo', 'egg'], grp: 'huevo' },
  { name: 'Clara de huevo', pri: 3, k: 52, p: 11, c: 0.7, f: 0.2, fi: 0, u: 'pza', a: 3, g: 33, alt: ['clara'], grp: 'huevo' },
  { name: 'Leche entera', pri: 3, k: 61, p: 3.2, c: 4.8, f: 3.3, fi: 0, u: 'ml', a: 250, alt: ['leche'], grp: 'lacteo' },
  { name: 'Leche descremada', pri: 3, k: 34, p: 3.4, c: 5, f: 0.1, fi: 0, u: 'ml', a: 250, alt: ['leche light'], grp: 'lacteo' },
  { name: 'Leche de almendras sin azúcar', k: 15, p: 0.6, c: 0.6, f: 1.2, fi: 0.3, u: 'ml', a: 250, alt: ['leche almendra'], grp: 'lacteo' },
  { name: 'Yogur griego natural', pri: 3, k: 59, p: 10, c: 3.6, f: 0.4, fi: 0, alt: ['yogur', 'yoghurt'], grp: 'lacteo' },
  { name: 'Yogur natural', k: 61, p: 3.5, c: 4.7, f: 3.3, fi: 0, alt: ['yogur'], grp: 'lacteo' },
  { name: 'Queso panela', pri: 3, k: 208, p: 18, c: 3, f: 14, fi: 0, alt: ['queso'], grp: 'lacteo' },
  { name: 'Queso Oaxaca', k: 290, p: 22, c: 3, f: 21, fi: 0, alt: ['queso', 'quesillo'], grp: 'lacteo' },
  { name: 'Queso manchego', k: 375, p: 25, c: 1, f: 30, fi: 0, alt: ['queso'], grp: 'lacteo' },
  { name: 'Queso cottage', pri: 3, k: 98, p: 11, c: 3.4, f: 4.3, fi: 0, alt: ['queso', 'requeson'], grp: 'lacteo' },
  { name: 'Queso crema', k: 342, p: 6, c: 4, f: 34, fi: 0, alt: ['queso'], grp: 'lacteo' },
  { name: 'Requesón', k: 146, p: 11, c: 4, f: 10, fi: 0, alt: ['requeson'], grp: 'lacteo' },
  { name: 'Crema ácida', k: 198, p: 2.4, c: 4.6, f: 19, fi: 0, alt: ['crema'], grp: 'lacteo' },
  { name: 'Mantequilla', k: 717, p: 0.9, c: 0.1, f: 81, fi: 0, alt: ['mantequilla'], grp: 'lacteo' },

  // ── Cereales, panes y tubérculos ───────────────────────────────────────────
  { name: 'Arroz blanco cocido', pri: 3, k: 130, p: 2.7, c: 28, f: 0.3, fi: 0.4, alt: ['arroz'], grp: 'cereal' },
  { name: 'Arroz integral cocido', pri: 3, k: 123, p: 2.7, c: 26, f: 1, fi: 1.8, alt: ['arroz'], grp: 'cereal' },
  { name: 'Avena en hojuelas', pri: 3, k: 389, p: 17, c: 66, f: 7, fi: 10, a: 40, alt: ['avena', 'oat'], grp: 'cereal' },
  { name: 'Pasta cocida', pri: 3, k: 158, p: 5.8, c: 31, f: 0.9, fi: 1.8, alt: ['pasta', 'espagueti'], grp: 'cereal' },
  { name: 'Pan blanco de caja', pri: 3, k: 265, p: 9, c: 49, f: 3.2, fi: 2.7, u: 'rebanada', a: 2, g: 28, alt: ['pan'], grp: 'cereal' },
  { name: 'Pan integral', pri: 3, k: 247, p: 13, c: 41, f: 3.4, fi: 7, u: 'rebanada', a: 2, g: 32, alt: ['pan'], grp: 'cereal' },
  { name: 'Bolillo', k: 277, p: 9, c: 55, f: 1.6, fi: 2.4, u: 'pza', a: 1, g: 60, alt: ['pan', 'telera'], grp: 'cereal' },
  { name: 'Tortilla de maíz', pri: 3, k: 218, p: 5.7, c: 45, f: 2.9, fi: 5, u: 'pza', a: 2, g: 26, alt: ['tortilla'], grp: 'cereal' },
  { name: 'Tortilla de harina', pri: 3, k: 312, p: 8, c: 51, f: 8, fi: 3, u: 'pza', a: 2, g: 42, alt: ['tortilla'], grp: 'cereal' },
  { name: 'Quinoa cocida', k: 120, p: 4.4, c: 21, f: 1.9, fi: 2.8, alt: ['quinua'], grp: 'cereal' },
  { name: 'Papa cocida', pri: 3, k: 87, p: 2, c: 20, f: 0.1, fi: 1.8, alt: ['papa', 'patata'], grp: 'cereal' },
  { name: 'Camote cocido', pri: 3, k: 90, p: 2, c: 21, f: 0.1, fi: 3.3, alt: ['camote', 'batata'], grp: 'cereal' },
  { name: 'Elote cocido', k: 96, p: 3.4, c: 21, f: 1.5, fi: 2.4, alt: ['elote', 'maiz'], grp: 'cereal' },
  { name: 'Granola', k: 471, p: 10, c: 64, f: 20, fi: 7, a: 45, alt: ['granola'], grp: 'cereal' },
  { name: 'Hot cakes', k: 227, p: 6, c: 28, f: 10, fi: 1, u: 'pza', a: 2, g: 77, alt: ['hotcake', 'panqueque'], grp: 'cereal' },

  // ── Legumbres ──────────────────────────────────────────────────────────────
  { name: 'Frijoles negros cocidos', pri: 3, k: 132, p: 8.9, c: 24, f: 0.5, fi: 8.7, alt: ['frijol'], grp: 'legumbre' },
  { name: 'Frijoles refritos', k: 148, p: 7, c: 19, f: 4.5, fi: 6, alt: ['frijol'], grp: 'legumbre' },
  { name: 'Lentejas cocidas', pri: 3, k: 116, p: 9, c: 20, f: 0.4, fi: 7.9, alt: ['lenteja'], grp: 'legumbre' },
  { name: 'Garbanzos cocidos', k: 164, p: 8.9, c: 27, f: 2.6, fi: 7.6, alt: ['garbanzo'], grp: 'legumbre' },
  { name: 'Habas cocidas', k: 110, p: 7.6, c: 20, f: 0.4, fi: 5.4, alt: ['haba'], grp: 'legumbre' },
  { name: 'Edamame', k: 121, p: 12, c: 9, f: 5, fi: 5, alt: ['soya'], grp: 'legumbre' },

  // ── Frutas ─────────────────────────────────────────────────────────────────
  { name: 'Plátano', pri: 3, k: 89, p: 1.1, c: 23, f: 0.3, fi: 2.6, u: 'pza', a: 1, g: 118, alt: ['platano', 'banana'], grp: 'fruta' },
  { name: 'Manzana', pri: 3, k: 52, p: 0.3, c: 14, f: 0.2, fi: 2.4, u: 'pza', a: 1, g: 182, alt: ['manzana'], grp: 'fruta' },
  { name: 'Naranja', pri: 3, k: 47, p: 0.9, c: 12, f: 0.1, fi: 2.4, u: 'pza', a: 1, g: 131, alt: ['naranja'], grp: 'fruta' },
  { name: 'Fresa', pri: 3, k: 32, p: 0.7, c: 7.7, f: 0.3, fi: 2, alt: ['fresa'], grp: 'fruta' },
  { name: 'Arándanos', k: 57, p: 0.7, c: 14, f: 0.3, fi: 2.4, alt: ['arandano', 'blueberry'], grp: 'fruta' },
  { name: 'Uvas', k: 69, p: 0.7, c: 18, f: 0.2, fi: 0.9, alt: ['uva'], grp: 'fruta' },
  { name: 'Sandía', k: 30, p: 0.6, c: 7.6, f: 0.2, fi: 0.4, alt: ['sandia'], grp: 'fruta' },
  { name: 'Melón', k: 34, p: 0.8, c: 8, f: 0.2, fi: 0.9, alt: ['melon'], grp: 'fruta' },
  { name: 'Piña', k: 50, p: 0.5, c: 13, f: 0.1, fi: 1.4, alt: ['piña', 'pina'], grp: 'fruta' },
  { name: 'Mango', k: 60, p: 0.8, c: 15, f: 0.4, fi: 1.6, alt: ['mango'], grp: 'fruta' },
  { name: 'Papaya', k: 43, p: 0.5, c: 11, f: 0.3, fi: 1.7, alt: ['papaya'], grp: 'fruta' },
  { name: 'Durazno', k: 39, p: 0.9, c: 10, f: 0.3, fi: 1.5, u: 'pza', a: 1, g: 150, alt: ['durazno'], grp: 'fruta' },
  { name: 'Pera', k: 57, p: 0.4, c: 15, f: 0.1, fi: 3.1, u: 'pza', a: 1, g: 178, alt: ['pera'], grp: 'fruta' },
  { name: 'Kiwi', k: 61, p: 1.1, c: 15, f: 0.5, fi: 3, u: 'pza', a: 1, g: 76, alt: ['kiwi'], grp: 'fruta' },
  { name: 'Aguacate', pri: 3, k: 160, p: 2, c: 9, f: 15, fi: 7, alt: ['aguacate', 'palta'], grp: 'fruta' },
  { name: 'Toronja', k: 42, p: 0.8, c: 11, f: 0.1, fi: 1.6, alt: ['toronja', 'pomelo'], grp: 'fruta' },

  // ── Verduras ───────────────────────────────────────────────────────────────
  { name: 'Brócoli cocido', pri: 3, k: 35, p: 2.4, c: 7, f: 0.4, fi: 3.3, alt: ['brocoli'], grp: 'verdura' },
  { name: 'Espinaca', pri: 3, k: 23, p: 2.9, c: 3.6, f: 0.4, fi: 2.2, alt: ['espinaca'], grp: 'verdura' },
  { name: 'Lechuga', k: 15, p: 1.4, c: 2.9, f: 0.2, fi: 1.3, alt: ['lechuga'], grp: 'verdura' },
  { name: 'Jitomate', pri: 3, k: 18, p: 0.9, c: 3.9, f: 0.2, fi: 1.2, alt: ['tomate', 'jitomate'], grp: 'verdura' },
  { name: 'Zanahoria', pri: 3, k: 41, p: 0.9, c: 10, f: 0.2, fi: 2.8, alt: ['zanahoria'], grp: 'verdura' },
  { name: 'Pepino', k: 15, p: 0.7, c: 3.6, f: 0.1, fi: 0.5, alt: ['pepino'], grp: 'verdura' },
  { name: 'Calabacita', k: 17, p: 1.2, c: 3.1, f: 0.3, fi: 1, alt: ['calabacita', 'calabacin'], grp: 'verdura' },
  { name: 'Cebolla', k: 40, p: 1.1, c: 9, f: 0.1, fi: 1.7, alt: ['cebolla'], grp: 'verdura' },
  { name: 'Pimiento', k: 31, p: 1, c: 6, f: 0.3, fi: 2.1, alt: ['pimiento', 'morron'], grp: 'verdura' },
  { name: 'Champiñones', k: 22, p: 3.1, c: 3.3, f: 0.3, fi: 1, alt: ['champiñon', 'hongo'], grp: 'verdura' },
  { name: 'Nopal', k: 16, p: 1.3, c: 3.3, f: 0.1, fi: 2.2, alt: ['nopal'], grp: 'verdura' },
  { name: 'Chayote', k: 19, p: 0.8, c: 4.5, f: 0.1, fi: 1.7, alt: ['chayote'], grp: 'verdura' },
  { name: 'Ejotes', k: 31, p: 1.8, c: 7, f: 0.1, fi: 2.7, alt: ['ejote', 'judia'], grp: 'verdura' },
  { name: 'Coliflor', k: 25, p: 1.9, c: 5, f: 0.3, fi: 2, alt: ['coliflor'], grp: 'verdura' },
  { name: 'Betabel', k: 43, p: 1.6, c: 10, f: 0.2, fi: 2.8, alt: ['betabel', 'remolacha'], grp: 'verdura' },
  { name: 'Apio', k: 16, p: 0.7, c: 3, f: 0.2, fi: 1.6, alt: ['apio'], grp: 'verdura' },

  // ── Grasas, semillas y frutos secos ────────────────────────────────────────
  { name: 'Almendras', pri: 3, k: 579, p: 21, c: 22, f: 50, fi: 12.5, a: 30, alt: ['almendra'], grp: 'grasa' },
  { name: 'Nueces', k: 654, p: 15, c: 14, f: 65, fi: 6.7, a: 30, alt: ['nuez'], grp: 'grasa' },
  { name: 'Cacahuates', k: 567, p: 26, c: 16, f: 49, fi: 8.5, a: 30, alt: ['cacahuate', 'mani'], grp: 'grasa' },
  { name: 'Pistaches', k: 560, p: 20, c: 28, f: 45, fi: 10, a: 30, alt: ['pistache'], grp: 'grasa' },
  { name: 'Crema de cacahuate', pri: 3, k: 588, p: 25, c: 20, f: 50, fi: 6, u: 'cda', a: 2, g: 16, alt: ['mantequilla mani', 'peanut butter'], grp: 'grasa' },
  { name: 'Chía', k: 486, p: 17, c: 42, f: 31, fi: 34, u: 'cda', a: 1, g: 12, alt: ['chia'], grp: 'grasa' },
  { name: 'Linaza', k: 534, p: 18, c: 29, f: 42, fi: 27, u: 'cda', a: 1, g: 10, alt: ['linaza'], grp: 'grasa' },
  { name: 'Aceite de oliva', pri: 3, k: 884, p: 0, c: 0, f: 100, fi: 0, u: 'cda', a: 1, g: 14, alt: ['aceite'], grp: 'grasa' },
  { name: 'Aceite vegetal', k: 884, p: 0, c: 0, f: 100, fi: 0, u: 'cda', a: 1, g: 14, alt: ['aceite'], grp: 'grasa' },

  // ── Platillos preparados ───────────────────────────────────────────────────
  { name: 'Taco de pollo', k: 190, p: 13, c: 18, f: 7, fi: 2.5, u: 'pza', a: 2, g: 90, alt: ['taco'], grp: 'platillo' },
  { name: 'Taco de carne asada', k: 220, p: 14, c: 18, f: 10, fi: 2.5, u: 'pza', a: 2, g: 95, alt: ['taco'], grp: 'platillo' },
  { name: 'Quesadilla', k: 280, p: 13, c: 26, f: 14, fi: 2, u: 'pza', a: 1, g: 110, alt: ['quesadilla'], grp: 'platillo' },
  { name: 'Enchiladas', k: 168, p: 8, c: 18, f: 7, fi: 2.5, alt: ['enchilada'], grp: 'platillo' },
  { name: 'Chilaquiles', k: 190, p: 6, c: 22, f: 9, fi: 2.5, alt: ['chilaquil'], grp: 'platillo' },
  { name: 'Pozole', k: 92, p: 7, c: 9, f: 3, fi: 1.5, u: 'taza', a: 1, alt: ['pozole'], grp: 'platillo' },
  { name: 'Sopa de fideo', k: 65, p: 2, c: 11, f: 1.5, fi: 0.8, u: 'taza', a: 1, alt: ['sopa'], grp: 'platillo' },
  { name: 'Caldo de pollo', k: 38, p: 4, c: 2, f: 1.5, fi: 0.2, u: 'taza', a: 1, alt: ['caldo', 'sopa'], grp: 'platillo' },
  { name: 'Ensalada césar con pollo', k: 158, p: 12, c: 6, f: 10, fi: 1.5, alt: ['ensalada'], grp: 'platillo' },
  { name: 'Hamburguesa sencilla', k: 254, p: 13, c: 26, f: 11, fi: 1.5, u: 'pza', a: 1, g: 150, alt: ['hamburguesa'], grp: 'platillo' },
  { name: 'Pizza de queso', k: 266, p: 11, c: 33, f: 10, fi: 2.3, u: 'rebanada', a: 2, g: 107, alt: ['pizza'], grp: 'platillo' },
  { name: 'Sushi (rollo)', k: 145, p: 6, c: 27, f: 1.5, fi: 1.5, u: 'pza', a: 8, g: 28, alt: ['sushi'], grp: 'platillo' },
  { name: 'Torta de jamón', k: 245, p: 11, c: 30, f: 9, fi: 2, u: 'pza', a: 1, g: 220, alt: ['torta'], grp: 'platillo' },
  { name: 'Papas a la francesa', k: 312, p: 3.4, c: 41, f: 15, fi: 3.8, alt: ['papas fritas'], grp: 'platillo' },
  { name: 'Arroz con pollo', k: 145, p: 10, c: 18, f: 3.5, fi: 1, alt: ['arroz'], grp: 'platillo' },
  { name: 'Tamal', k: 234, p: 7, c: 26, f: 11, fi: 3, u: 'pza', a: 1, g: 120, alt: ['tamal'], grp: 'platillo' },
  { name: 'Huevos revueltos', k: 149, p: 10, c: 1.6, f: 11, fi: 0, alt: ['huevo'], grp: 'platillo' },
  { name: 'Guacamole', k: 155, p: 2, c: 9, f: 14, fi: 6.5, alt: ['guacamole'], grp: 'platillo' },

  // ── Bebidas ────────────────────────────────────────────────────────────────
  { name: 'Café negro', pri: 3, k: 1, p: 0.1, c: 0, f: 0, fi: 0, u: 'ml', a: 240, alt: ['cafe'], grp: 'bebida' },
  { name: 'Café con leche', k: 42, p: 2.2, c: 4, f: 1.8, fi: 0, u: 'ml', a: 240, alt: ['cafe', 'latte'], grp: 'bebida' },
  { name: 'Refresco de cola', k: 42, p: 0, c: 11, f: 0, fi: 0, u: 'ml', a: 355, alt: ['refresco', 'coca'], grp: 'bebida' },
  { name: 'Refresco de dieta', k: 0.4, p: 0, c: 0.1, f: 0, fi: 0, u: 'ml', a: 355, alt: ['refresco light'], grp: 'bebida' },
  { name: 'Jugo de naranja', k: 45, p: 0.7, c: 10, f: 0.2, fi: 0.2, u: 'ml', a: 250, alt: ['jugo'], grp: 'bebida' },
  { name: 'Agua de horchata', k: 60, p: 0.6, c: 12, f: 1.2, fi: 0.2, u: 'ml', a: 250, alt: ['horchata', 'agua fresca'], grp: 'bebida' },
  { name: 'Cerveza', k: 43, p: 0.5, c: 3.6, f: 0, fi: 0, u: 'ml', a: 355, alt: ['cerveza'], grp: 'bebida' },
  { name: 'Vino tinto', k: 85, p: 0.1, c: 2.6, f: 0, fi: 0, u: 'ml', a: 150, alt: ['vino'], grp: 'bebida' },
  { name: 'Té sin azúcar', k: 1, p: 0, c: 0.3, f: 0, fi: 0, u: 'ml', a: 240, alt: ['te'], grp: 'bebida' },
  { name: 'Agua', pri: 3, k: 0, p: 0, c: 0, f: 0, fi: 0, u: 'ml', a: 500, alt: ['agua'], grp: 'bebida' },

  // ── Suplementos y snacks ───────────────────────────────────────────────────
  { name: 'Proteína de suero (whey)', pri: 3, k: 400, p: 80, c: 8, f: 5, fi: 1, a: 30, alt: ['proteina', 'whey'], grp: 'snack' },
  { name: 'Barra de proteína', k: 370, p: 30, c: 38, f: 11, fi: 8, u: 'pza', a: 1, g: 60, alt: ['barra'], grp: 'snack' },
  { name: 'Chocolate con leche', k: 535, p: 7.6, c: 59, f: 30, fi: 3.4, a: 30, alt: ['chocolate'], grp: 'snack' },
  { name: 'Galletas dulces', k: 480, p: 6, c: 65, f: 21, fi: 2.5, a: 30, alt: ['galleta'], grp: 'snack' },
  { name: 'Papas fritas de bolsa', k: 536, p: 7, c: 53, f: 34, fi: 4.4, a: 30, alt: ['sabritas', 'chips'], grp: 'snack' },
  { name: 'Palomitas naturales', k: 387, p: 13, c: 78, f: 4.5, fi: 15, a: 30, alt: ['palomita'], grp: 'snack' },
  { name: 'Helado de vainilla', k: 207, p: 3.5, c: 24, f: 11, fi: 0.7, alt: ['helado'], grp: 'snack' },
  { name: 'Miel', k: 304, p: 0.3, c: 82, f: 0, fi: 0.2, u: 'cda', a: 1, g: 21, alt: ['miel'], grp: 'snack' },
  { name: 'Azúcar', k: 387, p: 0, c: 100, f: 0, fi: 0, u: 'cdta', a: 1, g: 4, alt: ['azucar'], grp: 'snack' },
]
