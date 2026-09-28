-- =====================================================================
-- Frases das conversas simuladas (café da manhã e missão).
-- Marcadores: cada marcador diferente ({user}, {user1}, {user2}...) é uma pessoa diferente;
-- o mesmo marcador repetido é sempre a mesma pessoa.
-- =====================================================================

CREATE TYPE phrase_phase AS ENUM ('BREAKFAST', 'MISSION');

CREATE TABLE phrases (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    phase      phrase_phase NOT NULL,
    text       VARCHAR(300) NOT NULL CHECK (length(trim(text)) > 0),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX phrases_phase_text_uq ON phrases (phase, lower(text));
