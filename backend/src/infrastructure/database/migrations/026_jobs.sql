-- ---------------------------------------------------------------------
-- Fila de trabalhos (jobs) para rodar fora das requisições, no worker
--   * jobs: cada linha é um trabalho; o worker pega o próximo vencido com
--     FOR UPDATE SKIP LOCKED (vários workers nunca pegam o mesmo).
--   * dedupe_key: o mesmo trabalho agendado por várias instâncias entra uma vez só.
--   * falhas voltam para a fila com espera crescente; passando do máximo de
--     tentativas, ficam como 'failed' (fila de mortos) para análise.
-- ---------------------------------------------------------------------
CREATE TABLE jobs (
    id           BIGSERIAL    PRIMARY KEY,
    type         VARCHAR(80)  NOT NULL,
    payload      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    status       VARCHAR(10)  NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
    attempts     INT          NOT NULL DEFAULT 0,
    max_attempts INT          NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
    run_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    locked_at    TIMESTAMPTZ,
    last_error   TEXT,
    dedupe_key   VARCHAR(200),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX jobs_dedupe_key_uq ON jobs (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX jobs_due_idx ON jobs (run_at) WHERE status IN ('queued', 'running');
CREATE INDEX jobs_finished_idx ON jobs (finished_at) WHERE status = 'done';

-- A limpeza das sessões vencidas (agora um trabalho da fila) não varre a tabela inteira.
CREATE INDEX user_sessions_expires_idx ON user_sessions (expires_at);
