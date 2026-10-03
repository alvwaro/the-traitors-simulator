-- ---------------------------------------------------------------------
-- Temporadas publicadas viram cópias, como casts e personagens
--   * Antes a publicação apontava para a própria temporada, lida ao vivo: jogar a
--     temporada de origem mudava o que todos viam. Agora publicar guarda o que se
--     copia, do jeito que estava na hora:
--       - season:   as configurações (modo, missões, prêmio, moeda, loucura...);
--       - snapshot: o elenco (nome, foto, comportamentos e o personagem de origem).
--     O andamento do jogo não vai junto. "Atualizar publicação" tira uma cópia nova.
--     season_id fica só como a origem: apagar a temporada não tira a publicação do ar.
--   * country: as Temporadas Oficiais se dividem entre EUA e Reino Unido.
--   * Página do participante: cada participação aponta para a publicação da
--     temporada (profile.seasons[].publicationId), não mais para a temporada.
-- ---------------------------------------------------------------------
ALTER TABLE publications
    DROP CONSTRAINT publications_season_chk,
    DROP CONSTRAINT publications_season_id_fkey,
    ADD CONSTRAINT publications_season_id_fkey FOREIGN KEY (season_id) REFERENCES seasons (id) ON DELETE SET NULL,
    ADD CONSTRAINT publications_season_chk CHECK (kind = 'SEASON' OR season_id IS NULL),
    ADD COLUMN country VARCHAR(2) CHECK (country IN ('US', 'UK')),
    ADD COLUMN season  JSONB;

-- Temporadas já publicadas: as configurações e o elenco de agora (depois do início nenhum dos dois muda),
-- o nome atual (era o que aparecia), a capa do cast de origem e, nas oficiais, o país pelas missões
-- (ou pela moeda, nas misturadas). Quem jogava no modo Jogador não entra no elenco.
UPDATE publications p
   SET name = s.name,
       image_url = coalesce(p.image_url, c.image_url),
       country = CASE
         WHEN p.area <> 'OFFICIAL' THEN NULL
         WHEN starts_with(s.mission_pool, 'UK_') THEN 'UK'
         WHEN starts_with(s.mission_pool, 'US_') THEN 'US'
         WHEN s.currency = 'GBP' THEN 'UK'
         ELSE 'US'
       END,
       season = jsonb_build_object(
         'mode', s.mode,
         'chaos', s.chaos,
         'missionPool', s.mission_pool,
         'interactionLimit', s.interaction_limit,
         'withdrawals', coalesce(s.allow_withdrawals, true),
         'hiddenShieldChance', coalesce(s.hidden_shield_chance, 0),
         'currency', s.currency,
         'initialPrizePot', s.initial_prize_pot,
         'maxPrizePot', s.max_prize_pot),
       snapshot = jsonb_build_object('relationships', '[]'::jsonb, 'characters', (
         SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'key', pl.id,
                  'name', pl.name,
                  'imageUrl', pl.image_url,
                  'characterId', pl.character_id,
                  'behaviors', (
                    SELECT coalesce(jsonb_agg(jsonb_build_object('name', b.name, 'description', b.description, 'effects', b.effects) ORDER BY lower(b.name)), '[]'::jsonb)
                      FROM player_behaviors pb
                      JOIN behaviors b ON b.id = pb.behavior_id
                     WHERE pb.player_id = pl.id))
                ORDER BY pl.created_at, pl.name), '[]'::jsonb)
           FROM players pl
          WHERE pl.season_id = s.id AND NOT pl.is_human))
  FROM seasons s
  LEFT JOIN casts c ON c.id = s.cast_id
 WHERE s.id = p.season_id AND p.kind = 'SEASON';

ALTER TABLE publications
    DROP CONSTRAINT publications_snapshot_chk,
    ADD CONSTRAINT publications_snapshot_chk CHECK (snapshot IS NOT NULL),
    ADD CONSTRAINT publications_season_copy_chk CHECK ((kind = 'SEASON') = (season IS NOT NULL)),
    ADD CONSTRAINT publications_country_chk CHECK ((area = 'OFFICIAL' AND kind = 'SEASON') = (country IS NOT NULL));

-- Página do participante: a temporada ligada vira a publicação dela.
UPDATE characters c
   SET profile = jsonb_set(c.profile, '{seasons}', (
         SELECT coalesce(jsonb_agg((s.entry - 'seasonId') || jsonb_build_object('publicationId', p.id) ORDER BY s.n), '[]'::jsonb)
           FROM jsonb_array_elements(c.profile -> 'seasons') WITH ORDINALITY AS s (entry, n)
           LEFT JOIN publications p ON p.kind = 'SEASON' AND p.season_id::text = s.entry ->> 'seasonId'
       ))
 WHERE jsonb_typeof(c.profile -> 'seasons') = 'array';
