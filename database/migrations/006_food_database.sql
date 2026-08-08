-- ============================================================
-- ZENCRUS — Base de datos nutricional
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================
--
-- Toda la información nutricional procede de fuentes oficiales. Este esquema no
-- admite alimentos "estimados": cada registro apunta obligatoriamente a la
-- fuente de la que salió y al identificador que tiene en ella, de modo que
-- cualquier valor es rastreable hasta su origen.
--
-- Decisiones de fondo
-- ───────────────────
-- · UN alimento, MUCHOS nombres. "Chicken breast", "Pechuga de pollo" y "pollo
--   pechuga" son alias de un mismo registro (`food_aliases`), nunca registros
--   distintos.
-- · Los nutrientes van en filas, no en columnas. Cada fuente publica un conjunto
--   distinto —USDA da 91 valores, otras dan 12— y una tabla ancha obligaría a
--   migrar el esquema cada vez que se añade una fuente. Con filas, añadir un
--   micronutriente nuevo es insertar, no alterar.
-- · Todo se guarda por 100 g (o 100 ml). Las porciones viven aparte con su peso
--   real en gramos; las equivalencias se calculan, no se duplican.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ── FUENTES ───────────────────────────────────────────────────────────────────
-- El distintivo "Verificado" de la app sale de aquí: solo lo llevan los
-- alimentos cuya fuente es oficial. Lo que crea una persona no se verifica.

