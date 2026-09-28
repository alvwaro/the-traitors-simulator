-- ---------------------------------------------------------------------
-- Voltar nas temporadas manuais
--   * season_snapshots: antes de cada registro (missão, mesa redonda, torre,
--     avançar fase...), o estado inteiro da temporada é guardado. "Voltar"
--     restaura o último e o descarta. Ficam só os mais recentes.
-- ---------------------------------------------------------------------
CREATE TABLE season_snapshots (
    seq        BIGSERIAL    PRIMARY KEY,
    season_id  UUID         NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
    label      VARCHAR(120) NOT NULL,
    data       JSONB        NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX season_snapshots_season_idx ON season_snapshots (season_id, seq DESC);
