import { chance } from '../random';
import { SimPlayer } from '../traits';
import { MissionDefinition } from './MissionContext';
import { tokenList } from '../tokens';
import { byInfluence, top, variant } from './helpers';

/**
 * Missões da 1ª temporada de The Traitors. As duas versões dividem boa parte das provas, mas não a ordem
 * nem os valores (dólares nos EUA, libras no Reino Unido). Na versão britânica, a equipe mais rápida
 * de várias missões entrava no arsenal e disputava um escudo.
 */

const US = 'EUA T1';
const UK = 'Reino Unido T1';

/** Versão britânica: além do dinheiro, quem se destaca entra no arsenal e sai com um escudo. */
function withArmoury(def: MissionDefinition): MissionDefinition {
  return {
    ...def,
    description: `${def.description} A equipe mais rápida entra no arsenal, onde um escudo espera por alguém.`,
    play(ctx) {
      const outcome = def.play(ctx);
      if (outcome.shieldIds.length || !outcome.prizeEarned) return outcome;
      const winner = top(ctx.players, (p) => p.traits.skill + ctx.rng() * 60, 1)[0];
      if (!winner) return outcome;
      ctx.shield('No arsenal, entre caixas e armaduras, {user} achou o escudo.', [winner]);
      return { ...outcome, shieldIds: [winner.id] };
    },
  };
}

