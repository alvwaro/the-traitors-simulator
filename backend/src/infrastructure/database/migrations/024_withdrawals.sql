-- ---------------------------------------------------------------------
-- Desistências opcionais
--   * seasons.allow_withdrawals: se a simulação pode tirar alguém do castelo
--     "por motivos pessoais".
-- ---------------------------------------------------------------------
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS allow_withdrawals BOOLEAN NOT NULL DEFAULT TRUE;
