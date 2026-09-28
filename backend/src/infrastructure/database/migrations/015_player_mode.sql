-- =====================================================================
-- Modo Jogador: o usuário entra no castelo como participante.
--
--   seasons.mode = 'PLAYER'      simulação automática com um jogador humano
--   seasons.interaction_limit    quantas conversas o jogador pode ter em cada momento
--   players.is_human             o jogador controlado pelo usuário (um por temporada)
-- =====================================================================

ALTER TYPE season_mode ADD VALUE IF NOT EXISTS 'PLAYER';

ALTER TABLE seasons
    ADD COLUMN interaction_limit SMALLINT NOT NULL DEFAULT 3 CHECK (interaction_limit BETWEEN 0 AND 20);

ALTER TABLE players
    ADD COLUMN is_human BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX players_one_human_uq ON players (season_id) WHERE is_human;
