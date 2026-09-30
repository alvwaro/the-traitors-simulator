import { chance } from '../random';
import { isTraitor, SimPlayer } from '../traits';
import { tokenList } from '../tokens';
import { MissionContext, MissionDefinition } from './MissionContext';
import { byInfluence, pair, roundMoney, top } from './helpers';

/**
 * Missões da 4ª temporada americana de The Traitors (2026), na ordem da exibição. Valores em dólar.
 * A temporada mexe muito com quem pode ser assassinado: caixões nas covas, caveiras no pântano e a
 * pergunta final das caixas deixam só uma lista de nomes para os Traidores; na fonte, se ninguém
 * pegar escudo, não há assassinato. Cada prova tem imprevistos sorteados: pode render tudo ou nada.
 */

const US = 'EUA T4';
const STEP = 500;

/** Opções de escolha que são pessoas (a tela mostra nome e retrato). */
const personOptions = (players: readonly SimPlayer[]) => players.map((p) => ({ id: p.id, label: '', playerId: p.id }));

/** Quem o grupo tende a sacrificar: pouco querido, pouco confiável. */
const expendable = (ctx: MissionContext) => (p: SimPlayer) => (100 - ctx.popularity(p)) ** 1.5 + 5;

const fight = (ctx: MissionContext, a: SimPlayer, b: SimPlayer) => {
  ctx.matrix.adjust(a.id, b.id, { hatred: 6, liking: -4 });
  ctx.matrix.adjust(b.id, a.id, { hatred: 6, liking: -4 });
};

// ---------------------------------------------------------------------------------------------
// Episódio 1 · Os caixões do lago
// ---------------------------------------------------------------------------------------------

