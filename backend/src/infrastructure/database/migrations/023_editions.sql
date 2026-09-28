-- ---------------------------------------------------------------------
-- Temporadas do programa separadas por país
--   * seasons.mission_pool: EUA e Reino Unido têm missões, valores e reviravoltas
--     diferentes em cada temporada (US_S1..UK_S3, ou MIX). Os valores antigos
--     (S1, S2, S3) eram as missões americanas.
-- ---------------------------------------------------------------------
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_mission_pool_check;

UPDATE seasons SET mission_pool = 'US_' || mission_pool WHERE mission_pool IN ('S1', 'S2', 'S3');

ALTER TABLE seasons
    ALTER COLUMN mission_pool SET DEFAULT 'US_S3',
    ADD CONSTRAINT seasons_mission_pool_check
        CHECK (mission_pool IN ('US_S1', 'UK_S1', 'US_S2', 'UK_S2', 'US_S3', 'UK_S3', 'MIX'));
