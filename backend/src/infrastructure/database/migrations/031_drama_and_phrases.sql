-- ---------------------------------------------------------------------
-- Como a simulação é mostrada (pode mudar a qualquer momento, não muda o jogo)
--   * drama: no modo Jogador, os acontecimentos de cada momento (votos, quem desce
--     para o café...) aparecem um de cada vez; o jogador avança quando quiser.
--   * show_phrases: as falas da biblioteca de frases na narrativa. Desligado, o foco
--     fica nas eliminações; no modo Jogador continuam as falas que envolvem o jogador.
-- As temporadas já publicadas levam os padrões nas configurações copiáveis.
-- ---------------------------------------------------------------------
ALTER TABLE seasons
    ADD COLUMN drama        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN show_phrases BOOLEAN NOT NULL DEFAULT true;

UPDATE publications
   SET season = season || '{"drama": false, "showPhrases": true}'::jsonb
 WHERE season IS NOT NULL;
