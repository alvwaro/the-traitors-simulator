-- ---------------------------------------------------------------------
-- Fotos por cast, página de participante e escudos misteriosos
--   * characters.photos: galeria de fotos extras do personagem ([{ url, label }]).
--   * cast_members.image_url: a foto do personagem naquele cast (a mesma pessoa
--     em duas temporadas aparece com a foto de cada uma). Null = foto principal.
--   * characters.profile: página de informações do participante (temporadas de
--     The Traitors, outros realities, papel e destino em cada uma, link da wiki).
--   * seasons.hidden_shield_chance: chance (0 a 100) de os escudos de uma missão
--     ficarem em segredo na simulação; missions.shields_hidden guarda o resultado.
-- ---------------------------------------------------------------------
ALTER TABLE characters
    ADD COLUMN photos  JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN profile JSONB;

ALTER TABLE cast_members
    ADD COLUMN image_url TEXT CHECK (image_url ~* '^https?://');

ALTER TABLE seasons
    ADD COLUMN hidden_shield_chance SMALLINT NOT NULL DEFAULT 0
        CHECK (hidden_shield_chance BETWEEN 0 AND 100);

ALTER TABLE missions
    ADD COLUMN shields_hidden BOOLEAN NOT NULL DEFAULT false;
