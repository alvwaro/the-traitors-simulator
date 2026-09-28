import { chance, shuffle } from '../random';
import { isTraitor, SimPlayer } from '../traits';
import { MissionDefinition } from './MissionContext';
import { tokenList } from '../tokens';
import { byInfluence, top } from './helpers';

/**
 * Missões da 3ª temporada de The Traitors, na ordem em que foram ao ar nos EUA (2025),
 * seguidas das que só apareceram na 3ª temporada britânica (gravada no mesmo castelo).
 * Os valores seguem os do programa americano; os escudos seguem as regras de cada missão.
 */

const longboat: MissionDefinition = {
  key: 'longboat',
  origin: 'EUA T3',
  name: 'O Barco Viking',
  description: 'Vikings levam o grupo em barcos pelo lago. Em cada pontão, alguém mergulha atrás de combustível e ouro. O barco que chega primeiro ganha escudos.',
  prizeAvailable: 40000,
  play(ctx) {
    const boats = ctx.teams(2).filter((b) => b.length);
    const perPontoon = 5000;
    ctx.say('Guerreiros vikings esperam o grupo à beira do lago. Dois barcos, quatro pontões e ouro escondido pelo caminho.');
    const captains = boats.map(byInfluence);
    if (captains.length === 2) ctx.say('{user} assumiu o remo do primeiro barco; {user1} comanda o segundo.', captains);

    const gold = boats.map(() => 0);
    for (let pontoon = 1; pontoon <= 4; pontoon++) {
      boats.forEach((boat, i) => {
        const diver = ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.5, boat)[0];
        if (ctx.attempt(diver, 45 + pontoon * 4, boat)) {
          gold[i] += perPontoon;
          ctx.say(`Pontão ${pontoon}: {user} mergulhou na água gelada e voltou com o ouro.`, [diver]);
        } else {
          ctx.say(`Pontão ${pontoon}: {user} escorregou e o baú afundou no lago.`, [diver]);
        }
      });
      if (pontoon === 2) ctx.chatter(1);
    }

    // Empate no ouro: a sorte decide qual barco chega primeiro.
    const tied = gold[0] === gold[1];
    const firstWins = tied ? chance(ctx.rng, 0.5) : gold[0] > gold[1];
    const winner = firstWins ? 0 : 1;
    const winners = boats[winner] ?? boats[0];
    ctx.shield('O barco de {user} chegou primeiro ao castelo: todos a bordo ganham escudo.', [captains[winner] ?? winners[0]]);
    ctx.chatter(2);
    return { prizeEarned: gold.reduce((a, b) => a + b, 0), shieldIds: winners.map((p) => p.id) };
  },
};

const cages: MissionDefinition = {
  key: 'cages',
  origin: 'EUA T3',
  name: 'As Gaiolas',
  description: 'Três jogadores ficam presos em gaiolas suspensas. O resto do grupo junta moedas para libertá-los; quem sai da gaiola ganha escudo.',
  prizeAvailable: 15000,
  play(ctx) {
    const caged = ctx.pick(Math.min(3, ctx.players.length - 1), (p) => ctx.popularity(p) ** 2);
    const rescuers = ctx.players.filter((p) => !caged.includes(p));
    ctx.say(`O grupo escolheu quem subiria nas gaiolas: ${tokenList(caged.length)}. O resto corre contra o relógio.`, caged);

    const freed: SimPlayer[] = [];
    for (const prisoner of caged) {
      const team = ctx.pick(Math.min(2, rescuers.length), (p) => p.traits.skill + ctx.matrix.get(p.id, prisoner.id).liking, rescuers);
      const success = team.some((r) => ctx.attempt(r, 52, team));
      if (success && team.length) {
        freed.push(prisoner);
        for (const r of team) ctx.matrix.adjust(prisoner.id, r.id, { liking: 8, trust: 5 });
        ctx.say('{user} encheu o tubo de moedas a tempo e a gaiola de {user1} se abriu.', [team[0], prisoner]);
      } else if (team.length) {
        ctx.say('As moedas de {user} não bastaram: {user1} continua pendurado(a) sobre a água.', [team[0], prisoner]);
      }
    }
    ctx.chatter(2);
    if (freed.length) ctx.shield(`Libertados, ${tokenList(freed.length)} ganham escudo.`, freed);
    return { prizeEarned: freed.length * 5000, shieldIds: freed.map((p) => p.id) };
  },
};

