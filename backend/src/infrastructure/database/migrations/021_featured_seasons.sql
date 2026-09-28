-- ---------------------------------------------------------------------
-- Temporadas prontas: as que já vêm no site (marcadas como destaque),
-- separadas na página inicial das temporadas personalizadas.
-- ---------------------------------------------------------------------
ALTER TABLE seasons
    ADD COLUMN featured BOOLEAN NOT NULL DEFAULT false;
