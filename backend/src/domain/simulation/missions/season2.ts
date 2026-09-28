import { publicSuspicion, murderChances } from '../decisions';
import { chance } from '../random';
import { isTraitor, SimPlayer } from '../traits';
import { MissionDefinition } from './MissionContext';
import { tokenList } from '../tokens';
import { byInfluence, top, variant } from './helpers';

/**
 * Missões da 2ª temporada de The Traitors. EUA e Reino Unido (ambas de 2024) dividem várias provas,
 * com ordem e valores próprios. Nas duas, o cemitério arma a taça envenenada (assassinato à vista de
 * todos); só a britânica tem a masmorra (os traidores só podem matar um dos condenados) e o monumento
 * (sem assassinato naquela noite).
 */

const US = 'EUA T2';
const UK = 'Reino Unido T2';

const beacon: MissionDefinition = {
  key: 'beacon',
  origin: US,
  name: 'O Farol',
  description: 'Amarrados a postes dentro do lago, os jogadores se soltam, montam o quebra-cabeça do farol e acendem o fogo. Os mais rápidos ganham escudo.',
  prizeAvailable: 30000,
  play(ctx) {
    ctx.say('Água gelada até a cintura, cordas nos pulsos e um farol apagado na margem.');
    const freed = ctx.players.filter((p) => ctx.attempt(p, 42));
    ctx.say(`${freed.length} de ${ctx.players.length} se soltaram dos postes.`);
    const builders = top(freed, (p) => p.traits.skill + p.traits.insight * 0.5 + ctx.rng() * 20, 4);
    let pieces = 0;
    for (const b of builders) if (ctx.attempt(b, 50, builders)) pieces++;
    const lit = pieces >= Math.min(3, builders.length) && builders.length > 0;
    ctx.say(lit ? 'O quebra-cabeça fechou e o farol acendeu sobre o lago.' : 'Faltou uma peça. O farol continua apagado.');
    const fastest = top(freed, (p) => p.traits.skill + ctx.rng() * 30, 3);
    if (fastest.length) ctx.shield(`Os primeiros a se soltar, ${tokenList(fastest.length)}, ganham escudo.`, fastest);
    ctx.chatter(2);
    return { prizeEarned: lit ? 30000 : pieces * 5000, shieldIds: fastest.map((p) => p.id) };
  },
};

const scarecrows: MissionDefinition = {
  key: 'scarecrows',
  origin: US,
  name: 'Os Espantalhos',
  description: 'Perguntas sobre o próprio elenco abrem os cadeados dos espantalhos; dentro deles, moedas de ouro. Quem achar a moeda especial ganha escudo.',
  prizeAvailable: 20000,
  play(ctx) {
    ctx.say('Um campo de espantalhos, cada um com um cadeado. As perguntas são sobre vocês mesmos.');
    let earned = 0;
    for (let i = 1; i <= 5; i++) {
      const guesser = ctx.pick(1, (p) => p.traits.insight + p.traits.sociability * 0.5)[0];
      if (ctx.attempt(guesser, 50)) {
        earned += 4000;
        ctx.say(`Espantalho ${i}: {user} acertou quem do elenco tinha "medo de altura". Cadeado aberto.`, [guesser]);
      } else {
        ctx.say(`Espantalho ${i}: {user} chutou errado e a chave não girou.`, [guesser]);
      }
    }
    const lucky = ctx.pick(1, (p) => p.traits.skill)[0];
    if (lucky) ctx.shield('Dentro do último espantalho, {user} achou a moeda do escudo.', [lucky]);
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: lucky ? [lucky.id] : [] };
  },
};

const cemetery: MissionDefinition = {
  key: 'cemetery',
  origin: US,
  name: 'O Cemitério',
  description: 'À noite, os jogadores abrem túmulos e criptas atrás de ouro enquanto holofotes caçam quem se mexe. Nesta noite, os traidores podem matar à vista de todos.',
  prizeAvailable: 20000,
  play(ctx) {
    ctx.say('Meia-noite no cemitério. Quem for pego pelo holofote está fora. Cada túmulo pode ter ouro.');
    let earned = 0;
    const caught: SimPlayer[] = [];
    for (const p of ctx.players) {
      if (ctx.attempt(p, 50)) earned += Math.round(20000 / ctx.players.length / 250) * 250;
      else caught.push(p);
    }
    if (caught.length) ctx.say(`O holofote pegou ${tokenList(Math.min(caught.length, 3))}${caught.length > 3 ? ' e outros' : ''}.`, caught.slice(0, 3));
    const shielded = top(ctx.players.filter((p) => !caught.includes(p)), (p) => p.traits.skill + ctx.rng() * 30, 3);
    if (shielded.length) ctx.shield(`Nas criptas, ${tokenList(shielded.length)} encontraram escudos.`, shielded);
    ctx.chatter(1);
    if (ctx.traitors.length) {
      ctx.twists.poisonTonight = true;
      ctx.secret('Na volta ao castelo, os traidores receberam uma taça e um frasco: esta noite, o assassinato será à vista de todos.');
    }
    return { prizeEarned: Math.min(20000, earned), shieldIds: shielded.map((p) => p.id) };
  },
};