const lochCoffins: MissionDefinition = {
  key: 'loch-coffins',
  origin: US,
  name: 'Os Caixões do Lago',
  description:
    'Três grupos entram num lago com cem caixões boiando; só doze guardam ouro. Cada caixão de ouro arrastado até o cemitério vale dinheiro, mas precisa ser enterrado na cova de um dos jogadores. ' +
    'Esta noite, só quem tiver um caixão na própria cova pode ser assassinado(a).',
  prizeAvailable: 30000,
  play(ctx) {
    const GOLD = 12;
    const per = 30000 / GOLD;
    const clock = ctx.clock(45);
    const teams = ctx.teams(3).filter((t) => t.length);
    ctx.say('Cem caixões boiam no lago escuro. Doze têm ouro; o cemitério espera, com uma cova aberta para cada jogador.');
    const graves = new Map<string, number>();
    let found = 0;
    let earned = 0;
    let humanAsked = false;

    for (let round = 0; found < GOLD && !clock.over; round++) {
      const team = teams[round % teams.length];
      const opener = ctx.pick(1, (p) => p.traits.skill + p.traits.insight * 0.5, team)[0];
      if (!clock.spend(3 + ctx.rng() * 4)) break;
      if (!ctx.attempt(opener, 55, team)) {
        if (ctx.happens(0.15)) ctx.say('{user} abriu mais um caixão: vazio, só água gelada e lodo.', [opener]);
        continue;
      }
      found++;
      // Arrastar o caixão pela lama até o cemitério.
      const carriers = team.slice(0, 4);
      if (!clock.spend(2 + ctx.rng() * 3 - carriers.reduce((s, p) => s + p.traits.skill - 50, 0) / 120)) break;
      if (ctx.happens(0.12)) {
        const [a, b] = ctx.pick(2, () => 1, carriers);
        if (a && b) {
          fight(ctx, a, b);
          ctx.say('O caixão escorregou na lama. {user} e {user1} se culparam aos gritos e perderam minutos preciosos.', [a, b]);
          clock.spend(3);
        }
      }
      earned += per;

      // Em qual cova o caixão vai: o jogador decide uma vez; os outros empurram para os menos queridos.
      const human = team.find((p) => ctx.isHuman(p));
      let grave: SimPlayer;
      if (human && !humanAsked) {
        humanAsked = true;
        grave = ctx.askPerson(
          { id: 'coffins-grave', prompt: `Seu grupo tirou um caixão com ouro do lago (${ctx.money(per)}). Ele precisa ir para a cova de alguém, e só quem tiver caixão na cova pode ser assassinado(a) esta noite. Em qual cova você coloca?`, playerIds: [] },
          ctx.players,
        );
      } else {
        // Caixões se acumulam: o grupo prefere repetir covas a pôr mais gente em risco.
        grave = ctx.pick(1, (p) => expendable(ctx)(p) * (graves.has(p.id) ? 2.5 : 1) * (team.includes(p) ? 0.4 : 1))[0];
      }
      const leader = byInfluence(team);
      graves.set(grave.id, (graves.get(grave.id) ?? 0) + 1);
      if (grave.id !== leader.id) ctx.matrix.adjust(grave.id, leader.id, { hatred: 4, trust: -3 }, 0.6 + grave.traits.volatility / 100);
      ctx.say(
        graves.get(grave.id)! > 1 ? 'Mais um caixão na cova de {user}. O grupo de {user1} nem hesitou.' : 'O grupo de {user1} baixou o caixão na cova de {user}.',
        pair(grave, leader),
      );
      if (found === 4) ctx.chatter(1);
    }

    if (clock.over) ctx.say(`O sino tocou: fim do tempo com ${found} de ${GOLD} caixões de ouro no cemitério.`);
    else ctx.say('Os doze caixões de ouro estão no cemitério.');
    const marked = ctx.players.filter((p) => graves.has(p.id));
    if (marked.length) {
      ctx.twists.dungeonIds = marked.map((p) => p.id);
      ctx.say(`Covas ocupadas: ${tokenList(marked.length)}. Só eles podem ser assassinados esta noite.`, marked);
    }
    ctx.chatter(1);
    return { prizeEarned: roundMoney(earned, STEP), shieldIds: [] };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 2 · A conga da morte (os tronos)
// ---------------------------------------------------------------------------------------------

const thrones: MissionDefinition = {
  key: 'thrones',
  origin: US,
  name: 'A Conga da Morte',
  description:
    'Três tronos sobre rodas precisam voltar ao castelo em 45 minutos, empurrados pelo grupo, com um jogador sentado em cada. Em três paradas há ouro e duas fichas de escudo: quem acha uma ficha pode tomar o lugar de alguém no trono. ' +
    'Quem estiver sentado quando os tronos chegarem a tempo ganha escudo.',
  prizeAvailable: 24000,
  play(ctx) {
    const clock = ctx.clock(45);
    const seats = ctx.pick(Math.min(3, ctx.players.length - 1), (p) => p.traits.influence + ctx.popularity(p) + 10);
    ctx.say(`${tokenList(seats.length)} sobem nos tronos. O resto empurra, colina acima, rumo ao castelo.`, seats);
    let earned = 0;
    for (let stop = 1; stop <= 3; stop++) {
      const pushers = ctx.players.filter((p) => !seats.includes(p));
      const strength = pushers.reduce((s, p) => s + p.traits.skill, 0) / Math.max(1, pushers.length);
      let minutes = 11 + ctx.rng() * 5 - (strength - 50) / 12;
      if (ctx.happens(0.25)) {
        const a = ctx.oneOf(pushers);
        ctx.say('Uma roda do trono atolou na lama. {user} fez força até o rosto ficar roxo.', [a]);
        minutes += 3;
      }
      if (stop === 2 && ctx.happens(0.4)) {
        const dancer = top(ctx.players, (p) => p.traits.sociability + ctx.rng() * 40, 1)[0];
        ctx.applaud(dancer, 2);
        ctx.say('{user} puxou uma conga para animar o grupo. Metade riu, metade achou perda de tempo.', [dancer]);
      }
      clock.spend(minutes);
      // O ouro da parada: quem procura bem acha mais.
      const searchers = ctx.pick(Math.min(4, pushers.length), (p) => p.traits.skill + p.traits.insight, pushers);
      const hits = searchers.filter((p) => ctx.attempt(p, 50, searchers)).length;
      const gold = roundMoney(8000 * Math.min(1, 0.4 + hits * 0.2), STEP);
      earned += gold;
      ctx.say(`Parada ${stop}: ${ctx.money(gold)} em ouro vão para os tronos.`);

      // As duas fichas de escudo: quem acha pode trocar de lugar com alguém sentado.
      for (let t = 0; t < 2 && pushers.length; t++) {
        const finder = ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.4 + 10, pushers.filter((p) => !seats.includes(p)))[0];
        if (!finder || !ctx.attempt(finder, 45)) continue;
        let victim: SimPlayer | undefined;
        if (ctx.isHuman(finder)) {
          const choice = ctx.ask({
            id: 'thrones-token',
            prompt: `Você achou uma ficha de escudo na parada ${stop}! Escolha quem tirar do trono para sentar no lugar (quem sair fica sem proteção e não esquece), ou guarde a ficha.`,
            playerIds: [],
            options: [...personOptions(seats), { id: 'keep', label: 'Guardar a ficha e continuar empurrando' }],
          });
          victim = seats.find((s) => s.id === choice);
        } else {
          const wants = finder.traits.aggression + finder.traits.paranoia - finder.traits.loyalty + (isTraitor(finder) ? 10 : 0);
          if (chance(ctx.rng, Math.max(0.15, Math.min(0.9, 0.45 + wants / 200)))) {
            victim = top(seats, (s) => ctx.matrix.get(finder.id, s.id).hatred - ctx.matrix.get(finder.id, s.id).liking + ctx.rng() * 30, 1)[0];
          }
        }
        if (!victim) {
          ctx.applaud(finder, 2);
          ctx.say('{user} achou uma ficha de escudo e deixou os tronos como estavam.', [finder]);
          continue;
        }
        seats.splice(seats.indexOf(victim), 1, finder);
        ctx.matrix.adjust(victim.id, finder.id, { hatred: 10, trust: -6, liking: -5 });
        ctx.say('{user} achou uma ficha de escudo e mandou {user1} descer do trono.', [finder, victim]);
      }
      if (stop === 1) ctx.chatter(1);
    }
    if (clock.over) {
      ctx.say(`Os tronos chegaram ${clock.elapsed - clock.limit} minuto(s) atrasados. Nenhum escudo, e só o ouro das paradas conta.`);
      ctx.chatter(1);
      return { prizeEarned: roundMoney(earned * 0.5, STEP), shieldIds: [] };
    }
    ctx.shield(`Com ${clock.left} minuto(s) de sobra, os tronos cruzam o portão: ${tokenList(seats.length)} ganham escudo.`, seats);
    ctx.chatter(1);
    return { prizeEarned: Math.min(24000, earned), shieldIds: seats.map((p) => p.id) };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 3 · As caveiras do pântano
// ---------------------------------------------------------------------------------------------

const marshSkulls: MissionDefinition = {
  key: 'marsh-skulls',
  origin: US,
  name: 'As Caveiras do Pântano',
  description:
    'Em duplas, um fica preso numa jaula e o outro vasculha o pântano atrás das dez caveiras escondidas. Cada caveira empilhada liberta uma jaula e vale dinheiro. ' +
    'Quem continuar enjaulado(a) no fim entra na lista dos que podem ser assassinados esta noite.',
  prizeAvailable: 45000,
  play(ctx) {
    const SKULLS = 10;
    const per = 45000 / SKULLS;
    const clock = ctx.clock(40);
    const pairs = ctx.pairs(SKULLS);
    ctx.say(`${pairs.length} duplas. Dez caveiras no pântano, e o relógio já corre.`);
    const caged: SimPlayer[] = [];
    const locked: SimPlayer[] = [];
    let skulls = 0;
    for (const [a, b] of pairs) {
      // Quem entra na jaula: o jogador decide; nas outras duplas, vai o menos habilidoso.
      const human = [a, b].find((p) => ctx.isHuman(p));
      let prisoner: SimPlayer;
      if (human) {
        const partner = human === a ? b : a;
        const choice = ctx.ask({
          id: 'skulls-cage',
          prompt: 'Sua dupla precisa decidir: um entra na jaula e o outro procura as caveiras no pântano. Se a caveira não aparecer, quem está na jaula entra na lista do assassinato. Quem fica preso(a)?',
          playerIds: [partner.id],
          options: [
            { id: 'me', label: 'Eu entro na jaula' },
            { id: 'partner', label: '{user} entra na jaula' },
          ],
        });
        prisoner = choice === 'me' ? human : partner;
      } else {
        prisoner = a.traits.skill <= b.traits.skill ? a : b;
      }
      caged.push(prisoner);
    }
    for (const [i, [a, b]] of pairs.entries()) {
      const prisoner = caged[i];
      const searcher = prisoner === a ? b : a;
      const inTime = clock.spend(2 + ctx.rng() * 4 - (searcher.traits.skill - 50) / 40);
      if (!inTime || skulls >= SKULLS) {
        locked.push(prisoner);
        ctx.say('{user} ainda revirava o lodo quando a buzina tocou. {user1} continua na jaula.', [searcher, prisoner]);
        continue;
      }
      if (ctx.happens(0.1)) {
        ctx.say('{user} afundou até a cintura no pântano e precisou ser puxado(a) por outra dupla.', [searcher]);
        clock.spend(3);
      }
      if (ctx.attempt(searcher, 55)) {
        skulls++;
        ctx.matrix.adjust(prisoner.id, searcher.id, { liking: 8, trust: 6 });
        ctx.say('{user} voltou coberto(a) de lama com uma caveira nas mãos. A jaula de {user1} se abriu.', [searcher, prisoner]);
      } else {
        locked.push(prisoner);
        ctx.matrix.adjust(prisoner.id, searcher.id, { trust: -4, hatred: 3 }, 0.6 + prisoner.traits.volatility / 100);
        ctx.say('{user} não achou caveira nenhuma. {user1} ficou olhando pelas grades.', [searcher, prisoner]);
      }
    }
    ctx.chatter(1);
    if (locked.length) {
      ctx.twists.dungeonIds = locked.map((p) => p.id);
      ctx.say(`Continuam nas jaulas: ${tokenList(locked.length)}. Esta noite, os Traidores só podem escolher entre eles.`, locked);
    } else {
      ctx.say('Todas as jaulas se abriram. Os Traidores podem escolher qualquer um.');
    }
    return { prizeEarned: roundMoney(skulls * per, STEP), shieldIds: [] };
  },
};


// ---------------------------------------------------------------------------------------------
// Episódio 4 · As lanças de fogo
// ---------------------------------------------------------------------------------------------

const effigies: MissionDefinition = {
  key: 'effigies',
  origin: US,
  name: 'As Lanças de Fogo',
  description:
    'Como guerreiros celtas, as equipes procuram na floresta lanças de fogo para acender dez efígies gigantes; cada efígie acesa vale dinheiro. Cada lança vem presa ao escudo de um jogador, ' +
    'e acender a efígie queima aquele escudo. Quem terminar com o escudo inteiro fica protegido(a) esta noite.',
  prizeAvailable: 20000,
  play(ctx) {
    const EFFIGIES = 10;
    const per = 20000 / EFFIGIES;
    const clock = ctx.clock(50);
    // Cada jogador começa com um escudo; as lanças espalhadas pela floresta carregam esses escudos.
    const intact = new Set(ctx.players.map((p) => p.id));
    const teams = ctx.teams(2).filter((t) => t.length);
    ctx.say(`Dez efígies de palha esperam o fogo. ${ctx.players.length} escudos pendurados em lanças pela floresta, um com o nome de cada jogador.`);
    let lit = 0;
    let humanAsked = false;
    for (let i = 0; i < EFFIGIES; i++) {
      const team = teams[i % teams.length];
      const runner = ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.3, team)[0];
      if (!clock.spend(3 + ctx.rng() * 3 - (runner.traits.skill - 50) / 30)) {
        ctx.say(`O tempo acabou com ${EFFIGIES - lit} efígie(s) apagada(s).`);
        break;
      }
      const available = ctx.players.filter((p) => intact.has(p.id));
      if (!available.length) break;
      // De quem é o escudo que vai queimar nesta lança: a equipe escolhe (o jogador, uma vez).
      const human = team.find((p) => ctx.isHuman(p));
      let burned: SimPlayer | undefined;
      if (human && !humanAsked) {
        humanAsked = true;
        const choice = ctx.ask({
          id: 'effigies-lance',
          prompt: `Sua equipe achou uma lança. Para acender a efígie (${ctx.money(per)}), o escudo preso a ela vai queimar. Qual escudo vocês usam?`,
          playerIds: [],
          options: [...personOptions(available), { id: 'skip', label: 'Não queimar ninguém e deixar esta efígie apagada' }],
        });
        burned = available.find((p) => p.id === choice);
      } else {
        burned = ctx.pick(1, (p) => expendable(ctx)(p) * (team.includes(p) ? 0.5 : 1), available)[0];
      }
      if (!burned) {
        ctx.say('A equipe de {user} preferiu não queimar escudo de ninguém. A efígie ficou apagada.', [human ?? runner]);
        continue;
      }
      if (!ctx.attempt(runner, 40, team)) {
        ctx.say('{user} tropeçou com a lança e a chama apagou antes de chegar à efígie.', [runner]);
        continue;
      }
      intact.delete(burned.id);
      lit++;
      if (burned !== runner) ctx.matrix.adjust(burned.id, byInfluence(team).id, { hatred: 5, trust: -4 }, 0.6 + burned.traits.volatility / 100);
      ctx.say('{user} encostou a lança na efígie e ela subiu em chamas, levando junto o escudo de {user1}.', pair(runner, burned));
      if (i === 4) ctx.chatter(1);
    }
    const kept = ctx.players.filter((p) => intact.has(p.id));
    ctx.chatter(1);
    if (kept.length) ctx.shield(`Escudos que sobreviveram ao fogo: ${tokenList(kept.length)}.`, kept);
    return { prizeEarned: roundMoney(lit * per, STEP), shieldIds: kept.map((p) => p.id) };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 5 · A fonte das estátuas
// ---------------------------------------------------------------------------------------------

const fountain: MissionDefinition = {
  key: 'fountain',
  origin: US,
  name: 'A Fonte das Estátuas',
  description:
    'As moedas pescadas na fonte revelam onde estão oito estátuas; cada uma trazida de volta vale dinheiro. Debaixo das estátuas há escudos, e cada um decide em segredo se pega. ' +
    'Se ninguém pegar nenhum, não há assassinato esta noite; basta um escudo pego para a torre abrir.',
  prizeAvailable: 16000,
  play(ctx) {
    const STATUES = 8;
    const per = 16000 / STATUES;
    const clock = ctx.clock(45);
    const teams = ctx.teams(Math.max(1, Math.min(4, Math.floor(ctx.players.length / 3)))).filter((t) => t.length);
    ctx.say('A fonte do castelo secou: faltam oito estátuas. As moedas no fundo dizem onde cada uma foi parar.');
    let restored = 0;
    const takers: SimPlayer[] = [];
    const tempted = new Set<string>();
    for (let i = 0; i < STATUES; i++) {
      const team = teams[i % teams.length];
      const fisher = ctx.pick(1, (p) => p.traits.insight + p.traits.skill * 0.5, team)[0];
      if (!clock.spend(4 + ctx.rng() * 3)) {
        ctx.say(`A buzina tocou com ${STATUES - restored} estátua(s) fora da fonte.`);
        break;
      }
      if (!ctx.attempt(fisher, 45, team)) {
        ctx.say('A moeda de {user} levou a equipe ao lugar errado. Estátua nenhuma.', [fisher]);
        continue;
      }
      restored++;
      ctx.say('A equipe de {user} voltou com mais uma estátua e a água da fonte subiu um pouco.', [fisher]);

      // Os escudos debaixo da estátua: cada um da equipe decide sozinho, uma vez.
      for (const p of team) {
        if (tempted.has(p.id)) continue;
        tempted.add(p.id);
        let takes: boolean;
        if (ctx.isHuman(p)) {
          takes =
            ctx.ask({
              id: 'fountain-shield',
              prompt: 'Debaixo da estátua há um escudo. Se ninguém do castelo pegar escudo nenhum, não haverá assassinato esta noite; se você pegar, fica protegido(a), mas a torre abre para os outros. Ninguém vai saber o que você fez.',
              playerIds: [],
              options: [
                { id: 'leave', label: 'Deixar o escudo onde está' },
                { id: 'take', label: 'Pegar o escudo em segredo' },
              ],
            }) === 'take';
        } else {
          const selfish = (p.traits.paranoia + (100 - p.traits.loyalty) + p.traits.deception * 0.5) / 250;
          takes = chance(ctx.rng, Math.max(0.01, Math.min(0.5, selfish * 0.1 + (isTraitor(p) ? 0.03 : 0))));
        }
        if (takes) {
          takers.push(p);
          ctx.shieldSecret('{user} olhou para os lados e enfiou um escudo por baixo do casaco.', [p]);
        }
      }
    }
    ctx.chatter(1);
    if (takers.length) {
      ctx.say('No jantar, a notícia: alguém pegou escudo. A torre vai abrir esta noite, e ninguém sabe quem foi.');
      ctx.shield(`Protegidos esta noite, sem ninguém saber: ${tokenList(takers.length)}.`, takers);
    } else {
      ctx.twists.noMurderTonight = true;
      for (const p of ctx.players) for (const q of ctx.players) if (p !== q) ctx.matrix.adjust(p.id, q.id, { trust: 1 });
      ctx.say('Nenhum escudo foi tocado. O castelo inteiro abriu mão da proteção: esta noite, ninguém morre.');
    }
    return { prizeEarned: roundMoney(restored * per, STEP), shieldIds: takers.map((p) => p.id) };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 6 · A cabana na floresta
// ---------------------------------------------------------------------------------------------

const cabin: MissionDefinition = {
  key: 'cabin',
  origin: US,
  name: 'A Cabana na Floresta',
  description:
    'Numa cabana abandonada, cada dupla recebe pistas que levam a um nome. Com o nome certo, a dupla corre ao cemitério e acha a lápide correspondente: cada lápide vale dinheiro. ' +
    'Em vez disso, a dupla pode largar a lápide e procurar escudos pela floresta, abrindo mão do dinheiro dela.',
  prizeAvailable: 18000,
  play(ctx) {
    const pairs = ctx.pairs(6);
    const per = 18000 / 6;
    ctx.say(`Uma cabana caindo aos pedaços no meio da floresta. ${pairs.length} dupla(s), um baú de pistas para cada uma.`);
    let earned = 0;
    const shielded: SimPlayer[] = [];
    for (const [a, b] of pairs) {
      const human = [a, b].find((p) => ctx.isHuman(p));
      let hunt: boolean;
      if (human) {
        const partner = human === a ? b : a;
        hunt =
          ctx.ask({
            id: 'cabin-choice',
            prompt: `Você e {user} decifraram as pistas. Vocês podem buscar a lápide (${ctx.money(per)} para o prêmio) ou largar o dinheiro e procurar escudos na floresta. O que você propõe?`,
            playerIds: [partner.id],
            options: [
              { id: 'grave', label: 'Buscar a lápide (dinheiro para o grupo)' },
              { id: 'shield', label: 'Procurar escudos na floresta' },
            ],
          }) === 'shield';
      } else {
        const want = (a.traits.paranoia + b.traits.paranoia - a.traits.loyalty - b.traits.loyalty) / 400;
        hunt = chance(ctx.rng, Math.max(0.02, Math.min(0.35, 0.08 + want)));
      }
      if (hunt) {
        for (const p of ctx.players) if (p !== a && p !== b) ctx.matrix.adjust(p.id, a.id, { trust: -2 }, 0.5);
        const found = [a, b].filter((p) => ctx.attempt(p, 60, [a, b]));
        shielded.push(...found);
        ctx.say(
          found.length
            ? '{user} e {user1} largaram as pistas e foram atrás de escudo. Voltaram com a proteção e com olhares tortos do grupo.'
            : '{user} e {user1} trocaram o dinheiro por escudo e voltaram de mãos vazias.',
          [a, b],
        );
        continue;
      }
      const reader = a.traits.insight >= b.traits.insight ? a : b;
      if (!ctx.attempt(reader, 45, [a, b])) {
        ctx.say('As pistas de {user} e {user1} levaram ao nome errado. Lápide nenhuma, dinheiro nenhum.', [a, b]);
        continue;
      }
      earned += per;
      ctx.say('{user} e {user1} acharam o nome na lápide certa, coberta de musgo.', [a, b]);
    }
    ctx.chatter(2);
    if (shielded.length) ctx.shield(`Escudos achados na floresta: ${tokenList(shielded.length)}.`, shielded);
    else ctx.say('Ninguém foi atrás de escudo: todo o dinheiro possível foi para o prêmio.');
    return { prizeEarned: roundMoney(earned, STEP), shieldIds: shielded.map((p) => p.id) };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 7 · As urnas de ouro e o punhal
// ---------------------------------------------------------------------------------------------

const urns: MissionDefinition = {
  key: 'urns',
  origin: US,
  name: 'As Urnas e o Punhal',
  description:
    'Cada jogador recebe pedras de ouro para quebrar urnas cheias de dinheiro, mas cada pedra gasta é uma a menos na disputa pelo punhal. Pedras também podem ser dadas a outros. ' +
    'Os que terminam com mais pedras disputam o punhal: quem tem mais interroga os outros e tenta adivinhar qual tabuleta esconde a arma. ' +
    'No simulador, o punhal rende respeito e medo no castelo; o voto duplo não é aplicado.',
  prizeAvailable: 25000,
  play(ctx) {
    const stones = new Map(ctx.players.map((p) => [p.id, 3]));
    const URNS = 10;
    const per = 25000 / URNS;
    let earned = 0;
    let urnsLeft = URNS;
    ctx.say('Dez urnas no salão, três pedras de ouro na mão de cada um. Quebrar urnas enche o prêmio; guardar pedras aproxima do punhal.');
    for (const p of ctx.players) {
      if (urnsLeft <= 0) break;
      let throws: number;
      if (ctx.isHuman(p)) {
        throws = Number(
          ctx.ask({
            id: 'urns-throw',
            prompt: `Você tem 3 pedras. Cada urna quebrada vale até ${ctx.money(per)}; quem guardar mais pedras disputa o punhal. Quantas você joga?`,
            playerIds: [],
            options: [
              { id: '0', label: 'Nenhuma: guardo todas para o punhal' },
              { id: '1', label: 'Uma' },
              { id: '2', label: 'Duas' },
              { id: '3', label: 'Todas: o prêmio vem primeiro' },
            ],
          }),
        );
      } else {
        const ambition = p.traits.aggression + p.traits.influence - p.traits.loyalty;
        throws = Math.max(0, Math.min(3, Math.round(1.5 - ambition / 80 + (ctx.rng() - 0.5) * 1.5)));
      }
      for (let t = 0; t < throws && urnsLeft > 0; t++) {
        stones.set(p.id, stones.get(p.id)! - 1);
        if (ctx.attempt(p, 50)) {
          urnsLeft--;
          earned += per * (0.6 + ctx.rng() * 0.4);
        }
      }
      if (throws === 0) {
        for (const o of ctx.players) if (o !== p) ctx.matrix.adjust(o.id, p.id, { trust: -1 }, 0.4 + o.traits.paranoia / 100);
      }
    }
    // Presentes: aliados passam pedras a quem querem ver com o punhal.
    for (const giver of ctx.players) {
      if (ctx.isHuman(giver) || (stones.get(giver.id) ?? 0) === 0 || !ctx.happens(0.2)) continue;
      const friend = top(ctx.players.filter((q) => q !== giver), (q) => ctx.matrix.get(giver.id, q.id).liking + ctx.rng() * 20, 1)[0];
      if (!friend) continue;
      stones.set(giver.id, stones.get(giver.id)! - 1);
      stones.set(friend.id, stones.get(friend.id)! + 1);
      ctx.matrix.adjust(friend.id, giver.id, { liking: 5, trust: 4 });
      ctx.say('{user} passou uma pedra de ouro para {user1}, sem explicar muito.', [giver, friend]);
    }
    ctx.say(`${URNS - urnsLeft} urna(s) quebrada(s). Agora, o punhal.`);
    const contenders = top(ctx.players, (p) => (stones.get(p.id) ?? 0) * 100 + ctx.rng() * 50, Math.min(6, ctx.players.length));
    const leader = contenders[0];
    const suspects = contenders.filter((p) => p !== leader);
    let holder = leader;
    if (suspects.length) {
      const hidden = ctx.oneOf(suspects);
      ctx.say(`Na disputa pelo punhal: ${tokenList(contenders.length)}. Quem tem mais pedras interroga os outros.`, contenders);
      const guess = ctx.isHuman(leader)
        ? ctx.askPerson({ id: 'urns-dagger', prompt: 'Você tem mais pedras. Depois do interrogatório, quem você acha que está com a tabuleta do punhal?', playerIds: [] }, suspects)
        : chance(ctx.rng, Math.min(0.8, 0.3 + leader.traits.insight / 200))
          ? hidden
          : ctx.oneOf(suspects);
      if (guess === hidden) {
        ctx.say('{user} leu o rosto de {user1} e acertou: tomou o punhal para si.', [leader, hidden]);
      } else {
        holder = hidden;
        ctx.say('{user} apontou a tabuleta errada. O punhal ficou com {user1}.', [leader, hidden]);
      }
    }
    for (const o of ctx.players) if (o !== holder) ctx.matrix.adjust(o.id, holder.id, { trust: -2, hatred: 1 }, 0.5 + o.traits.paranoia / 100);
    ctx.secret('{user} guarda o punhal de ouro.', [holder]);
    ctx.chatter(1);
    return { prizeEarned: roundMoney(earned, STEP), shieldIds: [] };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 8 · Os quadros vivos
// ---------------------------------------------------------------------------------------------

const PAINTINGS = ['o camponês com a vaca', 'a rainha no trono', 'o banquete dos lordes', 'o cavaleiro caído', 'as lavadeiras no rio', 'a caçada ao cervo'] as const;

const tableaux: MissionDefinition = {
  key: 'tableaux',
  origin: US,
  name: 'Os Quadros Vivos',
  description:
    'Dois grupos recriam, só pela descrição, pinturas famosas usando o próprio corpo como modelo. No armazém, o terceiro grupo recebe as fotos e precisa achar o quadro original de cada uma; cada acerto vale dinheiro. ' +
    'A melhor pose do dia ganha escudo.',
  prizeAvailable: 18000,
  play(ctx) {
    const [warehouse, ...posers] = ctx.teams(3).filter((t) => t.length);
    const ROUNDS = PAINTINGS.length;
    const per = 18000 / ROUNDS;
    ctx.say(`Figurinos, perucas e a descrição de cada quadro. No armazém, ${tokenList(warehouse.length)} esperam as fotos.`, warehouse);
    let earned = 0;
    let humanAsked = 0;
    const scores = new Map<string, number>();
    for (const [r, painting] of PAINTINGS.entries()) {
      const group = posers.length ? posers[r % posers.length] : warehouse;
      const model = ctx.pick(1, (p) => p.traits.sociability + p.traits.skill * 0.5, group)[0];
      const pose = ctx.attempt(model, 45, group);
      scores.set(model.id, (scores.get(model.id) ?? 0) + (pose ? 2 : 0) + ctx.rng());
      if (pose && ctx.happens(0.3)) {
        ctx.applaud(model, 3);
        ctx.say(`{user} virou ${painting} com uma perfeição que fez o grupo inteiro rir.`, [model]);
      }
      const human = warehouse.find((p) => ctx.isHuman(p));
      let right: boolean;
      if (human && humanAsked < 2) {
        humanAsked++;
        const options = [painting, ...PAINTINGS.filter((x) => x !== painting).slice(0, 2)].sort(() => ctx.rng() - 0.5);
        const answer = ctx.ask({
          id: 'tableaux-match',
          prompt: `Chegou a foto de {user} fantasiado(a). ${pose ? 'A pose ficou clara.' : 'A pose ficou confusa.'} Qual é o quadro original?`,
          playerIds: [model.id],
          options: options.map((x) => ({ id: x, label: x[0].toUpperCase() + x.slice(1) })),
        });
        right = answer === painting && (pose || ctx.happens(0.4));
      } else {
        const judge = ctx.pick(1, (p) => p.traits.insight + 10, warehouse)[0];
        right = ctx.attempt(judge, pose ? 35 : 75, warehouse);
      }
      if (right) {
        earned += per;
        ctx.say(`O armazém reconheceu ${painting} na foto de {user}.`, [model]);
      } else {
        ctx.say(`Ninguém no armazém reconheceu ${painting} na pose de {user}.`, [model]);
      }
    }
    ctx.chatter(1);
    const best = top(ctx.players.filter((p) => scores.has(p.id)), (p) => scores.get(p.id)!, 1)[0];
    if (best) ctx.shield('A pose de {user} foi a melhor do dia: escudo.', [best]);
    return { prizeEarned: roundMoney(earned, STEP), shieldIds: best ? [best.id] : [] };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 9 · Pense fora da caixa
// ---------------------------------------------------------------------------------------------

const QUESTIONS = [
  'Quem é o jogador mais perigoso do castelo?',
  'Quem ganharia um concurso de mentiras?',
  'Em quem o castelo confia demais?',
  'Quem chora primeiro numa mesa redonda?',
  'Quem os Traidores gostariam de recrutar?',
] as const;

const jackBoxes: MissionDefinition = {
  key: 'jack-boxes',
  origin: US,
  name: 'Pense Fora da Caixa',
  description:
    'Cada jogador fica trancado numa caixa gigante. A cada pergunta, os Fiéis tentam adivinhar quem os Traidores escolheram como resposta; os Traidores saem escondidos das caixas, combinam a resposta e voltam. ' +
    'Cada Fiel que acerta vale dinheiro. A última pergunta é quem os Traidores querem na lista do assassinato: os quatro nomes são os únicos que podem morrer esta noite.',
  prizeAvailable: 18000,
  play(ctx) {
    const traitors = ctx.traitors;
    const faithful = ctx.players.filter((p) => !isTraitor(p));
    const perHit = roundMoney(18000 / QUESTIONS.length / Math.max(1, faithful.length), 50);
    ctx.say('As tampas se fecham. Dentro das caixas, escuridão e a voz do anfitrião fazendo as perguntas.');
    const humanTraitor = traitors.find((t) => ctx.isHuman(t));
    // Traidores podem sabotar: respondem sempre o mesmo nome para confundir e não dar dinheiro.
    const decoy = faithful.length ? top(faithful, (p) => ctx.popularity(p) + ctx.rng() * 30, 1)[0] : undefined;
    const sabotage = !humanTraitor && !!decoy && traitors.length > 0 && chance(ctx.rng, 0.5);
    let earned = 0;
    for (const [i, question] of QUESTIONS.entries()) {
      if (!traitors.length || !faithful.length) break;
      let answer: SimPlayer;
      if (humanTraitor) {
        answer = ctx.askPerson(
          { id: 'boxes-traitor-answer', prompt: `Você saiu escondido(a) da caixa. Pergunta: "${question}" Qual nome os Traidores respondem? Um nome óbvio dá dinheiro aos Fiéis; um estranho confunde.`, playerIds: [] },
          faithful,
        );
      } else if (sabotage && decoy) {
        answer = decoy;
      } else {
        answer = top(faithful, (p) => 100 - ctx.popularity(p) + ctx.rng() * 40, 1)[0];
      }
      if (ctx.happens(0.08)) {
        const clumsy = ctx.oneOf(traitors);
        for (const f of faithful) ctx.matrix.adjust(f.id, clumsy.id, { trust: -3 }, 0.5 + f.traits.insight / 100);
        ctx.say('Um rangido no meio do salão: a tampa de uma caixa bateu na volta. {user} jura que não foi a dele(a).', [clumsy]);
      }
      let hits = 0;
      for (const f of faithful) {
        const others = ctx.players.filter((p) => p !== f);
        const guess = ctx.isHuman(f)
          ? ctx.askPerson({ id: 'boxes-guess', prompt: `Pergunta ${i + 1}: "${question}" Quem você acha que os Traidores responderam?`, playerIds: [] }, others)
          : chance(ctx.rng, 0.15 + f.traits.insight / 400)
            ? answer
            : ctx.oneOf(others);
        if (guess === answer) hits++;
      }
      earned += hits * perHit;
      ctx.say(`"${question}" Os Traidores responderam {user}. ${hits} Fiel(is) acertaram.`, [answer]);
    }
    if (sabotage && decoy) ctx.secret('Os Traidores combinaram responder {user} em todas as perguntas: menos dinheiro, mais confusão.', [decoy]);
    // A pergunta final: a lista do assassinato.
    const shortlist = traitors.length ? top(faithful, (p) => 100 - ctx.popularity(p) + ctx.rng() * 50, Math.min(4, faithful.length)) : [];
    if (shortlist.length) {
      ctx.twists.dungeonIds = shortlist.map((p) => p.id);
      ctx.say(`A última pergunta: quem os Traidores querem na lista do assassinato? Os nomes: ${tokenList(shortlist.length)}.`, shortlist);
    }
    ctx.chatter(1);
    return { prizeEarned: Math.min(18000, roundMoney(earned, STEP)), shieldIds: [] };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 10 · O parque de diversões
// ---------------------------------------------------------------------------------------------

const STALLS = ['a barraca de argolas', 'o tiro ao alvo', 'o martelo de força', 'a pescaria de patinhos'] as const;

const fairground: MissionDefinition = {
  key: 'fairground',
  origin: US,
  name: 'O Parque de Diversões',
  description:
    'Um parque de diversões abandonado. Os jogadores correm pelas barracas ganhando bichos de pelúcia; dentro de alguns há sacos de ouro. Quem não voltar ao carrossel antes da música parar fica fora da disputa pelo escudo. ' +
    'No carrossel, uma última prova dá um único escudo.',
  prizeAvailable: 30000,
  play(ctx) {
    const SATCHELS = 12;
    const per = 30000 / SATCHELS;
    let satchels = 0;
    const back: SimPlayer[] = [];
    ctx.say('Luzes piscando, música de carrossel desafinada e doze sacos de ouro escondidos entre as pelúcias.');
    for (const p of ctx.players) {
      const stall = ctx.oneOf(STALLS);
      let tries = 1 + Math.floor(ctx.rng() * 3);
      if (ctx.isHuman(p)) {
        const choice = ctx.ask({
          id: 'fairground-run',
          prompt: 'A música do carrossel já começou. Quem não voltar a tempo fica fora da disputa pelo escudo. Como você joga?',
          playerIds: [],
          options: [
            { id: 'quick', label: 'Uma barraca só e volto correndo' },
            { id: 'greedy', label: 'Rodar o parque atrás de mais ouro' },
          ],
        });
        tries = choice === 'greedy' ? 3 : 1;
      }
      for (let t = 0; t < tries && satchels < SATCHELS; t++) {
        if (ctx.attempt(p, 50) && ctx.happens(0.45)) {
          satchels++;
          if (satchels <= 3 || ctx.isHuman(p)) ctx.say(`{user} venceu ${stall} e achou ouro dentro da pelúcia.`, [p]);
        }
      }
      const late = chance(ctx.rng, Math.max(0.05, Math.min(0.9, 0.12 + (tries - 1) * 0.28 - (p.traits.skill - 50) / 300)));
      if (!late) back.push(p);
      else if (ctx.isHuman(p) || ctx.happens(0.5)) ctx.say('A música parou com {user} ainda do outro lado do parque.', [p]);
    }
    ctx.say(`${satchels} saco(s) de ouro. No carrossel, ${back.length} jogador(es) disputam o escudo.`);
    const winner = back.length ? top(back, (p) => p.traits.skill + ctx.rng() * 60, 1)[0] : undefined;
    if (winner) ctx.shield('Na última volta do carrossel, {user} agarrou a argola dourada: escudo.', [winner]);
    ctx.chatter(2);
    return { prizeEarned: roundMoney(satchels * per, STEP), shieldIds: winner ? [winner.id] : [] };
  },
};

// ---------------------------------------------------------------------------------------------
// Episódio 11 · O salto de fé (missão final)
// ---------------------------------------------------------------------------------------------

const leapOfFaith: MissionDefinition = {
  key: 'leap-of-faith',
  origin: US,
  name: 'O Salto de Fé',
  description:
    'Dois jogadores sobem num helicóptero e soltam no lago as cartas dos eliminados presas a boias; os outros levam o barco de pontão em pontão, onde perguntas sobre os eliminados esperam. ' +
    'Cada resposta certa vale dinheiro. No fim, alguém precisa pular do helicóptero no lago para garantir o prêmio.',
  prizeAvailable: 40000,
  play(ctx) {
    const PONTOONS = 8;
    const per = 40000 / PONTOONS;
    const clock = ctx.clock(40);
    const flyers = ctx.pick(Math.min(2, Math.max(1, ctx.players.length - 1)), (p) => p.traits.skill + p.traits.aggression * 0.5 + 10);
    const crew = ctx.players.filter((p) => !flyers.includes(p));
    ctx.say(`${tokenList(flyers.length)} sobem no helicóptero; o resto leva o barco para o lago.`, flyers);
    let right = 0;
    for (let i = 0; i < PONTOONS; i++) {
      if (!clock.spend(3.5 + ctx.rng() * 2)) {
        ctx.say(`O tempo acabou com ${PONTOONS - i} pontão(ões) por visitar.`);
        break;
      }
      const dropper = ctx.oneOf(flyers);
      if (!ctx.attempt(dropper, 40)) {
        ctx.say('A carta solta por {user} caiu longe da boia e afundou.', [dropper]);
        continue;
      }
      const reader = crew.length ? ctx.pick(1, (p) => p.traits.insight + 10, crew)[0] : dropper;
      if (ctx.attempt(reader, 45, crew)) {
        right++;
        ctx.say('{user} respondeu certo sobre o eliminado da carta.', [reader]);
      } else if (ctx.happens(0.4)) {
        ctx.say('{user} errou a pergunta e o barco seguiu em silêncio.', [reader]);
      }
    }
    // O salto: sem ele, o dinheiro não vale.
    const human = flyers.find((p) => ctx.isHuman(p));
    let jumper: SimPlayer | undefined;
    if (human) {
      const jump = ctx.ask({
        id: 'leap-jump',
        prompt: 'O helicóptero para sobre o lago. Alguém precisa pular para garantir o dinheiro. Você pula?',
        playerIds: [],
        options: [
          { id: 'jump', label: 'Pular' },
          { id: 'stay', label: 'Deixar para a outra pessoa' },
        ],
      });
      jumper = jump === 'jump' ? human : flyers.find((p) => p !== human);
    } else if (!ctx.happens(0.05)) {
      jumper = top(flyers, (p) => p.traits.aggression + p.traits.skill + ctx.rng() * 40, 1)[0];
    }
    if (!jumper) {
      ctx.say('Ninguém pulou. O dinheiro voltou com o helicóptero.');
      return { prizeEarned: 0, shieldIds: [] };
    }
    ctx.applaud(jumper, 5);
    ctx.say('{user} respirou fundo e pulou do helicóptero. O lago gelado engoliu o grito, e o dinheiro está garantido.', [jumper]);
    ctx.chatter(1);
    return { prizeEarned: roundMoney(right * per, STEP), shieldIds: [] };
  },
};

// ---------------------------------------------------------------------------------------------
// A temporada
// ---------------------------------------------------------------------------------------------

/** EUA T4 (2026), na ordem da exibição. */
export const US_SEASON_4_MISSIONS: readonly MissionDefinition[] = [lochCoffins, thrones, marshSkulls, effigies, fountain, cabin, urns, tableaux, jackBoxes, fairground];
export const US_SEASON_4_FINALE = leapOfFaith;
