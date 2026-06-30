-- ============================================================
-- ZENCRUS — Migración 004: Tablas de red social
-- ============================================================

-- Extender perfil de usuario con bio y campos sociales
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS location VARCHAR(100),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Posts sociales (fotos, texto, historias)
CREATE TABLE IF NOT EXISTS social_posts (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(20)  NOT NULL DEFAULT 'post',  -- 'post' | 'story'
  caption       TEXT,
  media_url     TEXT,
  media_type    VARCHAR(20),                           -- 'image' | 'video'
  likes_count   INTEGER      NOT NULL DEFAULT 0,
  comments_count INTEGER     NOT NULL DEFAULT 0,
  is_flagged    BOOLEAN      NOT NULL DEFAULT FALSE,
  expires_at    TIMESTAMPTZ,                           -- solo stories
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Relaciones de seguimiento (follows)
CREATE TABLE IF NOT EXISTS social_follows (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Likes en posts
CREATE TABLE IF NOT EXISTS social_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Comentarios en posts
CREATE TABLE IF NOT EXISTS social_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  is_flagged BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_social_posts_user_id    ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_type       ON social_posts(type);
CREATE INDEX IF NOT EXISTS idx_social_follows_follower ON social_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_social_follows_following ON social_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_social_likes_post_id    ON social_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_post_id ON social_comments(post_id);

-- Trigger para mantener likes_count actualizado
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_likes_count
AFTER INSERT OR DELETE ON social_likes
FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Trigger para comments_count
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE social_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE social_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_comments_count
AFTER INSERT OR DELETE ON social_comments
FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();
