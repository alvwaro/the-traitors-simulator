-- =====================================================================
-- Conversas particulares: no modo Jogador, o participante só vê o que
-- presenciou. Uma conversa particular (cochicho, aliança fechada num canto)
-- só aparece para quem está nela; o resto aparece para todos.
-- Quem assiste (temporada automática, eliminado ou temporada encerrada) vê tudo.
-- =====================================================================

ALTER TABLE simulation_events ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;
