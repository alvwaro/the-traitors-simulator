-- =====================================================================
-- The Traitors - schema inicial
--
-- Modelo:
--   seasons ─┬─ players
--            ├─ days ─┬─ day_phases           (log das fases + anotações/interações)
--            │        ├─ missions ── mission_rewards (escudos)
--            │        ├─ round_tables ─┬─ round_table_votes
--            │        │                └─ endgame_votes
--            │        └─ traitor_meetings ─┬─ murders
--            │                             └─ recruitments
--            ├─ prize_transactions  (livro-caixa do prêmio)
--            └─ season_winners
--
-- O estado atual da simulação fica em seasons.current_day / current_phase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
CREATE TYPE season_status AS ENUM ('SETUP', 'IN_PROGRESS', 'ENDGAME', 'FINISHED');

CREATE TYPE game_phase AS ENUM (
    'ARRIVAL',              -- dia 1: chegada ao castelo, interações iniciais
    'TRAITOR_SELECTION',    -- dia 1: escolha dos traidores
    'BREAKFAST',            -- dia 2+: café da manhã, revelação do assassinato
    'MISSION',              -- desafio: escudos e dinheiro para o prêmio
    'ROUND_TABLE',          -- dia 2+: banimento
    'TRAITORS_MEETING',     -- reunião dos traidores: assassinato / recrutamento
    'ENDGAME_ROUND_TABLE',  -- final: votar "encerrar" x "banir de novo"
    'FINALE'                -- temporada encerrada
);

CREATE TYPE player_role          AS ENUM ('FAITHFUL', 'TRAITOR');
CREATE TYPE player_status        AS ENUM ('ACTIVE', 'BANISHED', 'MURDERED', 'WITHDRAWN');
CREATE TYPE reward_type          AS ENUM ('SHIELD');
CREATE TYPE prize_transaction_type AS ENUM ('MISSION', 'PENALTY', 'ADJUSTMENT');
CREATE TYPE round_table_kind     AS ENUM ('REGULAR', 'ENDGAME');
CREATE TYPE murder_outcome       AS ENUM ('SUCCESS', 'BLOCKED_BY_SHIELD');
CREATE TYPE recruitment_outcome  AS ENUM ('ACCEPTED', 'DECLINED');
CREATE TYPE endgame_choice       AS ENUM ('END_GAME', 'BANISH_AGAIN');