const funHouse: MissionDefinition = {
  key: 'fun-house',
  origin: 'EUA T3',
  name: 'A Casa dos Espelhos',
  description: 'Em duplas, os jogadores atravessam uma casa de espelhos levando um balão dourado. Cada porta errada pode estourar o balão.',
  prizeAvailable: 20000,
  play(ctx) {
    ctx.say('Uma casa de espelhos, portas que enganam e um balão dourado por dupla. Cada balão intacto vale ' + ctx.money(2000) + '.');
    let earned = 0;
    for (const [a, b] of ctx.pairs(10)) {
      const through = ctx.attempt(a, 62, [b]) && ctx.attempt(b, 58, [a]);
      if (through) {
        earned += 2000;
        ctx.say('{user} e {user1} escolheram as quatro portas certas e saíram com o balão inteiro.', [a, b]);
      } else {
        ctx.matrix.adjust(a.id, b.id, { hatred: 5, liking: -3 });
        ctx.matrix.adjust(b.id, a.id, { hatred: 5, liking: -3 });
        ctx.say('O balão de {user} e {user1} estourou numa porta errada. Os dois saíram brigando.', [a, b]);
      }
    }
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const statues: MissionDefinition = {
  key: 'statues',
  origin: 'EUA T3',
  name: 'As Estátuas',
  description: 'Equipes montam estátuas gigantes com os rostos dos jogadores. Cada estátua completa rende dinheiro e um escudo para quem ela representa.',
  prizeAvailable: 20000,
  play(ctx) {
    const featured = ctx.pick(Math.min(10, ctx.players.length), () => 1);
    const teams = ctx.teams(2).filter((t) => t.length);
    ctx.say('Dez pedestais, dez cabeças gigantes. As estátuas têm os rostos de alguns jogadores; montá-las protege quem está esculpido.');
    let earned = 0;
    const shielded: SimPlayer[] = [];
    featured.forEach((face, i) => {
      const team = teams[i % teams.length];
      const builder = ctx.pick(1, (p) => p.traits.skill, team)[0];
      if (ctx.attempt(builder, 50, team)) {
        earned += 2000;
        shielded.push(face);
        ctx.say('{user} encaixou a cabeça no pedestal: a estátua de {user1} ficou de pé.', builder.id === face.id ? [builder, builder] : [builder, face]);
      } else {
        ctx.say('A cabeça da estátua de {user} rolou ladeira abaixo.', [face]);
      }
      if (i === 4) ctx.chatter(1);
    });
    ctx.chatter(1);
    if (shielded.length) ctx.shield(`${shielded.length} estátua(s) completa(s): os rostos esculpidos ganham escudo.`, []);
    return { prizeEarned: earned, shieldIds: shielded.map((p) => p.id) };
  },
};

const portraits: MissionDefinition = {
  key: 'portraits',
  origin: 'EUA T3',
  name: 'Os Retratos',
  description: 'Perguntas sobre o castelo e o próprio jogo. Cada resposta certa vale dinheiro; quem mais acerta ganha o direito de pendurar o próprio retrato numa moldura de escudo.',
  prizeAvailable: 20000,
  play(ctx) {
    ctx.say('Na galeria de retratos, oito perguntas. Cada acerto vale ' + ctx.money(2500) + '.');
    const correct = new Map<string, number>();
    let earned = 0;
    for (let q = 1; q <= 8; q++) {
      const answerer = ctx.pick(1, (p) => p.traits.skill + p.traits.influence * 0.5 + 10)[0];
      if (ctx.attempt(answerer, 50)) {
        earned += 2500;
        correct.set(answerer.id, (correct.get(answerer.id) ?? 0) + 1);
        ctx.say(`Pergunta ${q}: {user} respondeu sem hesitar. Certo!`, [answerer]);
      } else {
        ctx.say(`Pergunta ${q}: {user} bateu o pé na resposta errada.`, [answerer]);
      }
      if (q === 4) ctx.chatter(1);
    }
    const best = top(ctx.players, (p) => (correct.get(p.id) ?? 0) + ctx.rng() * 0.5, 2).filter((p) => correct.get(p.id));
    if (best.length) ctx.shield(best.length === 2 ? 'Os retratos de {user} e {user1} ganharam molduras douradas: escudos.' : 'O retrato de {user} ganhou a moldura dourada: escudo.', best);
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: best.map((p) => p.id) };
  },
};

const gunpowder: MissionDefinition = {
  key: 'gunpowder',
  origin: 'EUA T3',
  name: 'A Pólvora',
  description: 'Cada jogador destranca um caixote: dentro há pólvora ou, em três deles, um escudo secreto. Com 500 kg de pólvora a estátua dos Traidores vai pelos ares.',
  prizeAvailable: 30000,
  play(ctx) {
    // Os 500 kg vêm de cerca de 60% dos caixotes, seja qual for o tamanho do elenco.
    const needed = Math.max(3, Math.ceil(ctx.players.length * 0.6));
    ctx.say(`Caixotes trancados cobrem o pátio. ${needed} barris de pólvora (500 kg) derrubam a estátua dos Traidores; três caixotes guardam escudos.`);
    const shieldCrates = new Set(ctx.pick(Math.min(3, ctx.players.length), () => 1).map((p) => p.id));
    let barrels = 0;
    const shielded: SimPlayer[] = [];
    for (const player of ctx.players) {
      if (!ctx.attempt(player, 45)) continue;
      if (shieldCrates.has(player.id)) {
        shielded.push(player);
        ctx.secret('{user} abriu o caixote e encontrou um escudo. Decidiu não contar a ninguém.', [player]);
      } else {
        barrels++;
      }
    }
    ctx.chatter(1);
    const earned = barrels >= needed ? 30000 : Math.round((15000 * barrels) / needed / 500) * 500;
    ctx.say(
      barrels >= needed
        ? `${barrels} barris de pólvora. O pavio queimou e a estátua dos Traidores explodiu em mil pedaços.`
        : `Só ${barrels} barris de pólvora: a estátua dos Traidores continua de pé.`,
    );
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: shielded.map((p) => p.id) };
  },
};

