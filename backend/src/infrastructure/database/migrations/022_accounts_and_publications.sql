-- ---------------------------------------------------------------------
-- Contas e áreas do site
--   * users/user_sessions: login com usuário e senha (hash scrypt) e sessão por cookie.
--   * owner_id: temporadas, casts e personagens pertencem a quem criou (Minha Área).
--     Registros antigos ficam sem dono até alguém virar dono (npm run user:owner).
--   * publications: o que foi publicado na Área Oficial (donos) ou na Área de Fãs.
--     Substitui published_casts e a marcação "temporada pronta" (seasons.featured).
-- ---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('OWNER', 'FAN');

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(30) NOT NULL,
    password_hash TEXT        NOT NULL,
    role          user_role   NOT NULL DEFAULT 'FAN',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_username_uq ON users (lower(username));

-- Guarda só o hash (SHA-256) do token da sessão: vazar a tabela não permite entrar como ninguém.
CREATE TABLE user_sessions (
    token_hash CHAR(64)    PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX user_sessions_user_idx ON user_sessions (user_id);

-- ---------- dono de cada item da Minha Área ----------
ALTER TABLE seasons    ADD COLUMN owner_id UUID REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE casts      ADD COLUMN owner_id UUID REFERENCES users (id) ON DELETE CASCADE;
ALTER TABLE characters ADD COLUMN owner_id UUID REFERENCES users (id) ON DELETE CASCADE;

CREATE INDEX seasons_owner_idx    ON seasons (owner_id);
CREATE INDEX casts_owner_idx      ON casts (owner_id);
CREATE INDEX characters_owner_idx ON characters (owner_id);

-- Nomes únicos agora são por pessoa (duas pessoas podem ter um personagem "Ana").
DROP INDEX characters_name_uq;
DROP INDEX casts_name_uq;
CREATE UNIQUE INDEX characters_owner_name_uq ON characters (owner_id, lower(name));
CREATE UNIQUE INDEX casts_owner_name_uq      ON casts (owner_id, lower(name));

-- ---------- publicações ----------
CREATE TYPE publication_kind AS ENUM ('SEASON', 'CAST', 'CHARACTER');
CREATE TYPE publication_area AS ENUM ('OFFICIAL', 'FAN');

CREATE TABLE publications (
    id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    kind         publication_kind NOT NULL,
    area         publication_area NOT NULL,
    publisher_id UUID             REFERENCES users (id) ON DELETE CASCADE,
    -- temporada publicada: é a própria temporada, ao vivo (somente leitura para os outros)
    season_id    UUID             REFERENCES seasons (id) ON DELETE CASCADE,
    -- cast/personagem de origem: republicar atualiza a mesma publicação
    cast_id      UUID             REFERENCES casts (id) ON DELETE SET NULL,
    character_id UUID             REFERENCES characters (id) ON DELETE SET NULL,
    name         VARCHAR(120)     NOT NULL,
    description  TEXT,
    image_url    TEXT             CHECK (image_url ~* '^https?://'),
    -- cópia congelada (casts e personagens); temporadas são lidas ao vivo
    snapshot     JSONB,
    published_at TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT publications_season_chk   CHECK ((kind = 'SEASON') = (season_id IS NOT NULL)),
    CONSTRAINT publications_snapshot_chk CHECK (kind = 'SEASON' OR snapshot IS NOT NULL)
);

CREATE UNIQUE INDEX publications_season_uq    ON publications (season_id)    WHERE season_id IS NOT NULL;
CREATE UNIQUE INDEX publications_cast_uq      ON publications (cast_id)      WHERE cast_id IS NOT NULL;
CREATE UNIQUE INDEX publications_character_uq ON publications (character_id) WHERE character_id IS NOT NULL;
CREATE INDEX publications_listing_idx ON publications (area, kind, published_at DESC);

-- Casts prontos e temporadas prontas feitos até aqui viram publicações oficiais
-- (o dono é definido quando alguém for promovido a dono).
INSERT INTO publications (id, kind, area, cast_id, name, description, image_url, snapshot, published_at)
SELECT id, 'CAST', 'OFFICIAL', source_cast_id, name, description, image_url, snapshot, published_at
  FROM published_casts;

INSERT INTO publications (kind, area, season_id, name)
SELECT 'SEASON', 'OFFICIAL', id, name
  FROM seasons
 WHERE featured;

DROP TABLE published_casts;
ALTER TABLE seasons DROP COLUMN featured;
