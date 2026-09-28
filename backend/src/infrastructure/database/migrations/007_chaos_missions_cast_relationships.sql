-- =====================================================================
-- Loucura, conjunto de missões, estado da simulação e relacionamentos do cast.
--
--   seasons.chaos          0 a 100: chance de cada decisão fugir do comportamento esperado
--   seasons.mission_pool   de qual temporada vêm as missões (S1, S2, S3 ou MIX)
--   seasons.sim_state      memória da simulação entre fases (reviravoltas já usadas etc.)
--   cast_relationships     o que um personagem sente por outro dentro de um cast;
--                          vira o relacionamento inicial das temporadas criadas com o cast
-- =====================================================================

ALTER TABLE seasons
    ADD COLUMN chaos        SMALLINT    NOT NULL DEFAULT 0 CHECK (chaos BETWEEN 0 AND 100),
    ADD COLUMN mission_pool VARCHAR(8)  NOT NULL DEFAULT 'S3' CHECK (mission_pool IN ('S1', 'S2', 'S3', 'MIX')),
    ADD COLUMN sim_state    JSONB       NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE cast_relationships (
    cast_id           UUID     NOT NULL REFERENCES casts (id) ON DELETE CASCADE,
    from_character_id UUID     NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
    to_character_id   UUID     NOT NULL REFERENCES characters (id) ON DELETE CASCADE,
    trust             SMALLINT NOT NULL CHECK (trust BETWEEN 0 AND 100),
    liking            SMALLINT NOT NULL CHECK (liking BETWEEN 0 AND 100),
    hatred            SMALLINT NOT NULL CHECK (hatred BETWEEN 0 AND 100),
    allied            BOOLEAN  NOT NULL DEFAULT false,

    PRIMARY KEY (cast_id, from_character_id, to_character_id),
    CONSTRAINT cast_relationships_not_self_chk CHECK (from_character_id <> to_character_id)
);

-- ---------------------------------------------------------------------
-- Mais comportamentos (usam também as chaves novas grudge, insight,
-- unpredictability e conformity; ver domain/entities/Behavior.ts)
-- ---------------------------------------------------------------------
INSERT INTO behaviors (name, description, effects) VALUES
  ('Vingativo', 'Não esquece um voto contra si: o ódio demora a passar e vira voto.',
   '{"grudge": 45, "aggression": 15}'),
  ('Detetive', 'Lê as pessoas como um livro: percebe os traidores mais rápido.',
   '{"insight": 45, "paranoia": 10, "influence": 5}'),
  ('Caótico', 'Ninguém sabe o que vai fazer — nem ele(a). Surpreende mesmo com a loucura em 0%.',
   '{"unpredictability": 45, "volatility": 20}'),
  ('Protetor', 'Adota os mais fracos e defende os aliados até o fim.',
   '{"loyalty": 30, "likeGiven": 15, "hateGiven": -10}'),
  ('Líder', 'Organiza o grupo, puxa votos e vira alvo por isso.',
   '{"influence": 35, "sociability": 15, "hateReceived": 5, "skill": 5}'),
  ('Observador', 'Fala pouco e vê tudo.',
   '{"insight": 25, "sociability": -20, "paranoia": 5}'),
  ('Mentiroso', 'Mente com uma naturalidade assustadora.',
   '{"deception": 45, "trustReceived": -5}'),
  ('Chorão', 'Chora no café, na missão e na mesa redonda. Às vezes funciona.',
   '{"volatility": 40, "likeReceived": 5, "influence": -5}'),
  ('Brincalhão', 'Alivia o clima com piadas, mas nem sempre é levado(a) a sério.',
   '{"sociability": 35, "likeReceived": 15, "influence": -10}'),
  ('Frio', 'Nada abala. Nem uma morte, nem uma acusação.',
   '{"volatility": -35, "likeGiven": -15, "deception": 15}'),
  ('Traíra', 'Troca de lado na primeira oportunidade.',
   '{"loyalty": -45, "deception": 15, "trustReceived": -5}'),
  ('Arrogante', 'Acha que já ganhou. O castelo discorda.',
   '{"hateReceived": 20, "influence": 10, "likeGiven": -15}'),
  ('Diplomata', 'Apaga incêndios e evita inimigos.',
   '{"hateGiven": -20, "hateReceived": -15, "influence": 15}'),
  ('Sonso', 'Parece inofensivo(a). Parece.',
   '{"deception": 25, "trustReceived": 15, "sociability": -10}'),
  ('Heroico', 'Se joga em qualquer missão e abre mão de escudo pelo grupo.',
   '{"skill": 25, "loyalty": 20, "likeReceived": 10}'),
  ('Carente', 'Quer ser amado(a) por todos e confia rápido demais.',
   '{"likeGiven": 30, "trustGiven": 20, "volatility": 15}'),
  ('Ovelha', 'Vota com a maioria, sempre. Bééé.',
   '{"conformity": 45, "influence": -20, "paranoia": -10}'),
  ('Rebelde', 'Se todo mundo vota em alguém, vota em outra pessoa.',
   '{"conformity": -40, "aggression": 15}')
ON CONFLICT DO NOTHING;