const boxes: MissionDefinition = {
  key: 'boxes',
  origin: 'EUA T3',
  name: 'Até que a Morte nos Separe',
  description: 'Duplas de mãos dadas dentro de caixões cheios de bichos por oito minutos. As duplas que resistem procuram alianças de noivado: quem acha primeiro ganha escudos.',
  prizeAvailable: 27000,
  play(ctx) {
    ctx.say('Seis caixões, seis duplas, oito minutos de mãos dadas entre aranhas, baratas e ratos.');
    const survivors: [SimPlayer, SimPlayer][] = [];
    let earned = 0;
    for (const [a, b] of ctx.pairs(6)) {
      const nerve = (p: SimPlayer) => 35 + (p.traits.volatility - 50) * 0.5;
      if (ctx.attempt(a, nerve(a), [b]) && ctx.attempt(b, nerve(b), [a])) {
        earned += 4500;
        survivors.push([a, b]);
        ctx.matrix.adjust(a.id, b.id, { liking: 6, trust: 5 });
        ctx.matrix.adjust(b.id, a.id, { liking: 6, trust: 5 });
        ctx.say('{user} e {user1} não soltaram as mãos nem quando as aranhas subiram pelo rosto.', [a, b]);
      } else {
        ctx.say('{user} gritou, {user1} soltou a mão e o caixão se abriu antes da hora.', chance(ctx.rng, 0.5) ? [a, b] : [b, a]);
      }
    }
    ctx.chatter(1);
    const rings = top(survivors, ([a, b]) => a.traits.skill + b.traits.skill + ctx.rng() * 40, 3);
    for (const [a, b] of rings) ctx.shield('{user} e {user1} acharam as alianças no meio dos bichos: escudos para os dois.', [a, b]);
    return { prizeEarned: earned, shieldIds: rings.flat().map((p) => p.id) };
  },
};

const nurseryRhymes: MissionDefinition = {
  key: 'nursery-rhymes',
  origin: 'EUA T3',
  name: 'Cantigas ao Contrário',
  description: 'Uma equipe na casa de bonecas do bosque decora cantigas de ninar tocadas ao contrário e passa por telefone; a outra, no castelo, canta no gramofone.',
  prizeAvailable: 20000,
  play(ctx) {
    const [woods, castle] = ctx.teams(2);
    ctx.say('Bonecas antigas, cantigas tocadas de trás para frente e um telefone chiando entre o bosque e o castelo.');
    const hits = new Map<string, number>();
    let earned = 0;
    for (let rhyme = 1; rhyme <= 4; rhyme++) {
      const listener = ctx.pick(1, (p) => p.traits.skill, woods)[0];
      const singer = castle.length ? ctx.pick(1, (p) => p.traits.sociability + p.traits.skill, castle)[0] : listener;
      if (ctx.attempt(listener, 55, woods) && ctx.attempt(singer, 50, castle)) {
        earned += 5000;
        hits.set(listener.id, (hits.get(listener.id) ?? 0) + 1);
        ctx.say(`Cantiga ${rhyme}: {user} decifrou o áudio e {user1} cantou certinho no gramofone.`, listener.id === singer.id ? [listener, listener] : [listener, singer]);
      } else {
        ctx.say(`Cantiga ${rhyme}: entre o telefone de {user} e a voz de {user1}, a letra se perdeu.`, listener.id === singer.id ? [listener, listener] : [listener, singer]);
      }
    }
    ctx.chatter(2);
    const best = top(woods, (p) => (hits.get(p.id) ?? 0) + ctx.rng() * 0.5, 1).filter((p) => hits.get(p.id));
    if (best.length) ctx.shield('Da casa de bonecas, {user} foi quem mais acertou: escudo.', best);
    return { prizeEarned: earned, shieldIds: best.map((p) => p.id) };
  },
};

