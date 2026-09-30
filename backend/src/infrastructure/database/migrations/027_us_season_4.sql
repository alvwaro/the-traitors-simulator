-- ---------------------------------------------------------------------
-- 4ª temporada americana (2026): novo conjunto de missões US_S4.
-- ---------------------------------------------------------------------
ALTER TABLE seasons DROP CONSTRAINT IF EXISTS seasons_mission_pool_check;

ALTER TABLE seasons
    ADD CONSTRAINT seasons_mission_pool_check
        CHECK (mission_pool IN ('US_S1', 'UK_S1', 'US_S2', 'UK_S2', 'US_S3', 'UK_S3', 'US_S4', 'MIX'));
