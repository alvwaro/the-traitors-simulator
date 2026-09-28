-- =====================================================================
-- Biblioteca de personagens e casts salvos
--
--   characters ── cast_members ── casts
--        │                          │
--        └── players.character_id   └── seasons.cast_id (cast de origem)
--
-- O jogador guarda uma cópia do nome/imagem do personagem: editar ou apagar
-- o personagem na biblioteca não altera temporadas já registradas.
-- =====================================================================

CREATE TABLE characters (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(80) NOT NULL,
    image_url  TEXT        CHECK (image_url ~* '^https?://'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX characters_name_uq ON characters (lower(name));

CREATE TABLE casts (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(120) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX casts_name_uq ON casts (lower(name));

CREATE TABLE cast_members (
    cast_id      UUID     NOT NULL REFERENCES casts (id) ON DELETE CASCADE,
    character_id UUID     NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
    position     SMALLINT NOT NULL CHECK (position >= 1),

    PRIMARY KEY (cast_id, character_id),
    CONSTRAINT cast_members_position_uq UNIQUE (cast_id, position)
);

CREATE INDEX cast_members_character_idx ON cast_members (character_id);

ALTER TABLE players
    ADD COLUMN character_id UUID REFERENCES characters (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX players_season_character_uq
    ON players (season_id, character_id) WHERE character_id IS NOT NULL;

ALTER TABLE seasons
    ADD COLUMN cast_id UUID REFERENCES casts (id) ON DELETE SET NULL;
