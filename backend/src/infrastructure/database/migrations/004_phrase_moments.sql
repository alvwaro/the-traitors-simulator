-- =====================================================================
-- Frases para todos os momentos do jogo (não só café da manhã e missão).
-- Arquivo separado: um valor novo de enum só pode ser usado depois do COMMIT.
-- =====================================================================

ALTER TYPE phrase_phase ADD VALUE IF NOT EXISTS 'ARRIVAL' BEFORE 'BREAKFAST';
ALTER TYPE phrase_phase ADD VALUE IF NOT EXISTS 'ROUND_TABLE';
ALTER TYPE phrase_phase ADD VALUE IF NOT EXISTS 'TRAITORS_MEETING';
ALTER TYPE phrase_phase ADD VALUE IF NOT EXISTS 'ENDGAME';