const chess: MissionDefinition = {
  key: 'chess',
  origin: 'EUA T3',
  name: 'O Xadrez Humano',
  description: 'Os Traidores responderam em segredo a perguntas sobre o elenco. No tabuleiro gigante, o grupo precisa adivinhar as respostas deles.',
  prizeAvailable: 20000,
  play(ctx) {
    const traitors = ctx.players.filter(isTraitor);
    const faithful = ctx.players.filter((p) => !isTraitor(p));
    const avgFrom = (target: SimPlayer, from: readonly SimPlayer[], f: (a: SimPlayer) => number) =>
      from.length ? from.reduce((s, a) => s + f(a), 0) / from.length : ctx.rng() * 100;
    const questions: { text: string; answer: () => SimPlayer | undefined; clears: boolean }[] = [
      { text: 'Quem os Traidores consideram a maior ameaça?', answer: () => top(faithful, (p) => avgFrom(p, traitors, (k) => ctx.matrix.suspicion(p.id, k.id)), 1)[0], clears: true },
      { text: 'Quem os Traidores acham mais fácil de enganar?', answer: () => top(faithful, (p) => avgFrom(p, traitors, (k) => ctx.matrix.get(p.id, k.id).trust), 1)[0], clears: false },
      { text: 'Quem os Traidores gostariam de levar para a final?', answer: () => top(faithful, (p) => avgFrom(p, traitors, (k) => ctx.matrix.get(k.id, p.id).liking), 1)[0], clears: false },
      { text: 'Quem os Traidores gostariam de ver banido(a)?', answer: () => top(faithful, (p) => avgFrom(p, traitors, (k) => ctx.matrix.get(k.id, p.id).hatred), 1)[0], clears: true },
      { text: 'Quem é o(a) jogador(a) mais barulhento(a) do castelo?', answer: () => top(ctx.players, (p) => p.traits.sociability + p.traits.volatility, 1)[0], clears: false },
      { text: 'Quem joga mais em dupla?', answer: () => top(ctx.players, (p) => ctx.matrix.alliesOf(p.id, ctx.players.map((x) => x.id)).length + p.traits.loyalty / 100, 1)[0], clears: false },
      { text: 'Quem os Traidores menos gostariam de enfrentar na mesa final?', answer: () => top(faithful, (p) => p.traits.influence + p.traits.paranoia, 1)[0], clears: true },
      { text: 'Quem seria o(a) próximo(a) recrutado(a)?', answer: () => top(faithful, (p) => 100 - p.traits.loyalty + p.traits.deception, 1)[0], clears: false },
    ];
    ctx.say('Um tabuleiro de xadrez gigante com os nomes do elenco. As peças devem cair onde os Traidores apontaram.');
    let earned = 0;
    questions.forEach((q, i) => {
      const answer = q.answer();
      if (!answer) return;
      const guesser = ctx.pick(1, (p) => p.traits.skill + p.traits.paranoia * 0.5)[0];
      if (ctx.attempt(guesser, 58)) {
        earned += 2500;
        ctx.say(`"${q.text}" {user} moveu a peça para o nome de {user1}. Os Traidores tinham respondido o mesmo.`, guesser.id === answer.id ? [guesser, guesser] : [guesser, answer]);
        // Se os Traidores temem alguém, esse alguém deve ser fiel.
        if (q.clears) for (const p of ctx.players) if (p.id !== answer.id && !isTraitor(p)) ctx.matrix.adjust(p.id, answer.id, { trust: 6 });
      } else {
        ctx.say(`"${q.text}" {user} errou a casa. A resposta dos Traidores era {user1}.`, guesser.id === answer.id ? [guesser, guesser] : [guesser, answer]);
      }
      if (i === 3) ctx.chatter(1);
    });
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

/** Missão do Vidente: sai uma vez, perto da final (ver finale.ts); não entra na sequência normal. */
export const SEER_MISSION: MissionDefinition = {
  key: 'seer',
  origin: 'EUA T3',
  name: 'O Poder do Vidente',
  description: 'Três provas valendo ouro individual: palhaços que escondem ouro, a corda da boneca e moedas no bosque. Quem juntar mais ouro vira o(a) Vidente e descobre a verdade sobre alguém.',
  prizeAvailable: 30000,
  play(ctx) {
    ctx.say('Três provas, ouro individual e um prêmio que vale mais que dinheiro: o poder do Vidente.');
    const banked = new Map<string, number>();
    const challenges = ['Os palhaços do terror', 'A corda da boneca', 'As moedas do bosque'];
    let total = 0;
    for (const challenge of challenges) {
      let challengeTotal = 0;
      for (const p of ctx.players) {
        if (!ctx.attempt(p, 55)) continue;
        // Cada prova vale até 10 mil: a parte de cada um depende de quantos disputam.
        const gold = Math.round(((0.6 + ctx.rng() * 0.8) * (10000 / ctx.players.length)) / 50) * 50;
        const capped = Math.min(gold, 10000 - challengeTotal);
        challengeTotal += capped;
        banked.set(p.id, (banked.get(p.id) ?? 0) + capped);
      }
      total += challengeTotal;
      const leader = top(ctx.players, (p) => banked.get(p.id) ?? 0, 1)[0];
      ctx.say(`${challenge}: ${ctx.money(challengeTotal)} para o prêmio. {user} lidera a disputa pelo poder.`, [leader]);
    }
    ctx.chatter(1);

    const theSeer = top(ctx.players, (p) => (banked.get(p.id) ?? 0) + ctx.rng(), 1)[0];
    ctx.say('{user} juntou mais ouro e ganhou o poder do Vidente. Esta noite, {user} janta a sós com quem quiser e descobre se é Traidor(a) ou Fiel.', [theSeer]);
    ctx.applaud(theSeer, 2);
    ctx.twists.seerId = theSeer.id;
    return { prizeEarned: Math.round(total), shieldIds: [] };
  },
};

/** Missão final (a do último dia, com a reta final já começada); não entra na sequência normal. */
export const FINAL_MISSION: MissionDefinition = {
  key: 'helicopter',
  origin: 'EUA T3',
  name: 'O Dia do Juízo Final',
  description: 'Primeiro, charadas para achar sacos de dinheiro pela propriedade. Depois, duplas penduradas num helicóptero soltam os sacos num anel de fogo: acertar dobra o valor.',
  prizeAvailable: 50000,
  play(ctx) {
    ctx.say('Parte 1: trinta minutos para decifrar charadas e achar dez sacos de dinheiro escondidos.');
    const teams = ctx.teams(2).filter((t) => t.length);
    let bags = 0;
    for (let i = 0; i < 10; i++) {
      const team = teams[i % teams.length];
      const solver = ctx.pick(1, (p) => p.traits.skill + p.traits.paranoia * 0.3, team)[0];
      if (ctx.attempt(solver, 55, team)) bags++;
    }
    ctx.say(`O grupo encontrou ${bags} de 10 sacos.`);
    ctx.chatter(1);
    ctx.say('Parte 2: o helicóptero decola. Cada saco solto dentro do anel de fogo vale o dobro.');
    let earned = 0;
    const pairs = ctx.pairs();
    for (let i = 0; i < bags; i++) {
      const pair = pairs[i % Math.max(1, pairs.length)];
      if (!pair) {
        earned += 2500;
        continue;
      }
      const [a, b] = pair;
      if (ctx.attempt(a, 58, [b])) {
        earned += 5000;
        ctx.say('{user} soltou o saco no centro do fogo enquanto {user1} gritava a direção.', [a, b]);
      } else {
        earned += 2500;
        ctx.say('O vento levou o saco de {user} para fora do anel.', [a]);
      }
    }
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const train: MissionDefinition = {
  key: 'train',
  origin: 'Reino Unido T3',
  name: 'O Trem Fantasma',
  description: 'Um trem a vapor atravessa as Highlands. Três voluntários precisam descer no meio do nada em até dez minutos; cada minuto de hesitação custa dinheiro.',
  prizeAvailable: 10000,
  play(ctx) {
    ctx.say('O trem apita. A ordem: três pessoas devem descer na próxima parada e voltar a pé, sozinhas, na chuva.');
    const volunteers: SimPlayer[] = [];
    let minute = 0;
    while (volunteers.length < 3 && minute < 10 && volunteers.length < ctx.players.length) {
      minute++;
      for (const p of shuffle(ctx.rng, ctx.players)) {
        if (volunteers.includes(p) || volunteers.length >= 3) continue;
        if (chance(ctx.rng, (p.traits.loyalty + (100 - p.traits.paranoia)) / 900)) {
          volunteers.push(p);
          ctx.applaud(p, 4);
          ctx.say(`Minuto ${minute}: {user} se levantou e desceu do trem.`, [p]);
        }
      }
    }
    const earned = Math.max(0, 10000 - Math.max(0, minute - 3) * 1000 - (3 - volunteers.length) * 2000);
    if (volunteers.length < 3) ctx.say('O tempo acabou sem voluntários suficientes. Olhares tortos no vagão.');
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const ceremony: MissionDefinition = {
  key: 'ceremony',
  origin: 'Reino Unido T3',
  name: 'A Cerimônia da Verdade',
  description: 'Três escudos são entregues em segredo. De olhos vendados, o grupo aponta quem não merece o escudo: se acertar, o escudo se perde.',
  prizeAvailable: 5000,
  play(ctx) {
    const holders = ctx.pick(Math.min(3, ctx.players.length), () => 1);
    const ids = ctx.players.map((p) => p.id);
    ctx.say('Vendas nos olhos. Três escudos foram entregues em silêncio e o grupo precisa decidir quem não merece.');
    const kept: SimPlayer[] = [];
    for (const holder of holders) {
      const doubt = 100 - ctx.matrix.toward(holder.id, ids).trust;
      const accuser = top(ctx.players.filter((p) => p.id !== holder.id), (p) => ctx.matrix.suspicion(p.id, holder.id), 1)[0];
      if (accuser && doubt + (ctx.rng() * 30 - 15) > 50) {
        ctx.matrix.adjust(holder.id, accuser.id, { hatred: 12, trust: -8 });
        ctx.say('{user} apontou {user1} como indigno(a) do escudo. Acertou: o escudo foi destruído.', [accuser, holder]);
      } else {
        kept.push(holder);
      }
    }
    if (kept.length) ctx.secret(`${tokenList(kept.length)} passou(aram) despercebido(s) e mantém o escudo.`, kept);
    ctx.chatter(2);
    return { prizeEarned: 5000, shieldIds: kept.map((p) => p.id) };
  },
};

const hidden: MissionDefinition = {
  key: 'hidden',
  origin: 'Reino Unido T3',
  name: 'Os Desaparecidos',
  description: 'Três jogadores foram escondidos pela propriedade. Charadas levam até eles; cada um encontrado vale dinheiro.',
  prizeAvailable: 7500,
  play(ctx) {
    const missing = ctx.pick(Math.min(3, ctx.players.length - 1), () => 1);
    const searchers = ctx.players.filter((p) => !missing.includes(p));
    ctx.say(`Ao amanhecer, ${tokenList(missing.length)} tinham sumido. Só as charadas dizem onde estão.`, missing);
    let earned = 0;
    for (const person of missing) {
      const team = ctx.pick(Math.min(3, searchers.length), (p) => p.traits.skill + ctx.matrix.get(p.id, person.id).liking * 0.5, searchers);
      const finder = team.find((p) => ctx.attempt(p, 60, team));
      if (finder) {
        earned += 2500;
        ctx.matrix.adjust(person.id, finder.id, { liking: 8 });
        ctx.say('{user} decifrou a charada e encontrou {user1} trancado(a) na cripta.', [finder, person]);
      } else {
        ctx.say('Ninguém decifrou a charada a tempo; {user} voltou sozinho(a) e bem irritado(a).', [person]);
      }
    }
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

/** Ordem das missões da 3ª temporada: as dos EUA e, depois, as exclusivas do Reino Unido. */
export const SEASON_3_MISSIONS: readonly MissionDefinition[] = [
  longboat,
  cages,
  funHouse,
  statues,
  portraits,
  gunpowder,
  boxes,
  nurseryRhymes,
  chess,
  train,
  ceremony,
  hidden,
];