-- ---------------------------------------------------------------------
-- Temporadas
-- ---------------------------------------------------------------------
CREATE TABLE seasons (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(120)  NOT NULL,
    status            season_status NOT NULL DEFAULT 'SETUP',
    current_day       SMALLINT      CHECK (current_day >= 1),
    current_phase     game_phase,
    currency          CHAR(3)       NOT NULL DEFAULT 'BRL',
    initial_prize_pot NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (initial_prize_pot >= 0),
    max_prize_pot     NUMERIC(12,2),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,

    CONSTRAINT seasons_max_prize_chk
        CHECK (max_prize_pot IS NULL OR max_prize_pot >= initial_prize_pot),
    -- Em SETUP ainda não existe dia/fase; depois de iniciada, sempre existe.
    CONSTRAINT seasons_state_chk CHECK (
        (status = 'SETUP'  AND current_day IS NULL     AND current_phase IS NULL     AND started_at IS NULL) OR
        (status <> 'SETUP' AND current_day IS NOT NULL AND current_phase IS NOT NULL AND started_at IS NOT NULL)
    ),
    CONSTRAINT seasons_finished_chk CHECK ((status = 'FINISHED') = (finished_at IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- Dias (1 dia = 1 episódio) e log de fases
-- ---------------------------------------------------------------------
CREATE TABLE days (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id  UUID        NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
    number     SMALLINT    NOT NULL CHECK (number >= 1),
    title      VARCHAR(160),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT days_season_number_uq UNIQUE (season_id, number)
);

CREATE TABLE day_phases (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id     UUID        NOT NULL REFERENCES days (id) ON DELETE CASCADE,
    phase      game_phase  NOT NULL,
    notes      TEXT,       -- interações, acontecimentos livres da fase
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at   TIMESTAMPTZ,

    CONSTRAINT day_phases_day_phase_uq UNIQUE (day_id, phase),
    CONSTRAINT day_phases_period_chk CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- ---------------------------------------------------------------------
-- Jogadores
-- ---------------------------------------------------------------------
CREATE TABLE players (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id           UUID          NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
    name                VARCHAR(80)   NOT NULL,
    image_url           TEXT          CHECK (image_url ~* '^https?://'),
    role                player_role   NOT NULL DEFAULT 'FAITHFUL',
    is_original_traitor BOOLEAN       NOT NULL DEFAULT false,  -- false para recrutados
    status              player_status NOT NULL DEFAULT 'ACTIVE',
    eliminated_day_id   UUID          REFERENCES days (id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT players_original_traitor_chk CHECK (NOT is_original_traitor OR role = 'TRAITOR'),
    CONSTRAINT players_elimination_chk CHECK ((status = 'ACTIVE') = (eliminated_day_id IS NULL))
);

CREATE UNIQUE INDEX players_season_name_uq ON players (season_id, lower(name));
CREATE INDEX players_season_status_idx ON players (season_id, status);
CREATE INDEX players_eliminated_day_idx ON players (eliminated_day_id);

-- ---------------------------------------------------------------------
-- Missões (desafios) e escudos
-- ---------------------------------------------------------------------
CREATE TABLE missions (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id          UUID          NOT NULL REFERENCES days (id) ON DELETE CASCADE,
    name            VARCHAR(120)  NOT NULL,
    description     TEXT,
    prize_available NUMERIC(12,2) CHECK (prize_available >= 0),  -- quanto dava pra ganhar
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX missions_day_idx ON missions (day_id);

-- Escudos valem para a reunião dos traidores do MESMO dia da missão.
CREATE TABLE mission_rewards (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id  UUID        NOT NULL REFERENCES missions (id) ON DELETE CASCADE,
    player_id   UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    reward_type reward_type NOT NULL DEFAULT 'SHIELD',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT mission_rewards_uq UNIQUE (mission_id, player_id, reward_type)
);

CREATE INDEX mission_rewards_player_idx ON mission_rewards (player_id);

-- ---------------------------------------------------------------------
-- Prêmio: livro-caixa. Pote = initial_prize_pot + SUM(amount).
-- O valor ganho numa missão é a transação MISSION ligada a ela.
-- ---------------------------------------------------------------------
CREATE TABLE prize_transactions (
    id          UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id   UUID                   NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
    day_id      UUID                   REFERENCES days (id) ON DELETE CASCADE,
    mission_id  UUID                   UNIQUE REFERENCES missions (id) ON DELETE CASCADE,
    type        prize_transaction_type NOT NULL,
    amount      NUMERIC(12,2)          NOT NULL CHECK (amount <> 0),  -- negativo = penalidade
    description VARCHAR(255),
    created_at  TIMESTAMPTZ            NOT NULL DEFAULT now(),

    CONSTRAINT prize_transactions_mission_chk CHECK ((type = 'MISSION') = (mission_id IS NOT NULL))
);

CREATE INDEX prize_transactions_season_idx ON prize_transactions (season_id);

CREATE VIEW season_prize_pots AS
SELECT s.id                                     AS season_id,
       s.initial_prize_pot + COALESCE(SUM(t.amount), 0) AS prize_pot
FROM seasons s
LEFT JOIN prize_transactions t ON t.season_id = s.id
GROUP BY s.id;

-- ---------------------------------------------------------------------
-- Mesa redonda (banimento) e votos
-- ---------------------------------------------------------------------
CREATE TABLE round_tables (
    id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id             UUID             NOT NULL REFERENCES days (id) ON DELETE CASCADE,
    kind               round_table_kind NOT NULL DEFAULT 'REGULAR',
    sequence           SMALLINT         NOT NULL DEFAULT 1 CHECK (sequence >= 1),  -- final pode ter várias
    banished_player_id UUID             UNIQUE REFERENCES players (id),           -- null = ninguém saiu (ex.: final encerrada)
    notes              TEXT,
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT round_tables_day_sequence_uq UNIQUE (day_id, sequence),
    CONSTRAINT round_tables_id_kind_uq UNIQUE (id, kind)  -- alvo da FK composta de endgame_votes
);

-- round > 1 = revotação em caso de empate
CREATE TABLE round_table_votes (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    round_table_id UUID        NOT NULL REFERENCES round_tables (id) ON DELETE CASCADE,
    round          SMALLINT    NOT NULL DEFAULT 1 CHECK (round >= 1),
    voter_id       UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    target_id      UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT round_table_votes_one_per_round_uq UNIQUE (round_table_id, round, voter_id),
    CONSTRAINT round_table_votes_not_self_chk CHECK (voter_id <> target_id)
);

CREATE INDEX round_table_votes_target_idx ON round_table_votes (target_id);

-- Só existe em mesas do tipo ENDGAME (garantido pela FK composta).
CREATE TABLE endgame_votes (
    id             UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    round_table_id UUID             NOT NULL,
    kind           round_table_kind NOT NULL DEFAULT 'ENDGAME' CHECK (kind = 'ENDGAME'),
    voter_id       UUID             NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    choice         endgame_choice   NOT NULL,
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT endgame_votes_round_table_fk
        FOREIGN KEY (round_table_id, kind) REFERENCES round_tables (id, kind) ON DELETE CASCADE,
    CONSTRAINT endgame_votes_one_per_voter_uq UNIQUE (round_table_id, voter_id)
);

-- ---------------------------------------------------------------------
-- Reunião dos traidores: assassinato e recrutamento
-- ---------------------------------------------------------------------
CREATE TABLE traitor_meetings (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id     UUID        NOT NULL UNIQUE REFERENCES days (id) ON DELETE CASCADE,
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE murders (
    id         UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID           NOT NULL UNIQUE REFERENCES traitor_meetings (id) ON DELETE CASCADE,
    target_id  UUID           NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    outcome    murder_outcome NOT NULL DEFAULT 'SUCCESS',
    created_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX murders_target_success_uq ON murders (target_id) WHERE outcome = 'SUCCESS';

-- Ultimato recusado => registrar também um murder para o alvo.
CREATE TABLE recruitments (
    id           UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id   UUID                NOT NULL REFERENCES traitor_meetings (id) ON DELETE CASCADE,
    target_id    UUID                NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    is_ultimatum BOOLEAN             NOT NULL DEFAULT false,
    outcome      recruitment_outcome NOT NULL,
    created_at   TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT recruitments_meeting_target_uq UNIQUE (meeting_id, target_id)
);

CREATE UNIQUE INDEX recruitments_target_accepted_uq ON recruitments (target_id) WHERE outcome = 'ACCEPTED';

-- ---------------------------------------------------------------------
-- Vencedores
-- ---------------------------------------------------------------------
CREATE TABLE season_winners (
    season_id   UUID          NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
    player_id   UUID          NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    prize_share NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (prize_share >= 0),

    PRIMARY KEY (season_id, player_id)
);