const funeral: MissionDefinition = {
  key: 'funeral',
  origin: US,
  name: 'O Funeral',
  description: 'Um cortejo fúnebre: quem acerta as perguntas vai de carruagem, o resto caminha. No fim, os três últimos precisam adivinhar quem os traidores querem matar.',
  prizeAvailable: 20000,
  play(ctx) {
    ctx.say('Um caixão, uma carruagem e véus pretos. Cada resposta errada é uma caminhada na chuva.');
    const riders: SimPlayer[] = [];
    for (const p of ctx.players) if (ctx.attempt(p, 55)) riders.push(p);
    const walkers = ctx.players.filter((p) => !riders.includes(p));
    ctx.say(`${riders.length} foram de carruagem; ${walkers.length} seguiram o caixão a pé.`);
    const finalists = top(riders.length >= 3 ? riders : ctx.players, (p) => p.traits.insight + ctx.rng() * 30, 3);
    const traitors = ctx.traitors;
    let earned = 0;
    if (traitors.length && finalists.length) {
      const chances = murderChances(ctx.matrix, traitors, ctx.players);
      const target = [...chances].sort((a, b) => b[1] - a[1])[0]?.[0];
      const guesser = finalists[0];
      const guess = top(ctx.players.filter((p) => !isTraitor(p) && p.id !== guesser.id), (p) => p.traits.influence + ctx.rng() * 50, 1)[0];
      if (guess && guess.id === target) {
        earned = 20000;
        ctx.say('{user} apontou para {user1} como a próxima vítima. Acertou, e o prêmio veio inteiro.', [guesser, guess]);
      } else if (guess) {
        ctx.say('{user} apontou para {user1} como a próxima vítima. Errou, e o dinheiro foi enterrado junto com o caixão.', [guesser, guess]);
      }
    } else {
      earned = 10000;
      ctx.say('Sem ninguém para adivinhar, o grupo recebeu só a metade do prêmio.');
    }
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const birdCalls: MissionDefinition = {
  key: 'bird-calls',
  origin: US,
  name: 'O Canto dos Pássaros',
  description: 'Corredores imitam o canto dos pássaros pelo rádio; no castelo, o outro grupo precisa achar o pássaro empalhado certo.',
  prizeAvailable: 15000,
  play(ctx) {
    const [runners, castle] = ctx.teams(2);
    ctx.say('Cucos, corujas e corvos. Pelo rádio, só vozes humanas tentando parecer pássaros.');
    let earned = 0;
    const hits = new Map<string, number>();
    for (let i = 1; i <= 5; i++) {
      const runner = ctx.pick(1, (p) => p.traits.sociability + p.traits.skill, runners)[0];
      const matcher = (castle.length ? ctx.pick(1, (p) => p.traits.insight, castle) : [runner])[0];
      if (ctx.attempt(runner, 50) && ctx.attempt(matcher, 50)) {
        earned += 3000;
        hits.set(runner.id, (hits.get(runner.id) ?? 0) + 1);
        ctx.say(`Pássaro ${i}: o "piu" de {user} foi perfeito e {user1} achou a coruja certa.`, [runner, matcher]);
      } else {
        ctx.say(`Pássaro ${i}: {user} imitou algo entre um pato e uma sirene. {user1} desistiu.`, [runner, matcher]);
      }
    }
    const best = top(runners, (p) => (hits.get(p.id) ?? 0) + ctx.rng() * 0.5, 2).filter((p) => hits.get(p.id));
    if (best.length) ctx.shield(`Melhores imitadores: ${tokenList(best.length)}. Escudo.`, best);
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: best.map((p) => p.id) };
  },
};

const catapult: MissionDefinition = {
  key: 'catapult',
  origin: US,
  name: 'A Catapulta',
  description: 'Peças espalhadas pela propriedade, uma catapulta para montar e um único disparo com a bala de ouro.',
  prizeAvailable: 20000,
  play(ctx) {
    ctx.say('Rodas, cordas, uma alavanca gigante e uma bala de canhão dourada.');
    const gatherers = ctx.players.filter((p) => ctx.attempt(p, 45));
    const assembled = gatherers.length >= Math.ceil(ctx.players.length / 2);
    ctx.say(assembled ? 'A catapulta ficou de pé.' : 'Faltaram peças: a catapulta ficou torta, mas vai assim mesmo.');
    const shooter = byInfluence(ctx.players);
    const hit = ctx.attempt(shooter, assembled ? 45 : 65, ctx.players);
    ctx.say(hit ? '{user} puxou a alavanca e a bala de ouro caiu no centro do alvo.' : '{user} puxou a alavanca e a bala foi parar no lago.', [shooter]);
    if (hit) ctx.shield('Quem disparou leva o escudo: {user}.', [shooter]);
    ctx.chatter(2);
    return { prizeEarned: hit ? 20000 : 0, shieldIds: hit ? [shooter.id] : [] };
  },
};

function bog(origin: string, prizeAvailable: number, withShields: boolean): MissionDefinition {
  return {
    key: 'bog',
    origin,
    name: 'O Pântano',
    description: `Em duplas, carregando ouro por um pântano: cada resposta certa indica a corda segura; cada erro afunda o ouro.${withShields ? ' A dupla mais rápida ganha escudos.' : ''}`,
    prizeAvailable,
    play(ctx) {
      ctx.say('Lama até o joelho, cordas que se partem e ouro pesado nas costas.');
      let earned = 0;
      const survivors: [SimPlayer, SimPlayer][] = [];
      for (const [a, b] of ctx.pairs(5)) {
        const right = ctx.attempt(a, 55, [b]) && ctx.attempt(b, 50, [a]);
        if (right) {
          earned += prizeAvailable / 5;
          survivors.push([a, b]);
          ctx.say('{user} e {user1} escolheram a corda certa e atravessaram com o ouro.', [a, b]);
        } else {
          ctx.say('A corda de {user} e {user1} arrebentou. O ouro afundou no pântano.', [a, b]);
        }
      }
      const best = withShields ? top(survivors, ([a, b]) => a.traits.skill + b.traits.skill + ctx.rng() * 40, 1)[0] : undefined;
      if (best) ctx.shield('Os primeiros a chegar, {user} e {user1}, ganham escudos.', best);
      ctx.chatter(1);
      return { prizeEarned: earned, shieldIds: best ? best.map((p) => p.id) : [] };
    },
  };
}

const tunnels: MissionDefinition = {
  key: 'tunnels',
  origin: US,
  name: 'O Túnel da Fuga',
  description: 'Cinco jogadores rastejam por túneis escuros atrás de ouro; na cabana, o resto controla as luzes e guia pelo mapa.',
  prizeAvailable: 20000,
  play(ctx) {
    const crawlers = ctx.pick(Math.min(5, ctx.players.length), (p) => p.traits.skill + (100 - p.traits.paranoia) * 0.3);
    const guides = ctx.players.filter((p) => !crawlers.includes(p));
    ctx.say(`${tokenList(crawlers.length)} desceram aos túneis. Lá em cima, alguém precisa manter as luzes acesas.`, crawlers);
    let earned = 0;
    for (const crawler of crawlers) {
      const guide = guides.length ? ctx.pick(1, (p) => p.traits.insight + ctx.matrix.get(p.id, crawler.id).liking * 0.3, guides)[0] : crawler;
      if (ctx.attempt(crawler, 55, guide === crawler ? [] : [guide])) {
        earned += 4000;
        ctx.say('Guiado(a) por {user1}, {user} saiu do túnel com o ouro.', [crawler, guide]);
      } else {
        ctx.say('A luz apagou e {user} ficou perdido(a) no escuro, gritando o nome de {user1}.', [crawler, guide]);
      }
    }
    const best = top(crawlers, (p) => p.traits.skill + ctx.rng() * 30, 1)[0];
    if (best && earned > 0) ctx.shield('{user} guardou um escudo no bolso antes de sair do túnel.', [best]);
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: best && earned > 0 ? [best.id] : [] };
  },
};

