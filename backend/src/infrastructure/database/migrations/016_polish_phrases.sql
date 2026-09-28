-- =====================================================================
-- Polimento das frases
--  1. Chegada: ninguém sabe ainda quem é traidor e não houve voto, morte ou torre.
--     Saem as suspeitas/acusações e as frases que já falam do jogo; entram primeiras impressões.
--  2. Frases que afirmavam votos passados que podem não ter acontecido (ex.: "você votou em mim
--     ontem" no dia 2, quando ainda não houve mesa) viram opiniões.
--  3. Frases novas inspiradas em momentos icônicos do programa (sem nomes reais).
-- =====================================================================

-- 1. Chegada sem jogo
DELETE FROM phrases WHERE phase = 'ARRIVAL' AND tone IN ('SUSPICION', 'ACCUSATION', 'DEFENSE', 'STRATEGY');
DELETE FROM phrases
 WHERE phase = 'ARRIVAL'
   AND text ~* '(vot|mesa redonda|assassin|banid|torre|escudo|capa preta|capuz|veneno|traidor|traição|trair|fiel|fiéis|matar|morr)';

-- 2. Nada de afirmar votos que talvez não existiram
UPDATE phrases SET text = '"Eu não esqueço o que você andou falando de mim, {user1}", disse {user}, sem levantar os olhos.'
 WHERE lower(text) = lower('"Você votou em mim ontem, {user1}. Eu não esqueço", disse {user}, sem levantar os olhos.');
UPDATE phrases SET text = '"Você fala mal de mim pelos cantos e ainda fala em confiança?", disparou {user} contra {user1}.'
 WHERE lower(text) = lower('"Você votou em mim ontem e ainda fala em confiança?", disparou {user} contra {user1}.');
UPDATE phrases SET text = '{user} e {user1} começaram discutindo o chá e terminaram discutindo quem anda cochichando sobre quem.'
 WHERE lower(text) = lower('{user} e {user1} começaram discutindo o chá e terminaram discutindo o voto de ontem.');
UPDATE phrases SET text = '{user} deixou {user1} de fora da parte que valia escudo. "Você anda falando de mim, lembra?"'
 WHERE lower(text) = lower('{user} deixou {user1} de fora da parte que valia escudo. "Você votou em mim, lembra?"');
UPDATE phrases SET text = '"Você sempre tem uma desculpa pronta. Explica essa, {user1}", cobrou {user}.'
 WHERE lower(text) = lower('"Três dias, três votos em Fiéis. Explica isso, {user1}", cobrou {user}.');
UPDATE phrases SET text = '{user} perguntou a {user1} por que muda de opinião toda vez que alguém levanta a voz.'
 WHERE lower(text) = lower('{user} perguntou a {user1} por que mudou de voto na última hora ontem.');
UPDATE phrases SET text = '{user} lembrou que {user1} nunca apontou um nome antes de todo mundo. Nenhuma vez.'
 WHERE lower(text) IN (lower('{user} lembrou que {user1} nunca votou num Traidor. Nenhuma vez.'), lower('{user} mostrou que {user1} nunca votou em quem saiu como traidor. Nenhuma vez.'));
UPDATE phrases SET text = '{user} disse a {user1}: "O jeito como você votou até agora diz muito."'
 WHERE lower(text) = lower('{user} disse a {user1}: "Seu voto de ontem entregou você."');
UPDATE phrases SET text = '{user} pediu que {user2} lembrasse de tudo que {user1} fez pelo grupo até aqui.'
 WHERE lower(text) = lower('{user} pediu que {user2} lembrasse que {user1} votou certo nas últimas três mesas.');
UPDATE phrases SET text = '{user} mostrou que {user1} costuma esperar os outros falarem antes de se posicionar.'
 WHERE lower(text) = lower('{user} mostrou que {user1} sempre vota no último instante, depois de ver o voto dos outros.');
UPDATE phrases SET text = '{user} lembrou a {user2} que {user1} teve coragem quando todos hesitaram.'
 WHERE lower(text) = lower('{user} lembrou a {user2} que {user1} votou certo quando todos erraram.');
UPDATE phrases SET text = '{user} fez as contas de tudo que {user1} disse na temporada. "Nada bate."'
 WHERE lower(text) = lower('{user} fez as contas dos votos de {user1}: nenhum voto em traidor revelado.');

-- 3. Frases novas
INSERT INTO phrases (phase, tone, behavior_id, text)
SELECT v.phase::phrase_phase, v.tone::phrase_tone, b.id, v.text
FROM (VALUES
  -- chegada: primeiras impressões, viagem, nervosismo, o castelo
  ('ARRIVAL', 'FRIENDLY', NULL, '{user} e {user1} descobriram que pegaram o mesmo voo e já tinham reparado um no outro no aeroporto.'),
  ('ARRIVAL', 'FRIENDLY', 'Querido', '{user} ajudou {user1} a arrumar o laço do vestido de gala antes da foto de chegada.'),
  ('ARRIVAL', 'FRIENDLY', NULL, '{user} e {user1} passaram a travessia de barco rindo do enjoo um do outro.'),
  ('ARRIVAL', 'FRIENDLY', 'Carismático', '{user} contou uma história tão boa da infância que {user1} pediu bis.'),
  ('ARRIVAL', 'FRIENDLY', 'Amado', 'Em meia hora, {user1} já chamava {user} pelo apelido de família.'),
  ('ARRIVAL', 'FRIENDLY', 'Protetor', '{user} viu {user1} sozinho(a) num canto e foi puxar conversa.'),
  ('ARRIVAL', 'FRIENDLY', NULL, '{user} dividiu um cachecol com {user1} no vento gelado do pátio.'),
  ('ARRIVAL', 'FRIENDLY', 'Diplomata', '{user} apresentou {user1} para metade do salão como se fossem amigos de infância.'),
  ('ARRIVAL', 'HUMOR', 'Dramático', '{user} olhou o salão iluminado e declarou: "Isso aqui parece uma ópera. Eu vou amar cada minuto do drama."'),
  ('ARRIVAL', 'HUMOR', 'Mentiroso', '{user} confessou baixinho a {user1} que trocou de sotaque na chegada: "Esse sotaque passa mais confiança."'),
  ('ARRIVAL', 'HUMOR', NULL, '{user} tentou entrar pela porta da cozinha achando que era a entrada principal.'),
  ('ARRIVAL', 'HUMOR', NULL, '{user} perguntou a {user1} se o gaiteiro vai tocar toda manhã. Vai.'),
  ('ARRIVAL', 'HUMOR', 'Brincalhão', '{user} fez uma reverência exagerada para o castelo e quase caiu no lago.'),
  ('ARRIVAL', 'HUMOR', NULL, '{user} jurou que a armadura do corredor mexeu a cabeça quando ele(a) passou.'),
  ('ARRIVAL', 'HUMOR', 'Caótico', '{user} já se perdeu duas vezes procurando o banheiro e acabou num armário de vassouras.'),
  ('ARRIVAL', 'HUMOR', NULL, '{user} trouxe um chapéu escocês de lembrancinha e fez {user1} usar na foto.'),
  ('ARRIVAL', 'HUMOR', 'Arrogante', '{user} escolheu o maior quarto sem perguntar e ainda reclamou da vista.'),
  ('ARRIVAL', 'HUMOR', NULL, '{user} derrubou uma bandeja inteira de canapés tentando cumprimentar {user1}.'),
  ('ARRIVAL', 'HUMOR', 'Fofoqueiro', '{user} já sabia quem tinha trazido mais malas e fez questão de contar para {user1}.'),
  ('ARRIVAL', 'NEUTRAL', NULL, '{user} contou a {user1} o que faz da vida lá fora. {user1} não esperava.'),
  ('ARRIVAL', 'NEUTRAL', 'Observador', '{user} passou o jantar observando quem falava mais alto e quem só ouvia.'),
  ('ARRIVAL', 'NEUTRAL', 'Tímido', '{user} ficou perto da lareira, esquentando as mãos e evitando conversa.'),
  ('ARRIVAL', 'NEUTRAL', NULL, '{user} e {user1} conversaram sobre filhos, trabalho e o que fariam com o prêmio.'),
  ('ARRIVAL', 'NEUTRAL', 'Frio', '{user} cumprimentou {user1} com um aceno de cabeça e voltou para a própria taça.'),
  ('ARRIVAL', 'NEUTRAL', 'Estrategista', '{user} decorou o nome de todo mundo antes da sobremesa.'),
  ('ARRIVAL', 'CONFLICT', 'Invejoso', '{user} torceu o nariz quando {user1} chegou com o figurino mais elogiado da noite.'),
  ('ARRIVAL', 'CONFLICT', NULL, '{user} e {user1} discordaram sobre qual é o melhor time do mundo e o clima azedou.'),
  ('ARRIVAL', 'CONFLICT', 'Explosivo', '{user} não gostou da piada de {user1} sobre o seu sotaque e fez questão de dizer.'),
  ('ARRIVAL', 'CONFLICT', 'Competitivo', '{user} desafiou {user1} para ver quem sobe a colina do castelo primeiro. Ninguém venceu com dignidade.'),
  ('ARRIVAL', 'ALLIANCE', NULL, '{user} e {user1} combinaram de sentar sempre lado a lado no jantar.'),
  ('ARRIVAL', 'ALLIANCE', 'Carente', '{user} pediu a {user1} que fossem "parceiros de castelo" desde o primeiro minuto.'),
  ('ARRIVAL', 'EMOTION', NULL, '{user} ficou em silêncio olhando o lago: "Minha mãe não vai acreditar quando eu contar."'),
  ('ARRIVAL', 'EMOTION', 'Chorão', '{user} chorou lendo a carta que a família colocou escondida na mala.'),

  -- momentos icônicos
  ('BREAKFAST', 'EMOTION', 'Fiel', '{user} garantiu, de mãos dadas com {user1}: "Eu sou Fiel, cem por cento. E ele(a) também, cem por cento."'),
  ('BREAKFAST', 'SUSPICION', 'Detetive', '{user} sentou na frente de {user1} e disse, calmo(a): "Eu sei o que você é. E você sabe que eu sei."'),
  ('BREAKFAST', 'HUMOR', 'Dramático', '{user} suspirou encantado(a): "Isso aqui é uma ópera. As punhaladas, o drama... eu amo."'),
  ('BREAKFAST', 'CONFLICT', 'Explosivo', '{user} jogou o guardanapo: "Eu não vim até a Escócia para ser feito(a) de bobo(a) por {user1}!"'),
  ('ROUND_TABLE', 'EMOTION', NULL, '{user} bateu no peito: "Eu juro por Deus que sou Fiel." {user1} cortou na hora: "Não é."'),
  ('ROUND_TABLE', 'ACCUSATION', 'Frio', '{user} esperou o silêncio e disse só duas palavras para {user1}: "Não é."'),
  ('ROUND_TABLE', 'EMOTION', 'Fiel', '{user} olhou para {user1}: "Eu sou, e sempre fui, Fiel. Se me banirem, vocês vão se arrepender."'),
  ('ROUND_TABLE', 'DEFENSE', 'Carismático', '{user} lembrou à mesa que ninguém ali está a salvo, e que tirar {user1} hoje é fazer o trabalho dos traidores.'),
  ('ROUND_TABLE', 'SUSPICION', 'Observador', '{user} disse que {user1} parece "à prova de balas": nunca é alvo, nunca é acusado(a). "Isso não é sorte."'),
  ('ROUND_TABLE', 'EMOTION', 'Dramático', '{user} ergueu a taça: "Seja quem for hoje, eu estou amando essa ópera."'),
  ('ROUND_TABLE', 'CONFLICT', NULL, '{user} acusou {user1} de ser "a ovelha que segue o rebanho". {user1} respondeu com um bééé irônico.'),
  ('ROUND_TABLE', 'EMOTION', NULL, 'Na saída, {victim} olhou para a mesa e disse: "Eu fui Fiel. Fiel... ao que eu acreditava." Ninguém entendeu, e {user} ficou arrepiado(a).'),
  ('ROUND_TABLE', 'SUSPICION', 'Astuto', '{user} reparou em quem sorriu quando {victim} saiu, e o sorriso de {user1} durou um segundo a mais.'),
  ('TRAITORS_MEETING', 'HUMOR', 'Arrogante', '{user} admitiu na torre, rindo: "Eu estou bêbado(a) de poder, {user2}."'),
  ('TRAITORS_MEETING', 'STRATEGY', 'Manipulador', '{user} propôs a {user2}: "Amanhã eu acuso {user1} na mesa. Se colar, a gente nem precisa matar ninguém."'),
  ('TRAITORS_MEETING', 'STRATEGY', 'Sonso', '{user} lembrou que {user1} está sempre ao lado dele(a). "Ninguém desconfia de quem anda com o(a) mais fiel do castelo."'),
  ('TRAITORS_MEETING', 'EMOTION', 'Fiel', '{user} confessou a {user2}: "{user1} confia em mim como se eu fosse da família. Isso vai doer."'),
  ('ENDGAME', 'EMOTION', 'Frio', '{user} olhou para {user1}, que tinha sido o(a) melhor amigo(a) no jogo, e respirou fundo antes de votar.'),
  ('ENDGAME', 'EMOTION', NULL, '{user} disse a {user1}: "Se você for traidor(a), eu não vou te perdoar tão cedo. Mas vou entender."'),
  ('ENDGAME', 'ACCUSATION', 'Detetive', '{user} lembrou de cada detalhe que {user1} deixou escapar e juntou tudo numa frase: "É você."'),
  ('ENDGAME', 'HUMOR', 'Dramático', '{user} pediu que a última votação fosse "digna de uma ópera".')
) AS v(phase, tone, behavior, text)
LEFT JOIN behaviors b ON lower(b.name) = lower(v.behavior)
ON CONFLICT DO NOTHING;
