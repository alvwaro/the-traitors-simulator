-- =====================================================================
-- Frases da MESA FINAL.
-- =====================================================================

INSERT INTO phrases (phase, tone, behavior_id, text)
SELECT 'ENDGAME'::phrase_phase, v.tone::phrase_tone, b.id, v.text
FROM (VALUES
  -- acusação
  ('ACCUSATION', 'Paranoico', '"Chegamos até aqui e eu ainda não confio em {user1}", disse {user}.'),
  ('ACCUSATION', 'Competitivo', '{user} pediu mais uma rodada: "Não vou dividir o prêmio com {user1}."'),
  ('ACCUSATION', NULL, '{user} olhou para {user1}: "Se eu estiver errado(a), me perdoa. Mas eu preciso ter certeza."'),
  ('ACCUSATION', 'Detetive', '{user} relembrou cada voto de {user1} desde o primeiro dia. Nenhum em traidor.'),
  ('ACCUSATION', 'Explosivo', '{user} se levantou: "Eu não saio daqui dividindo dinheiro com traidor. {user1}, acabou."'),
  ('ACCUSATION', 'Carismático', '{user} fez o último discurso da temporada, e ele terminou no nome de {user1}.'),
  ('ACCUSATION', 'Estrategista', '{user} mostrou que {user1} esteve perto de todas as vítimas na véspera do assassinato.'),
  ('ACCUSATION', 'Vingativo', '{user} lembrou a {user1} o voto do terceiro dia. "Eu disse que ia lembrar."'),
  ('ACCUSATION', 'Líder', '{user} pediu que todos votassem em {user1} "pela última vez nesta temporada".'),
  ('ACCUSATION', 'Mentiroso', '{user} jurou ter provas contra {user1}. Não mostrou nenhuma.'),
  ('ACCUSATION', 'Arrogante', '{user} disse que sempre soube que {user1} era traidor(a). Nunca tinha dito isso.'),
  ('ACCUSATION', 'Invejoso', '{user} disse que {user1} chegou até a final "no colo dos outros".'),
  ('ACCUSATION', 'Rebelde', '{user} votou para continuar só para não deixar {user1} sair confortável.'),
  ('ACCUSATION', 'Detetive', '{user} disse a {user1}: "Você sobreviveu a todas as noites. Todas. Explica isso."'),
  ('ACCUSATION', NULL, '{user} disse que {user1} nunca foi alvo dos traidores, "nem uma tentativa sequer".'),
  ('ACCUSATION', 'Caótico', '{user} anunciou que vai acusar {user1} "porque alguém tem que ser".'),
  ('ACCUSATION', 'Paranoico', '{user} disse que {user1} sorriu quando falaram em encerrar. "Traidor comemora cedo."'),
  ('ACCUSATION', 'Explosivo', '"Eu não durmo tranquilo(a) sabendo que {user1} ainda está aqui!", gritou {user}.'),
  ('ACCUSATION', NULL, '{user} disse a {user1}: "Seu voto de ontem entregou você."'),
  ('ACCUSATION', 'Competitivo', '{user} disse que {user1} não fez nada o jogo inteiro e não merece um centavo.'),

  -- defesa
  ('DEFENSE', 'Fiel', '{user} segurou a mão de {user1}: "Eu sei quem você é. Vamos encerrar."'),
  ('DEFENSE', NULL, '"{user1} provou que é Fiel dez vezes", insistiu {user}, encarando {user2}.'),
  ('DEFENSE', 'Protetor', '{user} disse que {user1} só está na final porque ele(a) protegeu cada passo.'),
  ('DEFENSE', 'Carismático', '{user} lembrou à mesa tudo que {user1} fez pelo grupo, e a mesa amoleceu.'),
  ('DEFENSE', 'Heroico', '{user} disse que sai no lugar de {user1}, se precisar. Ninguém quis testar.'),
  ('DEFENSE', 'Diplomata', '{user} pediu que {user2} lembrasse que {user1} votou certo nas últimas três mesas.'),
  ('DEFENSE', 'Detetive', '{user} desmontou a teoria de {user2} contra {user1}, peça por peça.'),
  ('DEFENSE', 'Líder', '{user} garantiu: "{user1} é fiel. Se eu estiver errado(a), perco tudo junto."'),
  ('DEFENSE', 'Chorão', '{user} chorou defendendo {user1}: "Eu confio nele(a) como confio na minha mãe."'),
  ('DEFENSE', NULL, '{user} lembrou que {user1} foi o primeiro a votar em um traidor, lá no começo.'),
  ('DEFENSE', 'Fiel', '"Eu entro nessa final com {user1} ou não entro", disse {user}.'),
  ('DEFENSE', 'Manipulador', '{user} defendeu {user1} com tanta convicção que ninguém percebeu o próprio disfarce.'),
  ('DEFENSE', 'Protetor', '{user} se virou para {user2}: "Se é para desconfiar de alguém, desconfia de mim."'),
  ('DEFENSE', 'Carismático', '{user} convenceu a mesa de que desconfiar de {user1} agora é "jogar o prêmio fora".'),
  ('DEFENSE', NULL, '{user} perguntou a {user2}: "Você tem uma prova contra {user1}? Uma só."'),

  -- emoção
  ('EMOTION', 'Dramático', '{user} chorou lembrando de todos que ficaram pelo caminho.'),
  ('EMOTION', NULL, '"Eu nunca menti para vocês", disse {user}, com a mão no peito.'),
  ('EMOTION', 'Tímido', '{user} ficou em silêncio por um longo minuto antes de conseguir falar.'),
  ('EMOTION', 'Chorão', '{user} chorou do começo ao fim da mesa final. Ninguém julgou.'),
  ('EMOTION', 'Carente', '{user} pediu que, independentemente do resultado, todos se abraçassem no fim.'),
  ('EMOTION', 'Heroico', '{user} disse que chegar até ali já é a maior vitória da vida dele(a).'),
  ('EMOTION', 'Fiel', '{user} disse que carrega cada companheiro(a) banido(a) no coração até essa mesa.'),
  ('EMOTION', NULL, '{user} lembrou do primeiro dia no castelo e riu de nervoso: "Parece que foi há um ano."'),
  ('EMOTION', 'Dramático', '{user} leu uma carta imaginária para a família, olhando para as velas.'),
  ('EMOTION', 'Querido', '{user} agradeceu a cada um da mesa, pelo nome, antes de votar.'),
  ('EMOTION', NULL, '{user} disse que tem medo de estar errado(a) e dividir o prêmio com um traidor.'),
  ('EMOTION', 'Carente', '{user} perguntou a {user1}: "Depois disso, você ainda vai falar comigo?"'),
  ('EMOTION', 'Chorão', '{user} chorou quando percebeu que ninguém mais ia morrer. Só faltava a verdade.'),
  ('EMOTION', 'Frio', '{user}, pela primeira vez no jogo, deixou escapar uma lágrima. Todos viram.'),
  ('EMOTION', NULL, '{user} disse que o dinheiro não importa mais: "Eu só quero saber a verdade."'),
  ('EMOTION', 'Heroico', '{user} disse que vai dividir o prêmio com a família de quem foi assassinado(a) no primeiro dia.'),
  ('EMOTION', 'Tímido', '{user} admitiu que nunca imaginou chegar à final. "Eu achei que ia ser o(a) primeiro(a) a sair."'),
  ('EMOTION', NULL, '{user} olhou para as velas e disse: "Quando isso acabar, eu vou dormir três dias."'),

  -- suspeita
  ('SUSPICION', 'Paranoico', '{user} olhou para cada rosto da mesa: "Um de vocês ainda está mentindo."'),
  ('SUSPICION', NULL, '{user} lembrou que {user1} nunca votou num Traidor. Nenhuma vez.'),
  ('SUSPICION', 'Detetive', '{user} disse que tem uma última dúvida, e ela se chama {user1}.'),
  ('SUSPICION', 'Observador', '{user} reparou que {user1} olhou para o prêmio antes de olhar para as pessoas.'),
  ('SUSPICION', 'Astuto', '{user} perguntou a {user1}: "Se um traidor chegasse até aqui, como ele agiria?"'),
  ('SUSPICION', NULL, '{user} disse que não tem certeza sobre {user1} e que "incerteza aqui custa caro".'),
  ('SUSPICION', 'Paranoico', '{user} acha que ainda tem traidor na mesa. Acha isso desde o primeiro dia.'),
  ('SUSPICION', 'Estrategista', '{user} lembrou que traidores costumam chegar à final sem chamar atenção. Olhou para {user1}.'),
  ('SUSPICION', 'Detetive', '{user} reparou que {user1} votou para encerrar rápido demais.'),
  ('SUSPICION', 'Ingênuo', '{user} disse que confia em todos, mas uma vozinha fala o nome de {user1}.'),
  ('SUSPICION', NULL, '{user} perguntou se alguém mais achou estranho {user1} nunca ter sido acusado(a).'),
  ('SUSPICION', 'Observador', '{user} disse que {user1} mudou de comportamento desde que ficaram só os finalistas.'),
  ('SUSPICION', 'Astuto', '{user} disse que quem quer encerrar logo é quem tem algo a perder. Olhou para {user1}.'),

  -- aliança
  ('ALLIANCE', 'Fiel', '{user} e {user1} trocaram um olhar: chegaram juntos e querem sair juntos.'),
  ('ALLIANCE', 'Estrategista', '{user} lembrou a {user1} o pacto do primeiro dia. "Chegamos. Agora é confiar."'),
  ('ALLIANCE', 'Protetor', '{user} segurou o ombro de {user1}: "Você não vai sair daqui sozinho(a)."'),
  ('ALLIANCE', NULL, '{user} e {user1} deram as mãos por baixo da mesa na hora do voto.'),
  ('ALLIANCE', 'Líder', '{user} disse que a aliança com {user1} foi a melhor decisão do jogo.'),
  ('ALLIANCE', 'Carente', '{user} pediu a {user1} que votassem igual "para ter certeza de que ninguém fica sozinho".'),
  ('ALLIANCE', 'Fiel', '"Eu divido o prêmio com você de olhos fechados", disse {user} a {user1}.'),
  ('ALLIANCE', NULL, '{user} lembrou a {user1} a noite em que prometeram chegar à final. Cumpriram.'),

  -- conflito
  ('CONFLICT', 'Explosivo', '{user} explodiu com {user1}: "Você me usou o jogo inteiro!"'),
  ('CONFLICT', 'Invejoso', '{user} disse a {user1}: "Você não merece um centavo desse prêmio."'),
  ('CONFLICT', 'Vingativo', '{user} cobrou de {user1} cada traição da temporada, uma por uma.'),
  ('CONFLICT', 'Arrogante', '{user} disse que carregou {user1} nas costas até a final.'),
  ('CONFLICT', 'Traíra', '{user} votou contra {user1}, o(a) aliado(a) de sempre. "É a final, nada pessoal."'),
  ('CONFLICT', NULL, '{user} e {user1} discutiram sobre quem mereceu mais estar na final.'),
  ('CONFLICT', 'Competitivo', '{user} disse que {user1} só chegou porque os traidores não quiseram gastar uma noite com ele(a).'),
  ('CONFLICT', 'Explosivo', '{user} bateu na mesa: "Eu não vou dividir nada com quem me acusou ontem, {user1}!"'),
  ('CONFLICT', 'Rebelde', '{user} disse que vai votar para banir de novo só para contrariar {user1}.'),
  ('CONFLICT', 'Vingativo', '{user} olhou para {user1}: "Agora eu tenho o voto e você tem o medo."'),

  -- humor
  ('HUMOR', 'Brincalhão', '{user} brincou que, depois de tanto mingau, merece o prêmio só por sobreviver ao café.'),
  ('HUMOR', 'Caótico', '{user} sugeriu decidir o encerramento no par ou ímpar. Ninguém riu. Ele(a) riu.'),
  ('HUMOR', NULL, '{user} disse que o próximo reality dele(a) vai ser uma soneca de três meses.'),
  ('HUMOR', 'Frio', '{user} comentou que a mesa final é "só uma mesa redonda com menos gente e mais dinheiro".'),
  ('HUMOR', 'Dramático', '{user} pediu uma música de suspense antes de votar. Não tinha.'),
  ('HUMOR', 'Brincalhão', '{user} disse que se for traidor(a), é o(a) traidor(a) mais cansado(a) da história do programa.'),
  ('HUMOR', NULL, '{user} contou quantos croissants comeu na temporada. Foram 47. Ninguém pediu esse dado.'),
  ('HUMOR', 'Arrogante', '{user} ensaiou o discurso de vencedor(a) antes do voto. Em voz alta.')
) AS v(tone, behavior, text)
LEFT JOIN behaviors b ON lower(b.name) = lower(v.behavior)
ON CONFLICT DO NOTHING;