const crossbows: MissionDefinition = {
  key: 'crossbows',
  origin: US,
  name: 'As Bestas',
  description: 'Vitrais com o nome de cada jogador. Na vez, cada um atira com a besta no vitral de outra pessoa; o último vitral inteiro ganha escudo. Cada erro custa dinheiro.',
  prizeAvailable: 25000,
  play(ctx) {
    ctx.say('Um vitral para cada nome. Quem tiver o vitral inteiro no fim ganha o escudo. Cada erro custa caro.');
    let earned = 25000;
    let standing = [...ctx.players];
    for (const shooter of ctx.players) {
      if (standing.length <= 1) break;
      const options = standing.filter((p) => p.id !== shooter.id);
      if (!options.length) continue;
      const target = top(options, (p) => ctx.matrix.suspicion(shooter.id, p.id) + ctx.matrix.get(shooter.id, p.id).hatred + ctx.rng() * 30, 1)[0];
      if (ctx.attempt(shooter, 50)) {
        standing = standing.filter((p) => p.id !== target.id);
        ctx.matrix.adjust(target.id, shooter.id, { hatred: 5 });
        ctx.say('{user} mirou no vitral de {user1}. Estilhaços para todo lado.', [shooter, target]);
      } else {
        earned -= 1500;
        ctx.say('{user} errou o vitral de {user1}. O prêmio encolheu.', [shooter, target]);
      }
    }
    const winner = standing.length === 1 ? standing[0] : undefined;
    if (winner) ctx.shield('O vitral de {user} foi o único que sobrou: escudo.', [winner]);
    ctx.chatter(1);
    return { prizeEarned: Math.max(0, earned), shieldIds: winner ? [winner.id] : [] };
  },
};

