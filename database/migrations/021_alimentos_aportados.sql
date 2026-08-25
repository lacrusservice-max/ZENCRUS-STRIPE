-- ═══════════════════════════════════════════════════════════════════════════
-- 021 · ALIMENTOS APORTADOS POR LA COMUNIDAD
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Lo que hace posible que un código de barras que no está en ninguna fuente
-- deje de ser un callejón sin salida.
--
-- Open Food Facts tiene 17.469 productos que se venden en México. Un Walmart
-- tiene muchos más. Cuando el escáner no encuentra algo, la salida es que la
-- persona que lo tiene en la mano lo dé de alta leyendo su etiqueta — y que a
-- partir de ese momento lo encuentre todo el mundo.
--
-- Aplicada el 24-ago-2026 vía Management API.
-- ═══════════════════════════════════════════════════════════════════════════

-- Quién dio de alta el alimento, cuando lo aportó una persona desde la app.
--
-- Los 10.611 alimentos de la carga inicial no tienen autor: vienen de tablas
-- de composición, no de nadie. Por eso admite NULL en lugar de inventar uno.
--
-- Sirve para dos cosas concretas el día que haya que limpiar: saber a quién
-- preguntar por una ficha rara, y poder retirar de golpe todo lo aportado por
-- una cuenta que resultara ser un problema.
ALTER TABLE foods ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Índice parcial: casi todas las filas son NULL y no tiene sentido indexarlas.
CREATE INDEX IF NOT EXISTS idx_foods_created_by ON foods (created_by) WHERE created_by IS NOT NULL;

-- La fuente de lo que aporta la gente desde la app. Separada de 'off' a
-- propósito: son datos con procedencia distinta y la licencia de Open Food
-- Facts no cubre lo que escribe un usuario nuestro leyendo una etiqueta.
INSERT INTO food_sources (code, name, url, license, attribution, official, priority)
VALUES ('usuario', 'Aportado por la comunidad ZENCRUS', NULL,
        'Uso interno', 'Comunidad ZENCRUS', FALSE, 99)
ON CONFLICT (code) DO NOTHING;
