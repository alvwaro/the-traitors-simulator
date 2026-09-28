-- =====================================================================
-- Simulação automática
--
--   behaviors ─┬─ character_behaviors ── characters
--              ├─ player_behaviors ───── players
--              └─ phrases.behavior_id   (frases típicas daquele comportamento)
--
--   seasons.mode = 'AUTOMATIC' → relationships (quem sente o quê por quem)
--                              → simulation_events (a narrativa de cada fase)
-- =====================================================================

CREATE TYPE season_mode AS ENUM ('MANUAL', 'AUTOMATIC');
ALTER TABLE seasons ADD COLUMN mode season_mode NOT NULL DEFAULT 'MANUAL';

-- Foto de capa opcional do cast (a biblioteca mostra a capa em vez de todo o elenco).
ALTER TABLE casts ADD COLUMN image_url TEXT CHECK (image_url ~* '^https?://');

-- ---------------------------------------------------------------------
-- Comportamentos (tags de personalidade). effects: modificadores de -50 a +50
-- (ver domain/entities/Behavior.ts para o significado de cada chave).
-- ---------------------------------------------------------------------
CREATE TABLE behaviors (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(40) NOT NULL CHECK (length(trim(name)) > 0),
    description TEXT,
    effects     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX behaviors_name_uq ON behaviors (lower(name));

CREATE TABLE character_behaviors (
    character_id UUID NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
    behavior_id  UUID NOT NULL REFERENCES behaviors (id) ON DELETE CASCADE,
    PRIMARY KEY (character_id, behavior_id)
);

-- O jogador guarda a própria cópia das tags (como faz com nome e foto).
CREATE TABLE player_behaviors (
    player_id   UUID NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    behavior_id UUID NOT NULL REFERENCES behaviors (id) ON DELETE CASCADE,
    PRIMARY KEY (player_id, behavior_id)
);

-- ---------------------------------------------------------------------
-- Frases: teor + comportamento ligado
-- ---------------------------------------------------------------------
CREATE TYPE phrase_tone AS ENUM (
    'NEUTRAL', 'FRIENDLY', 'ALLIANCE', 'SUSPICION', 'ACCUSATION',
    'CONFLICT', 'DEFENSE', 'STRATEGY', 'EMOTION', 'HUMOR'
);

ALTER TABLE phrases
    ADD COLUMN tone        phrase_tone NOT NULL DEFAULT 'NEUTRAL',
    ADD COLUMN behavior_id UUID REFERENCES behaviors (id) ON DELETE SET NULL;

ALTER TABLE phrases ALTER COLUMN text TYPE VARCHAR(400);

-- ---------------------------------------------------------------------
-- Relacionamentos (direcionais: o que "from" sente por "to"), de 0 a 100.
-- ---------------------------------------------------------------------
CREATE TABLE relationships (
    season_id      UUID        NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
    from_player_id UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    to_player_id   UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    trust          SMALLINT    NOT NULL CHECK (trust BETWEEN 0 AND 100),
    liking         SMALLINT    NOT NULL CHECK (liking BETWEEN 0 AND 100),
    hatred         SMALLINT    NOT NULL CHECK (hatred BETWEEN 0 AND 100),
    allied         BOOLEAN     NOT NULL DEFAULT false,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (from_player_id, to_player_id),
    CONSTRAINT relationships_not_self_chk CHECK (from_player_id <> to_player_id)
);

CREATE INDEX relationships_season_idx ON relationships (season_id);

-- ---------------------------------------------------------------------
-- Narrativa da simulação. text usa os marcadores {user}, {user1}...;
-- player_ids traz quem ocupa cada marcador, na ordem de aparição.
-- ---------------------------------------------------------------------
CREATE TABLE simulation_events (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id  UUID        NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
    day_id     UUID        NOT NULL REFERENCES days (id) ON DELETE CASCADE,
    phase      game_phase  NOT NULL,
    sequence   INTEGER     NOT NULL,
    kind       VARCHAR(30) NOT NULL,
    tone       phrase_tone,
    text       TEXT        NOT NULL,
    player_ids UUID[]      NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT simulation_events_sequence_uq UNIQUE (day_id, phase, sequence)
);

CREATE INDEX simulation_events_season_idx ON simulation_events (season_id);

-- ---------------------------------------------------------------------
-- Comportamentos iniciais
-- ---------------------------------------------------------------------
INSERT INTO behaviors (name, description, effects) VALUES
  ('Fiel', 'Leal até o fim: transforma confiança em aliança e dificilmente trai quem está ao seu lado.',
   '{"loyalty": 50, "trustGiven": 10, "trustReceived": 10}'),
  ('Amado', 'O castelo inteiro gosta dele(a). Difícil votar em quem todos adoram.',
   '{"likeReceived": 30, "trustReceived": 10, "hateReceived": -10}'),
  ('Querido', 'Simpático(a) com todo mundo e sempre puxando conversa.',
   '{"likeGiven": 20, "likeReceived": 20, "sociability": 15}'),
  ('Invejoso', 'Não suporta ver os outros brilhando: cria ódio pelos mais queridos.',
   '{"envy": 40, "likeGiven": -10, "hateGiven": 10, "hateReceived": 5}'),
  ('Astuto', 'Pensa três jogadas à frente. Como traidor(a), esconde bem o jogo.',
   '{"deception": 35, "influence": 10, "paranoia": 10, "trustReceived": -5}'),
  ('Paranoico', 'Desconfia de todos e vota em quem acha suspeito.',
   '{"paranoia": 45, "trustGiven": -25}'),
  ('Explosivo', 'Pavio curto: vota por raiva e transforma qualquer conversa em briga.',
   '{"aggression": 40, "volatility": 35, "hateReceived": 10}'),
  ('Carismático', 'Quando fala, a mesa escuta. Suas acusações mudam votos.',
   '{"influence": 40, "likeReceived": 15, "sociability": 20}'),
  ('Competitivo', 'Vive para as missões e odeia perder.',
   '{"skill": 35, "aggression": 10, "hateReceived": 5}'),
  ('Estrategista', 'Joga com frieza, calculando votos e alianças.',
   '{"influence": 15, "deception": 20, "skill": 10, "loyalty": -10}'),
  ('Ingênuo', 'Acredita em todo mundo e mente muito mal.',
   '{"trustGiven": 30, "paranoia": -35, "deception": -30}'),
  ('Manipulador', 'Usa as pessoas como peças e trai sem remorso.',
   '{"deception": 40, "influence": 20, "loyalty": -25, "trustReceived": -10}'),
  ('Dramático', 'Tudo é intenso: chora, grita, faz discurso e muda de ideia.',
   '{"volatility": 45, "sociability": 25, "aggression": 10}'),
  ('Tímido', 'Fala pouco e passa despercebido(a), o que pode salvar ou condenar.',
   '{"sociability": -35, "influence": -25, "hateReceived": -10}'),
  ('Fofoqueiro', 'Sabe de tudo e conta para todos.',
   '{"sociability": 40, "influence": 10, "trustReceived": -10}')
ON CONFLICT DO NOTHING;