const scales: MissionDefinition = {
  key: 'scales',
  origin: US,
  name: 'A Balança',
  description: 'Cavar pepitas de ouro, atravessar plataformas flutuantes e depositar tudo numa balança gigante em 20 minutos.',
  prizeAvailable: 30000,
  play(ctx) {
    ctx.say('Pás, lama e plataformas que balançam sobre a água. A balança precisa pesar ouro suficiente.');
    let earned = 0;
    const bestCarrier = new Map<string, number>();
    for (const p of ctx.players) {
      const loads = [0, 1, 2].filter(() => ctx.attempt(p, 48)).length;
      earned += loads * Math.round(30000 / ctx.players.length / 3 / 150) * 150;
      bestCarrier.set(p.id, loads);
    }
    const best = top(ctx.players, (p) => (bestCarrier.get(p.id) ?? 0) + ctx.rng() * 0.5, 1)[0];
    ctx.say(`A balança pesou ${ctx.money(Math.min(30000, earned))} em ouro.`);
    if (best) ctx.shield('{user} carregou mais ouro que todos e ganhou o escudo.', [best]);
    ctx.chatter(1);
    return { prizeEarned: Math.min(30000, earned), shieldIds: best ? [best.id] : [] };
  },
};

const finalPath: MissionDefinition = {
  key: 'final-path',
  origin: US,
  name: 'O Caminho Final',
  description: 'Os finalistas seguem a trilha até o barco para hastear a bandeira; desvios pelo caminho escondem bandeiras extras que valem bônus.',
  prizeAvailable: 50000,
  play(ctx) {
    ctx.say('A última trilha. Um barco, uma bandeira e desvios tentadores pelo caminho.');
    const everyone = ctx.players;
    const arrived = everyone.filter((p) => ctx.attempt(p, 40, everyone)).length >= Math.ceil(everyone.length / 2);
    let earned = arrived ? 40000 : 20000;
    ctx.say(arrived ? 'A bandeira subiu no mastro do barco.' : 'Metade do grupo se perdeu na neblina. A bandeira subiu tarde demais.');
    const detour = ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.3)[0];
    if (detour && ctx.attempt(detour, 55)) {
      earned += 10000;
      ctx.say('{user} arriscou o desvio e voltou com todas as bandeiras extras.', [detour]);
    }
    ctx.chatter(2);
    return { prizeEarned: Math.min(50000, earned), shieldIds: [] };
  },
};

