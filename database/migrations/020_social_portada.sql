-- ════════════════════════════════════════════════════════════════════════════
-- 020 · LA PORTADA DEL PERFIL
-- ════════════════════════════════════════════════════════════════════════════
--
-- Hasta ahora la banda de arriba del perfil se sacaba de la foto de la última
-- publicación de esa persona. Funcionaba, pero no se podía elegir: bastaba
-- subir cualquier cosa para que la cabecera cambiara sola.
--
-- Esta columna guarda la portada ELEGIDA. Cuando está vacía se sigue cayendo a
-- la última publicación, así que ninguna cuenta existente cambia de aspecto al
-- aplicar esto.
--
-- Guarda una CLAVE del bucket (`cover/<id de usuario>/<algo>.jpg`), no una
-- dirección: el bucket es privado y las direcciones se firman al leer y
-- caducan. Es lo mismo que hace `profile_picture`.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image TEXT;

COMMENT ON COLUMN users.cover_image IS
  'Portada del perfil social: clave del bucket (cover/<uid>/...). NULL = usar la última publicación.';
