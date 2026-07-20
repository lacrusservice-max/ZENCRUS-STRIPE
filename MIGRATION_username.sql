-- Ejecutar en Supabase → SQL Editor
-- Agrega la columna username a la tabla users

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Comentario: username es opcional — usuarios existentes tendrán NULL
-- El frontend asigna username durante el nuevo flujo de registro