const dungeon: MissionDefinition = {
  key: 'dungeon',
  origin: UK,
  name: 'A Masmorra',
  description: 'O grupo condena quatro jogadores à masmorra: esta noite, os traidores só podem matar um deles. Na missão, a equipe vencedora pode libertar um condenado.',
  prizeAvailable: 10000,
  play(ctx) {
    const ids = ctx.players.map((p) => p.id);
    const pressure = publicSuspicion(ctx.matrix, ctx.players);
    const condemned = top(ctx.players, (p) => (pressure.get(p.id) ?? 50) - ctx.matrix.toward(p.id, ids).liking * 0.5 + ctx.rng() * 20, Math.min(4, ctx.players.length - 1));
    ctx.say(`O grupo votou e condenou ${tokenList(condemned.length)} à masmorra. Um deles pode não voltar amanhã.`, condemned);
    const free = ctx.players.filter((p) => !condemned.includes(p));
    const [teamA, teamB] = [free.filter((_, i) => i % 2 === 0), free.filter((_, i) => i % 2 === 1)];
    let earned = 0;
    let winners: SimPlayer[] = teamA;
    const scoreA = teamA.filter((p) => ctx.attempt(p, 50, teamA)).length;
    const scoreB = teamB.filter((p) => ctx.attempt(p, 50, teamB)).length;
    earned = Math.min(10000, (scoreA + scoreB) * 1000);
    if (scoreB > scoreA) winners = teamB;
    let rescued: SimPlayer | undefined;
    if (winners.length && condemned.length) {
      const leader = byInfluence(winners);
      rescued = top(condemned, (p) => ctx.matrix.get(leader.id, p.id).trust + ctx.matrix.get(leader.id, p.id).liking + ctx.rng() * 20, 1)[0];
      ctx.matrix.adjust(rescued.id, leader.id, { liking: 12, trust: 10 });
      ctx.say('A equipe de {user} venceu e escolheu libertar {user1} da masmorra.', [leader, rescued]);
    }
    const remaining = condemned.filter((p) => p !== rescued);
    if (remaining.length) {
      ctx.twists.dungeonIds = remaining.map((p) => p.id);
      ctx.secret(`Na torre, os traidores já sabem: só podem escolher entre ${tokenList(remaining.length)}.`, remaining);
    }
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const monument: MissionDefinition = {
  key: 'monument',
  origin: UK,
  name: 'O Monumento dos Traidores',
  description: 'Charadas destrancam o monumento dos traidores e revelam a espada sagrada. Quem a encontra pode ficar com um prêmio pessoal ou doá-lo ao pote. Se o monumento se abrir, não há assassinato nesta noite.',
  prizeAvailable: 7000,
  play(ctx) {
    ctx.say('Um monumento de pedra com quatro fechaduras e uma espada cravada lá dentro.');
    const solved = [0, 1, 2, 3].filter(() => ctx.attempt(ctx.pick(1, (p) => p.traits.insight + p.traits.skill)[0], 52)).length;
    let earned = solved * 1000;
    if (solved >= 3) {
      const finder = ctx.pick(1, (p) => p.traits.skill + ctx.rng() * 20)[0];
      ctx.say('O monumento se abriu. {user} ergueu a espada sagrada.', [finder]);
      if (chance(ctx.rng, finder.traits.loyalty / 100) || isTraitor(finder)) {
        earned += 3000;
        ctx.applaud(finder, 6);
        ctx.say('{user} recusou o prêmio pessoal e mandou tudo para o pote. O castelo aplaudiu de pé.', [finder]);
      } else {
        for (const p of ctx.players) if (p.id !== finder.id) ctx.matrix.adjust(p.id, finder.id, { trust: -4 });
        ctx.say('{user} ficou com o prêmio pessoal. O silêncio na sala disse tudo.', [finder]);
      }
      if (ctx.traitors.length) {
        ctx.twists.noMurderTonight = true;
        ctx.secret('Com o monumento aberto, a torre fica fechada esta noite: não haverá assassinato.');
      }
    }
    ctx.chatter(1);
    return { prizeEarned: Math.min(7000, earned), shieldIds: [] };
  },
};

/** EUA T2 (2024), na ordem da exibição; o caminho final é a última missão. */
export const US_SEASON_2_MISSIONS: readonly MissionDefinition[] = [beacon, scarecrows, cemetery, funeral, birdCalls, catapult, bog(US, 25000, true), tunnels, crossbows, scales];
export const US_SEASON_2_FINALE = finalPath;

/** Reino Unido T2 (2024), na ordem da exibição. */
export const UK_SEASON_2_MISSIONS: readonly MissionDefinition[] = [
  variant(beacon, { origin: UK, prizeAvailable: 15000 }),
  variant(birdCalls, { origin: UK, prizeAvailable: 6000 }),
  variant(scarecrows, { origin: UK, prizeAvailable: 10000 }),
  dungeon,
  variant(catapult, { origin: UK, prizeAvailable: 10000 }),
  variant(cemetery, { origin: UK, prizeAvailable: 10000 }),
  variant(funeral, { origin: UK, prizeAvailable: 7000 }),
  variant(crossbows, { origin: UK, prizeAvailable: 7000 }),
  variant(tunnels, { origin: UK, prizeAvailable: 8000 }),
  { ...bog(UK, 10000, false), name: 'O Percurso da Floresta' },
  monument,
];
export const UK_SEASON_2_FINALE = variant(finalPath, {
  origin: UK,
  prizeAvailable: 20000,
  name: 'As Bandeiras do Barco',
  description: 'Os finalistas seguem a trilha erguendo bandeiras até o barco em 60 minutos; desvios pelo caminho escondem bandeiras extras que valem bônus.',
});