const wickerMen: MissionDefinition = {
  key: 'wicker-men',
  origin: US,
  name: 'Os Homens de Vime',
  description: 'Equipes remam até o meio do lago para buscar a chama, montam os pavios e incendeiam gigantes de vime. Cada gigante em chamas vale dinheiro.',
  prizeAvailable: 30000,
  play(ctx) {
    const teams = ctx.teams(3).filter((t) => t.length);
    const perTeam = Math.round(30000 / teams.length);
    ctx.say('Três gigantes de vime esperam na margem. A chama está no meio do lago, e o pavio precisa ser montado peça por peça.');
    let earned = 0;
    teams.forEach((team, i) => {
      const captain = byInfluence(team);
      const rower = ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.4, team)[0];
      const builder = ctx.pick(1, (p) => p.traits.skill + p.traits.insight * 0.4, team)[0];
      ctx.say(`Equipe ${i + 1}: {user} dá as ordens.`, [captain]);
      if (!ctx.attempt(rower, 48, team)) {
        ctx.say('{user} virou o barco na volta e a chama apagou dentro da água.', [rower]);
        return;
      }
      if (ctx.attempt(builder, 52, team)) {
        earned += perTeam;
        ctx.say('{user} encaixou o último pavio e o gigante de vime subiu em chamas.', [builder]);
      } else {
        ctx.say('O pavio de {user} queimou no meio do caminho. O gigante continua apagado.', [builder]);
      }
    });
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const buriedAlive: MissionDefinition = {
  key: 'buried-alive',
  origin: US,
  name: 'Enterrados Vivos',
  description: 'Alguns jogadores são enterrados em caixões pelo terreno. O resto tem 40 minutos para encontrá-los e desenterrá-los.',
  prizeAvailable: 30000,
  play(ctx) {
    const buried = ctx.pick(Math.min(3, ctx.players.length - 1), (p) => 100 - p.traits.paranoia + 10);
    const diggers = ctx.players.filter((p) => !buried.includes(p));
    ctx.say(`${tokenList(buried.length)} ${buried.length > 1 ? 'foram enterrados' : 'foi enterrado(a)'} em caixões. O relógio começa agora.`, buried);
    let earned = 0;
    for (const person of buried) {
      const team = ctx.pick(Math.min(3, diggers.length), (p) => p.traits.skill + ctx.matrix.get(p.id, person.id).liking * 0.5, diggers);
      const hero = team.find((p) => ctx.attempt(p, 55, team));
      if (hero) {
        earned += 10000;
        ctx.matrix.adjust(person.id, hero.id, { liking: 10, trust: 6 });
        ctx.say('{user} cavou com as mãos até achar o caixão de {user1}.', [hero, person]);
      } else {
        ctx.say('O tempo acabou com {user} ainda embaixo da terra. Saiu furioso(a) e coberto(a) de lama.', [person]);
      }
    }
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const chapelBells: MissionDefinition = {
  key: 'chapel-bells',
  origin: US,
  name: 'Os Sinos da Capela',
  description: 'Um grupo toca os sinos da capela; o outro precisa reconhecer cada melodia entre as caixinhas de música da coleção do castelo.',
  prizeAvailable: 25000,
  play(ctx) {
    const [ringers, listeners] = ctx.teams(2);
    ctx.say('Os sinos ecoam pelo vale. Cinco melodias, cinco caixinhas de música certas.');
    let earned = 0;
    for (let round = 1; round <= 5; round++) {
      const ringer = ctx.pick(1, (p) => p.traits.skill, ringers)[0];
      const listener = (listeners.length ? ctx.pick(1, (p) => p.traits.insight + p.traits.skill, listeners) : [ringer])[0];
      if (ctx.attempt(ringer, 45, ringers) && ctx.attempt(listener, 55, listeners)) {
        earned += 5000;
        ctx.say(`Melodia ${round}: {user} tocou e {user1} achou a caixinha certa.`, [ringer, listener]);
      } else {
        ctx.say(`Melodia ${round}: {user} errou o ritmo ou {user1} errou a caixinha. Silêncio constrangedor.`, [ringer, listener]);
      }
      if (round === 3) ctx.chatter(1);
    }
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const wheel: MissionDefinition = {
  key: 'wheel',
  origin: US,
  name: 'A Roda da Morte',
  description: 'Presos a uma roda que gira, os jogadores respondem "quem do castelo..." e precisam acertar o que o grupo previu. Se ninguém desistir, há bônus.',
  prizeAvailable: 22000,
  play(ctx) {
    const onWheel = ctx.pick(Math.min(6, ctx.players.length), (p) => p.traits.skill + 20);
    const questions = [
      'quem é o(a) mais desconfiado(a)?',
      'quem seria o(a) melhor traidor(a)?',
      'quem chora primeiro?',
      'quem você levaria para a final?',
      'quem fala demais?',
      'quem está jogando sozinho(a)?',
    ];
    ctx.say('A roda gira de cabeça para baixo. Cada resposta que bate com a previsão do grupo vale dinheiro.');
    let earned = 0;
    let quit = false;
    onWheel.forEach((spinner, i) => {
      const others = ctx.players.filter((p) => p.id !== spinner.id);
      const answer = top(others, (p) => ctx.matrix.suspicion(spinner.id, p.id) + ctx.rng() * 30, 1)[0];
      const predicted = top(others, (p) => 100 - ctx.matrix.toward(p.id, ctx.players.map((x) => x.id)).trust + ctx.rng() * 30, 1)[0];
      const q = questions[i % questions.length];
      if (answer && predicted && answer.id === predicted.id) {
        earned += 3000;
        ctx.say(`"${q}" {user} respondeu {user1}, exatamente como o grupo previu.`, [spinner, answer]);
      } else if (answer) {
        ctx.say(`"${q}" {user} respondeu {user1}. O grupo tinha apostado em outra pessoa.`, [spinner, answer]);
      }
      if (!ctx.attempt(spinner, 40 + (spinner.traits.volatility - 50) * 0.4)) {
        quit = true;
        ctx.say('{user} passou mal e pediu para sair da roda.', [spinner]);
      }
    });
    if (!quit) {
      earned += 4000;
      ctx.say('Ninguém desistiu: bônus para o prêmio.');
    }
    ctx.chatter(1);
    return { prizeEarned: Math.min(22000, earned), shieldIds: [] };
  },
};

const maskedCongregation: MissionDefinition = {
  key: 'masked-congregation',
  origin: US,
  name: 'A Congregação Mascarada',
  description: 'Parágrafos de um livro antigo escondem charadas. Cada charada decifrada revela qual figura mascarada da capela veste a roupa certa.',
  prizeAvailable: 20000,
  play(ctx) {
    ctx.say('Figuras mascaradas enchem a capela em silêncio. As respostas estão num livro empoeirado.');
    let earned = 0;
    for (let riddle = 1; riddle <= 5; riddle++) {
      const reader = ctx.pick(1, (p) => p.traits.insight + p.traits.skill)[0];
      if (ctx.attempt(reader, 52)) {
        earned += 4000;
        ctx.say(`Charada ${riddle}: {user} decifrou o parágrafo e apontou a figura certa.`, [reader]);
      } else {
        ctx.say(`Charada ${riddle}: {user} apontou para a figura errada. A máscara nem se mexeu.`, [reader]);
      }
    }
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const whiskyBarrels: MissionDefinition = {
  key: 'whisky-barrels',
  origin: US,
  name: 'Os Barris de Uísque',
  description: 'Barris de uísque precisam subir a colina em 90 minutos. Quem carregar o barril marcado ganha acesso ao arsenal e ao escudo.',
  prizeAvailable: 30000,
  play(ctx) {
    ctx.say('Dez barris, uma colina íngreme e noventa minutos. Um dos barris tem uma marca: a chave do arsenal.');
    const teams = ctx.teams(Math.min(5, Math.max(1, Math.floor(ctx.players.length / 2)))).filter((t) => t.length);
    let barrels = 0;
    const carriers: SimPlayer[] = [];
    for (let i = 0; i < 10; i++) {
      const team = teams[i % teams.length];
      const carrier = ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.3, team)[0];
      if (ctx.attempt(carrier, 50, team)) {
        barrels++;
        carriers.push(carrier);
      }
    }
    ctx.say(`${barrels} de 10 barris chegaram ao topo.`);
    const shieldHolder = carriers.length ? carriers[Math.floor(ctx.rng() * carriers.length)] : undefined;
    if (shieldHolder) ctx.shield('{user} carregou o barril marcado e entrou no arsenal: escudo.', [shieldHolder]);
    ctx.chatter(2);
    return { prizeEarned: barrels * 3000, shieldIds: shieldHolder ? [shieldHolder.id] : [] };
  },
};

const billiards: MissionDefinition = {
  key: 'billiards',
  origin: US,
  name: 'O Salão de Bilhar',
  description: 'Em 60 segundos, cada dupla precisa descobrir as três coisas que mudaram no salão de bilhar. Quem mais acerta vai ao arsenal.',
  prizeAvailable: 30000,
  play(ctx) {
    ctx.say('Olhem bem: quadros, tacos, bolas, relógio. Depois de sair, três coisas vão mudar.');
    let earned = 0;
    const scores = new Map<string, number>();
    for (const [a, b] of ctx.pairs(6)) {
      let found = 0;
      for (let item = 0; item < 3; item++) if (ctx.attempt(chance(ctx.rng, 0.5) ? a : b, 68, [a, b])) found++;
      scores.set(a.id, found);
      scores.set(b.id, found);
      if (found === 3) earned += 5000;
      ctx.say(found === 3 ? '{user} e {user1} acharam as três mudanças.' : `{user} e {user1} acharam ${found} de 3.`, [a, b]);
    }
    const best = top(ctx.players, (p) => (scores.get(p.id) ?? 0) + p.traits.skill / 200 + ctx.rng() * 0.1, 1)[0];
    if (best && scores.get(best.id)) ctx.shield('Com o olho mais afiado, {user} ganhou a ida ao arsenal: escudo.', [best]);
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: best && scores.get(best.id) ? [best.id] : [] };
  },
};

const cabins: MissionDefinition = {
  key: 'cabins',
  origin: US,
  name: 'As Cabanas na Floresta',
  description: 'Equipes trancadas em cabanas de caça têm 30 minutos para resolver os enigmas e escapar.',
  prizeAvailable: 35000,
  play(ctx) {
    const teams = ctx.teams(Math.min(3, ctx.players.length)).filter((t) => t.length);
    const perTeam = Math.round(35000 / teams.length);
    ctx.say('Cadeados, mapas e cabeças de cervo nas paredes. Trinta minutos para sair.');
    let earned = 0;
    const solvers: SimPlayer[] = [];
    teams.forEach((team) => {
      let solved = 0;
      for (let lock = 0; lock < 4; lock++) {
        const solver = ctx.pick(1, (p) => p.traits.insight + p.traits.skill, team)[0];
        if (ctx.attempt(solver, 50, team)) {
          solved++;
          solvers.push(solver);
        }
      }
      if (solved >= 3) {
        earned += perTeam;
        ctx.say('A equipe de {user} abriu o último cadeado com segundos de sobra.', [byInfluence(team)]);
      } else {
        ctx.say('A equipe de {user} ficou presa na cabana, brigando por causa de um mapa.', [byInfluence(team)]);
      }
    });
    const best = top(solvers, (p) => solvers.filter((s) => s.id === p.id).length + ctx.rng() * 0.5, 1)[0];
    if (best) ctx.shield('{user} resolveu mais enigmas que todo mundo: escudo.', [best]);
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: best ? [best.id] : [] };
  },
};

const lasers: MissionDefinition = {
  key: 'lasers',
  origin: US,
  name: 'O Roubo dos Lasers',
  description: 'Um a um, os jogadores atravessam uma sala cruzada por lasers para roubar artefatos. Tocar num feixe dispara o alarme.',
  prizeAvailable: 25000,
  play(ctx) {
    ctx.say('A sala está escura, cortada por feixes vermelhos. Cada artefato roubado vale dinheiro.');
    const thieves = ctx.pick(Math.min(8, ctx.players.length), (p) => p.traits.skill + 10);
    const value = Math.round(25000 / Math.max(1, thieves.length) / 500) * 500;
    let earned = 0;
    for (const thief of thieves) {
      if (ctx.attempt(thief, 60)) {
        earned += value;
        ctx.say('{user} deslizou entre os lasers e saiu com o artefato.', [thief]);
      } else {
        ctx.say('{user} encostou num feixe. O alarme gritou pelo castelo inteiro.', [thief]);
      }
    }
    ctx.chatter(1);
    return { prizeEarned: Math.min(25000, earned), shieldIds: [] };
  },
};

const lochGlass: MissionDefinition = {
  key: 'loch-glass',
  origin: US,
  name: 'O Lago Glass',
  description: 'A última missão: saltar de um helicóptero no lago gelado, nadar até as boias e trazer os sacos de dinheiro de lancha.',
  prizeAvailable: 68000,
  play(ctx) {
    ctx.say('O helicóptero sobrevoa o lago Glass. Três sacos de dinheiro boiam na água gelada.');
    const jumpers = ctx.pick(Math.min(3, ctx.players.length), (p) => p.traits.skill + p.traits.aggression * 0.5);
    const bag = Math.round(68000 / 3);
    let earned = 0;
    jumpers.forEach((jumper, i) => {
      if (ctx.attempt(jumper, 45, ctx.players)) {
        earned += bag;
        ctx.applaud(jumper, 4);
        ctx.say(`Saco ${i + 1}: {user} saltou, nadou e voltou agarrado(a) ao dinheiro.`, [jumper]);
      } else {
        ctx.say(`Saco ${i + 1}: {user} travou na porta do helicóptero. O saco ficou no lago.`, [jumper]);
      }
    });
    ctx.chatter(2);
    return { prizeEarned: Math.min(68000, earned), shieldIds: [] };
  },
};

const sheep: MissionDefinition = {
  key: 'sheep',
  origin: UK,
  name: 'As Ovelhas',
  description: 'Cada equipe descreve uma ovelha para a outra, que precisa encontrá-la no rebanho. Bééé.',
  prizeAvailable: 10000,
  play(ctx) {
    const [describers, finders] = ctx.teams(2);
    ctx.say('Um rebanho inteiro, todas iguais. Descrições pelo rádio e muita lama.');
    let earned = 0;
    for (let round = 1; round <= 5; round++) {
      const describer = ctx.pick(1, (p) => p.traits.sociability + p.traits.skill, describers)[0];
      const finder = (finders.length ? ctx.pick(1, (p) => p.traits.insight + p.traits.skill, finders) : [describer])[0];
      if (ctx.attempt(describer, 50) && ctx.attempt(finder, 50)) {
        earned += 2000;
        ctx.say(`Ovelha ${round}: "orelha torta, cara de quem esconde algo". {user1} achou a ovelha de {user}.`, [describer, finder]);
      } else {
        ctx.say(`Ovelha ${round}: {user} descreveu, {user1} trouxe a ovelha errada. A ovelha certa pareceu rir.`, [describer, finder]);
      }
    }
    const sheepish = top(ctx.players, (p) => p.traits.conformity + ctx.rng() * 20, 1)[0];
    if (sheepish) ctx.say('Na volta, o grupo elegeu {user} como "a maior ovelha do castelo". Não pegou bem.', [sheepish]);
    if (sheepish) for (const p of ctx.players) if (p.id !== sheepish.id) ctx.matrix.adjust(sheepish.id, p.id, { liking: -2 });
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const truthRoad: MissionDefinition = {
  key: 'truth-road',
  origin: UK,
  name: 'A Estrada da Verdade',
  description: 'Duplas dirigem por estradas de terra; em cada bifurcação, uma pergunta de verdadeiro ou falso escolhe o caminho.',
  prizeAvailable: 6000,
  play(ctx) {
    ctx.say('Carros antigos, estradas de terra e placas que perguntam: verdadeiro ou falso?');
    let earned = 0;
    for (const [driver, navigator] of ctx.pairs(3)) {
      const right = [0, 1, 2].filter(() => ctx.attempt(navigator, 50, [driver])).length;
      if (right >= 2) {
        earned += 2000;
        ctx.say('{user} e {user1} chegaram ao destino pela estrada certa.', [driver, navigator]);
      } else {
        ctx.say('{user1} jurou que era "verdadeiro". Era falso. {user} parou o carro num atoleiro.', [driver, navigator]);
      }
    }
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const blindBridge: MissionDefinition = {
  key: 'blind-bridge',
  origin: UK,
  name: 'A Ponte Vendada',
  description: 'De olhos vendados, cada jogador atravessa uma ponte guiado pela voz de um parceiro para pegar o dinheiro no meio do caminho.',
  prizeAvailable: 7000,
  play(ctx) {
    ctx.say('Vendas nos olhos, uma ponte estreita sobre o abismo e só uma voz para confiar.');
    let earned = 0;
    for (const [walker, guide] of ctx.pairs(4)) {
      const trust = ctx.matrix.get(walker.id, guide.id).trust;
      if (ctx.attempt(walker, 60 - (trust - 50) * 0.4, [guide])) {
        earned += 1750;
        ctx.matrix.adjust(walker.id, guide.id, { trust: 6 });
        ctx.say('{user} confiou em cada palavra de {user1} e voltou com o dinheiro.', [walker, guide]);
      } else {
        ctx.matrix.adjust(walker.id, guide.id, { trust: -6 });
        ctx.say('{user} não confiou na voz de {user1}, travou no meio da ponte e o tempo acabou.', [walker, guide]);
      }
    }
    ctx.chatter(1);
    return { prizeEarned: Math.min(7000, earned), shieldIds: [] };
  },
};

/** EUA T1 (2023), na ordem da exibição; o Lago Glass é a missão final. */
export const US_SEASON_1_MISSIONS: readonly MissionDefinition[] = [wickerMen, buriedAlive, chapelBells, wheel, maskedCongregation, whiskyBarrels, billiards, cabins, lasers];
export const US_SEASON_1_FINALE = lochGlass;

/** Reino Unido T1 (2022), na ordem da exibição. */
export const UK_SEASON_1_MISSIONS: readonly MissionDefinition[] = [
  variant(wickerMen, { origin: UK, prizeAvailable: 15000 }),
  variant(chapelBells, { origin: UK, prizeAvailable: 10000 }),
  variant(wheel, { origin: UK, prizeAvailable: 10000 }),
  sheep,
  withArmoury(variant(maskedCongregation, { origin: UK, prizeAvailable: 10000 })),
  withArmoury(variant(buriedAlive, { origin: UK, prizeAvailable: 9000 })),
  variant(whiskyBarrels, { origin: UK, prizeAvailable: 10000 }),
  variant(cabins, { origin: UK, prizeAvailable: 6000 }),
  withArmoury(truthRoad),
  variant(lasers, { origin: UK, prizeAvailable: 10000 }),
  blindBridge,
];
export const UK_SEASON_1_FINALE = variant(lochGlass, {
  origin: UK,
  prizeAvailable: 20000,
  name: 'A Caça ao Tesouro da Costa',
  description: 'A última missão: os dois melhores nadadores buscam coordenadas de helicóptero e o grupo, de lancha, vasculha dezesseis quilômetros de costa atrás dos sacos de dinheiro em 30 minutos.',
});