CREATE TABLE IF NOT EXISTS food_sources (
  id           SMALLSERIAL PRIMARY KEY,
  code         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  country      TEXT,
  url          TEXT,
  license      TEXT NOT NULL,
  attribution  TEXT,
  official     BOOLEAN NOT NULL DEFAULT TRUE,
  -- Menor número, mayor confianza. Decide qué gana al deduplicar.
  priority     SMALLINT NOT NULL DEFAULT 100,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN food_sources.license IS
  'Licencia bajo la que se redistribuye. Debe revisarse antes de integrar una fuente nueva: no todas permiten uso comercial.';

-- ── CATEGORÍAS ────────────────────────────────────────────────────────────────
-- Jerárquicas: "Carnes" → "Pollo". `parent_id` nulo indica categoría raíz.

CREATE TABLE IF NOT EXISTS food_categories (
  id         SERIAL PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  name_es    TEXT NOT NULL,
  name_en    TEXT,
  parent_id  INTEGER REFERENCES food_categories(id) ON DELETE SET NULL,
  emoji      TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_food_categories_parent ON food_categories(parent_id);

-- ── CATÁLOGO DE NUTRIENTES ────────────────────────────────────────────────────
-- Lista cerrada de nutrientes con su unidad. `source_code` guarda el
-- identificador que usa la fuente para poder mapear sin ambigüedad.

CREATE TABLE IF NOT EXISTS nutrients (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name_es     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  unit        TEXT NOT NULL CHECK (unit IN ('kcal','kj','g','mg','ug','iu')),
  -- Los que la app muestra siempre en primer plano.
  is_macro    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  SMALLINT NOT NULL DEFAULT 999
);

-- ── ALIMENTOS ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE food_kind AS ENUM (
    'natural', 'procesado', 'ultraprocesado', 'marca', 'receta', 'restaurante'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS foods (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  source_id       SMALLINT NOT NULL REFERENCES food_sources(id),
  -- Identificador en la fuente original. Junto con `source_id` impide que una
  -- reimportación duplique lo ya cargado (requisito de control de calidad).
  source_food_id  TEXT NOT NULL,

  name            TEXT NOT NULL,
  -- Nombre sin acentos ni mayúsculas: es sobre esta columna sobre la que se
  -- busca, para que "pechuga" encuentre "Pechuga".
  name_normalized TEXT NOT NULL,
  lang            TEXT NOT NULL DEFAULT 'en',
  country         TEXT,

  brand           TEXT,
  barcode         TEXT,

  category_id     INTEGER REFERENCES food_categories(id) ON DELETE SET NULL,
  subcategory_id  INTEGER REFERENCES food_categories(id) ON DELETE SET NULL,
  kind            food_kind NOT NULL DEFAULT 'natural',

  image_url       TEXT,

  -- Base de referencia: 100 g para sólidos, 100 ml para líquidos.
  base_unit       TEXT NOT NULL DEFAULT 'g' CHECK (base_unit IN ('g','ml')),

  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  published_at    DATE,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT foods_source_unique UNIQUE (source_id, source_food_id)
);

-- Búsqueda tolerante a errores y a partes de palabra ("pechu" → "pechuga").
CREATE INDEX IF NOT EXISTS idx_foods_name_trgm
  ON foods USING GIN (name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_foods_barcode
  ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_foods_category ON foods(category_id);
CREATE INDEX IF NOT EXISTS idx_foods_brand ON foods(brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_foods_source ON foods(source_id);

-- ── ALIAS ─────────────────────────────────────────────────────────────────────
-- Traducciones, sinónimos y variantes de escritura. Es lo que permite que un
-- mismo alimento se encuentre escribiendo en cualquier idioma sin duplicarlo.

DO $$ BEGIN
  CREATE TYPE alias_kind AS ENUM ('nombre', 'traduccion', 'sinonimo', 'marca', 'comun');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS food_aliases (
  id               BIGSERIAL PRIMARY KEY,
  food_id          UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  alias            TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  lang             TEXT NOT NULL DEFAULT 'es',
  kind             alias_kind NOT NULL DEFAULT 'sinonimo',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT food_aliases_unique UNIQUE (food_id, alias_normalized, lang)
);

CREATE INDEX IF NOT EXISTS idx_aliases_trgm
  ON food_aliases USING GIN (alias_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_aliases_food ON food_aliases(food_id);

-- ── VALORES NUTRICIONALES ─────────────────────────────────────────────────────
-- Siempre por 100 g o 100 ml, según `foods.base_unit`.

CREATE TABLE IF NOT EXISTS food_nutrients (
  food_id     UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  nutrient_id INTEGER NOT NULL REFERENCES nutrients(id),
  amount      NUMERIC(12,4) NOT NULL CHECK (amount >= 0),

  PRIMARY KEY (food_id, nutrient_id)
);

-- ── PORCIONES ─────────────────────────────────────────────────────────────────
-- Equivalencias reales publicadas por la fuente ("1 taza picada = 140 g"). Sin
-- esto no se puede convertir de taza a gramos sin inventarse el peso.

CREATE TABLE IF NOT EXISTS food_portions (
  id           BIGSERIAL PRIMARY KEY,
  food_id      UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount       NUMERIC(10,3) NOT NULL DEFAULT 1,
  gram_weight  NUMERIC(10,3) NOT NULL CHECK (gram_weight > 0),
  seq          SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_portions_food ON food_portions(food_id);

-- ── REGISTRO DE INGESTAS ──────────────────────────────────────────────────────
-- Trazabilidad: qué se cargó, desde qué versión de qué fuente y cuándo.

CREATE TABLE IF NOT EXISTS food_imports (
  id             BIGSERIAL PRIMARY KEY,
  source_id      SMALLINT NOT NULL REFERENCES food_sources(id),
  dataset        TEXT NOT NULL,
  dataset_date   DATE,
  foods_inserted INTEGER NOT NULL DEFAULT 0,
  foods_updated  INTEGER NOT NULL DEFAULT 0,
  foods_skipped  INTEGER NOT NULL DEFAULT 0,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMPTZ,
  notes          TEXT
);

-- ── BÚSQUEDA ──────────────────────────────────────────────────────────────────

-- Normaliza igual que la aplicación: sin acentos y en minúsculas, para que la
-- consulta y lo almacenado se comparen sobre el mismo terreno.
CREATE OR REPLACE FUNCTION food_normalize(txt TEXT)
RETURNS TEXT AS $$
  SELECT lower(unaccent(coalesce(txt, '')));
$$ LANGUAGE SQL IMMUTABLE;

/**
 * Busca alimentos por nombre o por alias.
 *
 * Ordena por similitud de trigramas, así que tolera erratas y coincidencias
 * parciales, y da ventaja a lo que empieza por lo escrito: buscando "pechu",
 * "Pechuga de pollo" debe ir por delante de "Sopa con pechuga".
 */
CREATE OR REPLACE FUNCTION search_foods(
  q          TEXT,
  max_rows   INTEGER DEFAULT 40,
  min_score  REAL DEFAULT 0.12
)
RETURNS TABLE (
  food_id    UUID,
  name       TEXT,
  brand      TEXT,
  image_url  TEXT,
  verified   BOOLEAN,
  source     TEXT,
  score      REAL
) AS $$
  WITH needle AS (SELECT food_normalize(q) AS n)
  SELECT DISTINCT ON (f.id)
    f.id, f.name, f.brand, f.image_url, f.verified, s.code,
    GREATEST(
      similarity(f.name_normalized, needle.n),
      COALESCE(MAX(similarity(a.alias_normalized, needle.n)), 0)
    )
    + CASE WHEN f.name_normalized LIKE needle.n || '%' THEN 0.4 ELSE 0 END
    AS score
  FROM foods f
  JOIN food_sources s ON s.id = f.source_id
  LEFT JOIN food_aliases a ON a.food_id = f.id
  CROSS JOIN needle
  WHERE f.name_normalized % needle.n
     OR f.name_normalized LIKE '%' || needle.n || '%'
     OR a.alias_normalized % needle.n
  GROUP BY f.id, f.name, f.brand, f.image_url, f.verified, s.code, s.priority, needle.n, f.name_normalized
  HAVING GREATEST(
      similarity(f.name_normalized, needle.n),
      COALESCE(MAX(similarity(a.alias_normalized, needle.n)), 0)
    ) >= min_score
     OR f.name_normalized LIKE '%' || needle.n || '%'
  ORDER BY f.id, score DESC
  LIMIT max_rows;
$$ LANGUAGE SQL STABLE;

-- ── SEGURIDAD ─────────────────────────────────────────────────────────────────
-- El catálogo es de solo lectura para la app: se alimenta desde las ingestas,
-- nunca desde el cliente.

ALTER TABLE foods           ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_aliases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_nutrients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_portions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_sources    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY foods_read           ON foods           FOR SELECT USING (TRUE);
  CREATE POLICY aliases_read         ON food_aliases    FOR SELECT USING (TRUE);
  CREATE POLICY nutrients_val_read   ON food_nutrients  FOR SELECT USING (TRUE);
  CREATE POLICY portions_read        ON food_portions   FOR SELECT USING (TRUE);
  CREATE POLICY categories_read      ON food_categories FOR SELECT USING (TRUE);
  CREATE POLICY nutrients_read       ON nutrients       FOR SELECT USING (TRUE);
  CREATE POLICY sources_read         ON food_sources    FOR SELECT USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── DATOS DE ARRANQUE ─────────────────────────────────────────────────────────

INSERT INTO food_sources (code, name, country, url, license, attribution, priority) VALUES
  ('usda_sr',    'USDA FoodData Central · SR Legacy',  'US', 'https://fdc.nal.usda.gov', 'Dominio público', 'U.S. Department of Agriculture, FoodData Central', 10),
  ('usda_fnd',   'USDA FoodData Central · Foundation', 'US', 'https://fdc.nal.usda.gov', 'Dominio público', 'U.S. Department of Agriculture, FoodData Central', 5),
  ('usda_brand', 'USDA FoodData Central · Branded',    'US', 'https://fdc.nal.usda.gov', 'Dominio público', 'U.S. Department of Agriculture, FoodData Central', 40),
  ('off',        'Open Food Facts',                    NULL, 'https://world.openfoodfacts.org', 'ODbL 1.0', 'Open Food Facts contributors — ODbL', 50)
ON CONFLICT (code) DO NOTHING;

-- Nutrientes que la app entiende. `code` es estable y no depende de la fuente.
INSERT INTO nutrients (code, name_es, name_en, unit, is_macro, sort_order) VALUES
  ('energy',        'Calorías',           'Energy',              'kcal', TRUE,  1),
  ('protein',       'Proteína',           'Protein',             'g',    TRUE,  2),
  ('carbs',         'Carbohidratos',      'Carbohydrates',       'g',    TRUE,  3),
  ('fat',           'Grasas',             'Total fat',           'g',    TRUE,  4),
  ('fat_saturated', 'Grasas saturadas',   'Saturated fat',       'g',    FALSE, 5),
  ('fat_trans',     'Grasas trans',       'Trans fat',           'g',    FALSE, 6),
  ('fiber',         'Fibra',              'Dietary fiber',       'g',    TRUE,  7),
  ('sugars',        'Azúcares',           'Total sugars',        'g',    FALSE, 8),
  ('sodium',        'Sodio',              'Sodium',              'mg',   FALSE, 10),
  ('potassium',     'Potasio',            'Potassium',           'mg',   FALSE, 11),
  ('cholesterol',   'Colesterol',         'Cholesterol',         'mg',   FALSE, 12),
  ('calcium',       'Calcio',             'Calcium',             'mg',   FALSE, 20),
  ('iron',          'Hierro',             'Iron',                'mg',   FALSE, 21),
  ('magnesium',     'Magnesio',           'Magnesium',           'mg',   FALSE, 22),
  ('phosphorus',    'Fósforo',            'Phosphorus',          'mg',   FALSE, 23),
  ('zinc',          'Zinc',               'Zinc',                'mg',   FALSE, 24),
  ('vitamin_a',     'Vitamina A',         'Vitamin A (RAE)',     'ug',   FALSE, 30),
  ('vitamin_c',     'Vitamina C',         'Vitamin C',           'mg',   FALSE, 31),
  ('vitamin_d',     'Vitamina D',         'Vitamin D',           'ug',   FALSE, 32),
  ('vitamin_e',     'Vitamina E',         'Vitamin E',           'mg',   FALSE, 33),
  ('vitamin_k',     'Vitamina K',         'Vitamin K',           'ug',   FALSE, 34),
  ('vitamin_b1',    'Tiamina (B1)',       'Thiamin',             'mg',   FALSE, 40),
  ('vitamin_b2',    'Riboflavina (B2)',   'Riboflavin',          'mg',   FALSE, 41),
  ('vitamin_b3',    'Niacina (B3)',       'Niacin',              'mg',   FALSE, 42),
  ('vitamin_b6',    'Vitamina B6',        'Vitamin B-6',         'mg',   FALSE, 43),
  ('vitamin_b9',    'Folato (B9)',        'Folate',              'ug',   FALSE, 44),
  ('vitamin_b12',   'Vitamina B12',       'Vitamin B-12',        'ug',   FALSE, 45),
  ('water',         'Agua',               'Water',               'g',    FALSE, 50),
  ('caffeine',      'Cafeína',            'Caffeine',            'mg',   FALSE, 51)
ON CONFLICT (code) DO NOTHING;

INSERT INTO food_categories (code, name_es, name_en, emoji, sort_order) VALUES
  ('frutas',       'Frutas',              'Fruits',            '🍎', 10),
  ('verduras',     'Verduras',            'Vegetables',        '🥦', 20),
  ('carnes',       'Carnes',              'Meats',             '🥩', 30),
  ('aves',         'Aves',                'Poultry',           '🍗', 31),
  ('pescados',     'Pescados y mariscos', 'Fish and seafood',  '🐟', 32),
  ('huevos',       'Huevos',              'Eggs',              '🥚', 33),
  ('lacteos',      'Lácteos',             'Dairy',             '🥛', 40),
  ('cereales',     'Cereales',            'Grains',            '🌾', 50),
  ('legumbres',    'Legumbres',           'Legumes',           '🫘', 51),
  ('tuberculos',   'Tubérculos',          'Tubers',            '🥔', 52),
  ('frutos_secos', 'Frutos secos y semillas', 'Nuts and seeds', '🥜', 53),
  ('aceites',      'Aceites y grasas',    'Fats and oils',     '🫒', 60),
  ('bebidas',      'Bebidas',             'Beverages',         '🥤', 70),
  ('especias',     'Especias y condimentos', 'Spices',         '🧂', 80),
  ('suplementos',  'Suplementos',         'Supplements',       '💪', 85),
  ('preparados',   'Comidas preparadas',  'Prepared meals',    '🍲', 90),
  ('restaurante',  'Restaurantes',        'Restaurant foods',  '🍔', 91),
  ('dulces',       'Dulces y snacks',     'Sweets and snacks', '🍫', 92),
  ('otros',        'Otros',               'Other',             '🍽️', 999)
ON CONFLICT (code) DO NOTHING;
