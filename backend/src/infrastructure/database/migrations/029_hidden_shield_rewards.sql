-- ---------------------------------------------------------------------
-- Escudos escondidos um a um
--   * mission_rewards.hidden: na simulação manual, quem registra a missão pode
--     esconder um escudo específico (ou todos); nas telas e nas artes ele
--     aparece como "?", sem foto e sem nome.
-- ---------------------------------------------------------------------
ALTER TABLE mission_rewards
    ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT false;
