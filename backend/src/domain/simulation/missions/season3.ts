import { chance, shuffle } from '../random';
import { isTraitor, SimPlayer } from '../traits';
import { MissionContext, MissionDefinition } from './MissionContext';
import { tokenList } from '../tokens';
import { byInfluence, pair, roundMoney, top } from './helpers';

/**
 * Missões da 3ª temporada de The Traitors. As duas versões foram gravadas no mesmo castelo, com muitas
 * provas em comum, mas mudam a ordem, os valores e quem ganha escudo:
 *  - EUA (2025): valores em dólar, o barco viking abre a temporada e o Vidente sai no episódio 10;
 *  - Reino Unido (2025): valores em libra, começa no trem, a pólvora pode impedir o assassinato
 *    e há provas que não foram aos EUA (a cerimônia da verdade, os desaparecidos).
 * Cada prova tem imprevistos sorteados e relógio: a mesma missão pode render tudo ou nada.
 */

const US = 'EUA T3';
const UK = 'Reino Unido T3';

/** Passo de arredondamento do dinheiro: centenas de dólares ou dezenas de libras. */
const stepOf = (origin: string) => (origin === US ? 500 : 50);

/** Opções de escolha que são pessoas (a tela mostra nome e retrato). */
const personOptions = (players: readonly SimPlayer[]) => players.map((p) => ({ id: p.id, label: '', playerId: p.id }));

/** Imprevistos do caminho; cada um custa (ou devolve) minutos. */
interface Incident {
  text: string;
  minutes: number;
  /** Quem é citado: 1 ou 2 pessoas do grupo. */
  cast: 1 | 2;
  /** Mexe nos relacionamentos entre os citados. */
  effect?: (ctx: MissionContext, a: SimPlayer, b: SimPlayer) => void;
}

function incident(ctx: MissionContext, list: readonly Incident[], among: readonly SimPlayer[]): number {
  const it = ctx.oneOf(list);
  const [a, b] = ctx.pick(2, () => 1, among);
  const second = b ?? a;
  ctx.say(it.text, it.cast === 2 ? pair(a, second) : [a]);
  it.effect?.(ctx, a, second);
  return it.minutes;
}

const fight = (ctx: MissionContext, a: SimPlayer, b: SimPlayer) => {
  ctx.matrix.adjust(a.id, b.id, { hatred: 6, liking: -4 });
  ctx.matrix.adjust(b.id, a.id, { hatred: 6, liking: -4 });
};
const laugh = (ctx: MissionContext, a: SimPlayer) => ctx.applaud(a, 2);

// ---------------------------------------------------------------------------------------------
// O barco viking
// ---------------------------------------------------------------------------------------------

const ROWING_INCIDENTS: readonly Incident[] = [
  { text: 'Um remo partiu ao meio nas mãos de {user}. O barco girou em círculos até {user1} assumir o lado.', minutes: 4, cast: 2 },
  { text: 'A neblina baixou sobre o lago. {user} jurava que o pontão era para a esquerda; era para a direita.', minutes: 3, cast: 1 },
  { text: '{user} e {user1} discutiram sobre o ritmo das remadas e o barco parou no meio do lago.', minutes: 3, cast: 2, effect: fight },
  { text: '{user} se inclinou demais e caiu na água gelada. Tiraram {user} pelo colete, entre gritos e risadas.', minutes: 2, cast: 1, effect: laugh },
  { text: 'O vento virou a favor. {user} puxou um canto viking e o barco voou pela água.', minutes: -3, cast: 1, effect: laugh },
  { text: 'A correnteza empurrou o barco para as pedras. {user} desviou no último segundo.', minutes: 2, cast: 1 },
];

/**
 * Os dois que ficam no pontão. No modo Jogador, quem está no barco escolhe: se oferecer, deixar o grupo
 * decidir ou insistir em ficar no barco (se o grupo apontar você, insistir pode colocar outra pessoa no
 * seu lugar, e ela não esquece).
 */
function chooseChained(
  ctx: MissionContext,
  boat: readonly SimPlayer[],
  captain: SimPlayer,
  index: number,
  info: { item: string; fuel: number; minutesLeft: number },
): SimPlayer[] {
  const weight = (p: SimPlayer) => (p.id === captain.id ? 1 : 10 + p.traits.loyalty * 0.4 + (100 - ctx.popularity(p)) * 0.6);
  const human = boat.find((p) => ctx.isHuman(p));
  const stance = human
    ? ctx.ask({
        id: 'longboat-pontoon',
        prompt: `Pontão ${index + 1}: ${info.item} espera ali, e duas pessoas vão ficar acorrentadas para pegá-lo. ${info.fuel} de 2 galões a bordo, ${info.minutesLeft} minutos no relógio, ${boat.length} pessoas no barco. Esta noite, só quem ficar acorrentado(a) pode ser assassinado(a). O que você faz?`,
        playerIds: [],
        options: [
          { id: 'volunteer', label: 'Me oferecer para ficar no pontão' },
          { id: 'group', label: 'Deixar o grupo decidir' },
          { id: 'insist', label: 'Insistir em ficar no barco' },
        ],
      })
    : 'group';

  if (human && stance === 'volunteer') {
    const partner = ctx.pick(1, weight, boat.filter((p) => p !== human))[0];
    ctx.applaud(human, 4);
    if (partner) {
      ctx.say(`Pontão ${index + 1}: {user} se ofereceu para ficar e o grupo escolheu {user1} para fazer companhia. As correntes fecharam nos tornozelos.`, [human, partner]);
      return [human, partner];
    }
    ctx.say(`Pontão ${index + 1}: {user} se ofereceu para ficar. As correntes fecharam nos tornozelos.`, [human]);
    return [human];
  }

  let leaving = ctx.pick(2, weight, boat);
  if (human && stance === 'insist') leaving = insistOnBoat(ctx, human, boat, leaving, index, weight);

  const volunteer = leaving.filter((p) => !ctx.isHuman(p) && p.traits.loyalty >= 60 && ctx.happens(0.6));
  if (volunteer.length === leaving.length) {
    ctx.say(`Pontão ${index + 1}: {user} e {user1} se ofereceram para ficar. As correntes fecharam nos tornozelos.`, leaving);
  } else {
    for (const p of leaving.filter((x) => !volunteer.includes(x))) ctx.matrix.adjust(p.id, captain.id, { hatred: 4, trust: -3 });
    ctx.say(`Pontão ${index + 1}: {user} e {user1} ficam no pontão. Acorrentados, os dois viram o barco se afastar.`, leaving);
  }
  return leaving;
}

/** O jogador bate o pé para ficar no barco: pesa a influência e o quanto gostam dele. */
function insistOnBoat(
  ctx: MissionContext,
  human: SimPlayer,
  boat: readonly SimPlayer[],
  leaving: SimPlayer[],
  index: number,
  weight: (p: SimPlayer) => number,
): SimPlayer[] {
  const others = boat.filter((p) => p !== human);
  if (!leaving.includes(human)) {
    for (const o of others) ctx.matrix.adjust(o.id, human.id, { trust: -1 }, 0.5 + o.traits.paranoia / 100);
    ctx.say(`Pontão ${index + 1}: {user} deixou claro que não sai do barco. Alguns acharam estranho alguém se proteger tanto.`, [human]);
    return leaving;
  }
  const wins = chance(ctx.rng, Math.min(0.85, Math.max(0.1, (human.traits.influence + ctx.popularity(human)) / 200)));
  const replacement = wins ? ctx.pick(1, weight, boat.filter((p) => !leaving.includes(p)))[0] : undefined;
  if (!replacement) {
    for (const o of others) ctx.matrix.adjust(o.id, human.id, { trust: -2, liking: -2 });
    ctx.say(`Pontão ${index + 1}: {user} tentou de todo jeito ficar no barco, mas o grupo não cedeu.`, [human]);
    return leaving;
  }
  ctx.matrix.adjust(replacement.id, human.id, { hatred: 12, trust: -8, liking: -6 });
  for (const o of others) if (o !== replacement) ctx.matrix.adjust(o.id, human.id, { trust: -3 }, 0.5 + o.traits.paranoia / 100);
  ctx.say(`Pontão ${index + 1}: o grupo apontou {user}, mas {user} bateu o pé e não saiu do barco. {user1} foi no lugar e não tirou os olhos de {user}.`, [human, replacement]);
  return leaving.map((p) => (p === human ? replacement : p));
}

function longboat(origin: string, prizeAvailable: number): MissionDefinition {
  const step = stepOf(origin);
  return {
    key: 'longboat',
    origin,
    name: 'O Barco Viking',
    description:
      'Um único barco viking atravessa o lago de pontão em pontão. Cada pontão guarda um galão de combustível ou dinheiro, e só dá para pegar o item deixando dois jogadores acorrentados ali. ' +
      'Com pelo menos dois galões, o grupo volta à margem e acende o círculo de fogo: quem estiver dentro ganha escudo e o dinheiro vai para o prêmio. ' +
      'Os acorrentados são os únicos que podem ser assassinados esta noite. O grupo decide se passa por todos os pontões ou volta antes; o relógio não espera.',
    prizeAvailable,
    play(ctx) {
      const PONTOONS = 5;
      const FUEL_NEEDED = 2;
      const clock = ctx.clock(60);
      // Com elenco pequeno, só dá para parar enquanto sobrarem ao menos dois remadores.
      const reachable = Math.max(1, Math.min(PONTOONS, Math.floor((ctx.players.length - 2) / 2)));
      // Dois pontões guardam combustível (sempre ao alcance); os outros, o dinheiro do prêmio.
      const fuelAt = new Set(shuffle(ctx.rng, [...Array(Math.max(reachable, FUEL_NEEDED)).keys()]).slice(0, FUEL_NEEDED));
      const moneySlots = [...Array(PONTOONS).keys()].filter((i) => !fuelAt.has(i));
      const weights = moneySlots.map(() => 0.6 + ctx.rng());
      const sum = weights.reduce((a, b) => a + b, 0);
      const shares = weights.map((w) => roundMoney((prizeAvailable * w) / sum, step));
      shares[shares.length - 1] = prizeAvailable - shares.slice(0, -1).reduce((a, b) => a + b, 0);
      const cash = new Map(moneySlots.map((slot, i) => [slot, shares[i]]));

      let boat = [...ctx.players];
      const chained: SimPlayer[] = [];
      let fuel = 0;
      let money = 0;
      let visited = 0;
      let turnedBackBy: SimPlayer | undefined;
      const captain = byInfluence(boat);
      ctx.say(`Guerreiros vikings empurram um único barco para a água. Cinco pontões espalhados pelo lago; o círculo de fogo espera na margem. {user} assume o leme.`, [captain]);

      for (let i = 0; i < PONTOONS; i++) {
        if (i >= reachable || boat.length < 4) {
          ctx.say('Não sobra gente para deixar em mais um pontão sem afundar o remo. O barco dá meia-volta.');
          break;
        }
        // Remar até o pontão: equipe forte e unida rema mais rápido.
        const strength = boat.reduce((s, p) => s + p.traits.skill, 0) / boat.length;
        let minutes = 6 + ctx.rng() * 4 - (strength - 50) / 20 + (boat.length < 8 ? 2 : 0);
        if (ctx.happens(0.3)) minutes += incident(ctx, ROWING_INCIDENTS, boat);
        clock.spend(minutes);
        visited++;

        // Quem fica acorrentado: voluntários leais ou quem o grupo empurra (os menos queridos, os mais suspeitos).
        const leaving = chooseChained(ctx, boat, captain, i, { item: fuelAt.has(i) ? 'um galão de combustível' : 'um baú de ouro', fuel, minutesLeft: clock.left });
        boat = boat.filter((p) => !leaving.includes(p));
        chained.push(...leaving);

        // O item do pontão.
        const hauler = ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.3, leaving)[0];
        const item = fuelAt.has(i) ? 'o galão' : 'o baú';
        let secured = ctx.attempt(hauler, 30, boat) || !ctx.happens(0.3);
        if (!secured) {
          // O item escorregou para a água: alguém do barco mergulha atrás dele.
          const diver = ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.5, boat)[0];
          secured = ctx.attempt(diver, 50, boat);
          clock.spend(4);
          if (secured) {
            ctx.applaud(diver, 3);
            ctx.say(`${item === 'o galão' ? 'O galão' : 'O baú'} escorregou das mãos de {user} e afundou. {user1} mergulhou na água gelada e voltou com ele.`, pair(hauler, diver));
          } else {
            for (const p of boat) ctx.matrix.adjust(p.id, hauler.id, { trust: -3, hatred: 2 });
            ctx.say(`${item === 'o galão' ? 'O galão' : 'O baú'} escorregou das mãos de {user} e sumiu no fundo do lago. {user1} mergulhou duas vezes e voltou de mãos vazias.`, pair(hauler, diver));
          }
        }
        if (fuelAt.has(i)) {
          if (secured) {
            fuel++;
            ctx.say(`{user} passou o galão de combustível para o barco. ${fuel === 1 ? 'Primeiro galão a bordo.' : 'Dois galões: já dá para acender o círculo.'}`, [hauler]);
          }
        } else {
          const value = cash.get(i) ?? 0;
          if (secured) money += value;
          ctx.say(secured ? `O pontão guardava ouro: ${ctx.money(value)} a bordo.` : `Lá se foram ${ctx.money(value)} em ouro.`);
        }
        if (i === 1) ctx.chatter(1, boat);

        // Sem os dois galões não há volta; com eles, o grupo decide se arrisca mais um pontão.
        const left = reachable - visited;
        const homeTrip = 5 + visited * 1.5;
        if (fuel < FUEL_NEEDED) {
          const fuelLeft = [...fuelAt].filter((slot) => slot > i).length;
          if (fuel + fuelLeft < FUEL_NEEDED) {
            ctx.say('Não resta combustível em nenhum pontão. Sem os dois galões, o círculo de fogo nunca vai acender.');
            break;
          }
          continue;
        }
        if (left <= 0 || boat.length < 4) continue;
        const greed = boat.reduce((s, p) => s + p.traits.aggression + (100 - p.traits.paranoia), 0) / boat.length / 200;
        const hurry = clock.left < homeTrip + 12 ? 0.35 : 0;
        // O jogador no barco dá o voto dele; quanto mais influente, mais o barco escuta.
        const human = boat.find((p) => ctx.isHuman(p));
        const vote = human
          ? ctx.ask({
              id: 'longboat-continue',
              prompt: `Os dois galões estão a bordo. Faltam ${left} pontão(ões), ${clock.left} minutos no relógio e ${boat.length} pessoas no barco (seguir deixa mais duas acorrentadas). O que você defende?`,
              playerIds: [],
              options: [
                { id: 'go', label: 'Seguir para o próximo pontão (mais dinheiro)' },
                { id: 'back', label: 'Voltar agora e acender o círculo' },
              ],
            })
          : undefined;
        const push = human ? (vote === 'go' ? 1 : -1) * (0.2 + human.traits.influence / 250) : 0;
        const goOn = ctx.happens(0.05) || chance(ctx.rng, Math.max(0.05, Math.min(0.95, 0.25 + greed * 0.5 - hurry - (boat.length < 7 ? 0.15 : 0) + push)));
        const bold = human && vote === 'go' ? human : top(boat, (p) => p.traits.aggression + ctx.rng() * 30, 1)[0];
        const careful = human && vote === 'back' ? human : (top(boat.filter((p) => p !== bold), (p) => p.traits.paranoia + ctx.rng() * 30, 1)[0] ?? bold);
        if (human && vote === 'go' && !goOn) ctx.say('{user} queria seguir, mas foi voto vencido.', [human]);
        if (human && vote === 'back' && goOn) ctx.say('{user} pediu para voltar, mas o barco seguiu em frente.', [human]);
        if (goOn) {
          ctx.say('{user} convenceu o barco: "Tem mais dinheiro lá na frente, a gente não veio até aqui para voltar!" {user1} remou calado(a).', pair(bold, careful));
        } else {
          turnedBackBy = careful;
          ctx.say('"Já temos o combustível. Mais um pontão é mais gente na mira dos Traidores", disse {user}. O barco virou para a margem.', [careful]);
          break;
        }
      }

      // Volta à margem e o círculo de fogo.
      const back = 5 + visited * 1.5 + (ctx.happens(0.25) ? incident(ctx, ROWING_INCIDENTS, boat) : 0);
      clock.spend(back);
      const lit = fuel >= FUEL_NEEDED && !clock.over && (ctx.happens(0.1) ? ctx.attempt(byInfluence(boat), 50, boat) : true);
      if (fuel >= FUEL_NEEDED && clock.over) {
        ctx.say(`O barco encostou na margem ${clock.elapsed - clock.limit} minuto(s) depois do fim. As tochas se apagaram: nada de círculo, nada de escudo, nada de dinheiro.`);
      } else if (fuel >= FUEL_NEEDED && !lit) {
        ctx.say('A chama pegou e morreu duas vezes no combustível molhado. O círculo não acendeu a tempo.');
      } else if (lit) {
        ctx.say(`Com ${clock.elapsed} minutos no relógio, {user} jogou a tocha e o círculo de fogo subiu na margem.`, [byInfluence(boat)]);
      }

      // Quem ficou nos pontões não perdoa quem voltou antes da hora.
      const skipped = PONTOONS - visited;
      if (skipped > 0 && chained.length && boat.length) {
        const lost = [...cash.entries()].filter(([slot]) => slot >= visited).reduce((s, [, v]) => s + v, 0);
        for (const c of chained) {
          for (const b of boat) ctx.matrix.adjust(c.id, b.id, { hatred: 5, trust: -4, liking: -3 }, 0.6 + c.traits.volatility / 100);
          if (turnedBackBy) ctx.matrix.adjust(c.id, turnedBackBy.id, { hatred: 10, trust: -6 });
        }
        const angry = top(chained, (p) => p.traits.volatility + p.traits.aggression + ctx.rng() * 30, 1)[0];
        ctx.say(
          `O barco deixou ${skipped} pontão(ões) para trás${lost ? ` e ${ctx.money(lost)} no lago` : ''}. Acorrentado(a), {user} gritou: "Vocês nos largaram aqui para morrer!"`,
          [angry],
        );
        ctx.secret(`Só ${chained.length} jogadores ficaram nos pontões: a chance de cada um ser o alvo desta noite é maior.`);
      } else if (chained.length) {
        for (const c of chained) for (const b of boat) ctx.matrix.adjust(c.id, b.id, { liking: 2 });
        ctx.say('O barco passou por todos os pontões. Pelo menos ninguém foi deixado à toa.');
      }

      if (chained.length) {
        ctx.twists.dungeonIds = chained.map((p) => p.id);
        ctx.secret(`Na torre, só ${tokenList(chained.length)} podem ser assassinados esta noite.`, chained);
      }
      ctx.chatter(1);
      if (!lit) return { prizeEarned: 0, shieldIds: [] };
      ctx.shield(`Dentro do círculo de fogo, os ${boat.length} que voltaram no barco ganham escudo.`, []);
      return { prizeEarned: Math.min(prizeAvailable, money), shieldIds: boat.map((p) => p.id) };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// As gaiolas
// ---------------------------------------------------------------------------------------------

const TREE_INCIDENTS: readonly Incident[] = [
  { text: 'O tubo de moedas rachou e metade escorreu pela grama. {user} catou moeda por moeda.', minutes: 3, cast: 1 },
  { text: '{user} subiu na árvore errada e perdeu minutos preciosos.', minutes: 3, cast: 1 },
  { text: '{user} e {user1} se trombaram debaixo da mesma árvore. Moedas para todo lado e dedo na cara.', minutes: 2, cast: 2, effect: fight },
  { text: 'Uma rajada sacudiu os galhos e choveram moedas. {user} encheu os bolsos rindo.', minutes: -3, cast: 1, effect: laugh },
];

function cages(origin: string, prizeAvailable: number, release: number): MissionDefinition {
  const uk = origin === UK;
  return {
    key: 'cages',
    origin,
    name: 'As Gaiolas',
    description: uk
      ? `Três jogadores ficam pendurados em gaiolas. O resto colhe moedas das árvores (cada uma vale dinheiro) e enche os tubos; só dá para libertar ${release} dos três. Quem sai da gaiola entrega um escudo a outra pessoa.`
      : 'Três jogadores ficam pendurados em gaiolas sobre a água. O resto colhe moedas das árvores e enche os tubos para libertá-los; cada gaiola aberta vale dinheiro e quem sai entrega um escudo a outra pessoa.',
    prizeAvailable,
    play(ctx) {
      const clock = ctx.clock(30);
      const caged = ctx.pick(Math.min(3, ctx.players.length - 2), (p) => (100 - ctx.popularity(p)) ** 1.5 + 5);
      const rescuers = ctx.players.filter((p) => !caged.includes(p));
      ctx.say(`Meia hora no relógio. ${tokenList(caged.length)} ${caged.length > 1 ? 'balançam' : 'balança'} dentro das gaiolas.`, caged);

      // Jogador do lado de fora: escolhe qual gaiola a equipe dele ataca primeiro (o relógio pode não dar para todas).
      const human = rescuers.find((p) => ctx.isHuman(p));
      let order = caged;
      if (human && caged.length > 1) {
        const firstId = ctx.ask({ id: 'cages-first', prompt: 'Meia hora para encher os tubos. Qual gaiola você e sua equipe atacam primeiro?', playerIds: [], options: personOptions(caged) });
        order = [...caged].sort((a, b) => Number(b.id === firstId) - Number(a.id === firstId));
      }

      const coinValue = uk ? 50 : 0;
      let coins = 0;
      const freed: SimPlayer[] = [];
      const shieldIds: string[] = [];
      for (const [n, prisoner] of order.entries()) {
        if (freed.length >= release) {
          ctx.say('Só dava para abrir uma gaiola a mais. {user} ficou lá em cima, vendo os outros descerem.', [prisoner]);
          ctx.matrix.adjust(prisoner.id, byInfluence(rescuers).id, { hatred: 5 });
          continue;
        }
        let team = ctx.pick(Math.min(3, rescuers.length), (p) => p.traits.skill + ctx.matrix.get(p.id, prisoner.id).liking, rescuers);
        if (human && n === 0 && !team.includes(human)) team = [human, ...team.slice(0, -1)];
        let minutes = 7 + ctx.rng() * 6 - team.reduce((s, p) => s + p.traits.skill - 50, 0) / 40;
        if (ctx.happens(0.3)) minutes += incident(ctx, TREE_INCIDENTS, team);
        const inTime = clock.spend(minutes);
        const collected = team.filter((r) => ctx.attempt(r, 50, team)).length;
        coins += collected * ctx.between(20, 40);
        if (inTime && collected >= 1) {
          freed.push(prisoner);
          for (const r of team) ctx.matrix.adjust(prisoner.id, r.id, { liking: 8, trust: 5 });
          ctx.say('{user} derramou as últimas moedas no tubo e a gaiola de {user1} se abriu.', pair(team[0], prisoner));
          // Quem sai não fica com o escudo: entrega a alguém de confiança (o jogador escolhe a quem).
          const candidates = ctx.players.filter((p) => p !== prisoner && !shieldIds.includes(p.id));
          const chosen = ctx.isHuman(prisoner) && candidates.length
            ? ctx.askPerson({ id: 'cages-shield', prompt: 'Sua gaiola se abriu! Você não pode ficar com o escudo: a quem vai entregá-lo?', playerIds: [] }, candidates)
            : top(candidates, (p) => ctx.matrix.get(prisoner.id, p.id).liking + ctx.matrix.get(prisoner.id, p.id).trust + ctx.rng() * 20, 1)[0];
          if (chosen) {
            shieldIds.push(chosen.id);
            ctx.matrix.adjust(chosen.id, prisoner.id, { liking: 10, trust: 8 });
            ctx.shield('De volta ao chão, {user} entregou o escudo a {user1}.', pair(prisoner, chosen));
          }
        } else if (!inTime) {
          ctx.say('A buzina tocou com o tubo quase cheio. {user} ficou preso(a) na gaiola.', [prisoner]);
        } else {
          ctx.say('As moedas de {user} não bastaram: {user1} continua pendurado(a).', pair(team[0], prisoner));
        }
      }
      ctx.chatter(2);
      const earned = uk ? Math.min(prizeAvailable, coins * coinValue) : freed.length * (prizeAvailable / 3);
      return { prizeEarned: earned, shieldIds };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// A casa dos espelhos
// ---------------------------------------------------------------------------------------------

const DOORS = ['a porta do palhaço', 'a porta espelhada', 'a porta vermelha', 'a porta estreita'] as const;

/**
 * Uma sala da casa dos espelhos com o jogador: ele escolhe a porta. Uma porta errada se entrega
 * (espetos à mostra) e o parceiro dá um palpite, que acerta mais quando ele é habilidoso.
 */
function humanDoor(ctx: MissionContext, human: SimPlayer, partner: SimPlayer, room: number): boolean {
  const right = ctx.oneOf(DOORS);
  const wrong = DOORS.filter((d) => d !== right);
  const obvious = ctx.oneOf(wrong);
  const partnerRight = chance(ctx.rng, Math.min(0.85, 0.45 + partner.traits.skill / 250 + partner.traits.insight / 500));
  // Um Traidor pode "errar" o palpite de propósito para afundar a missão.
  const lying = isTraitor(partner) && !isTraitor(human) && ctx.happens(0.2);
  const hint = partnerRight && !lying ? right : ctx.oneOf(wrong.filter((d) => d !== obvious));
  const door = ctx.ask({
    id: 'fun-house-door',
    prompt: `Sala ${room} de 4. O balão treme nas suas mãos. Por ${obvious} dá para ver espetos brilhando. {user} cochicha: "Vai ${hint.replace('a porta', 'pela porta')}!" Qual porta você abre?`,
    playerIds: [partner.id],
    options: DOORS.map((d) => ({ id: d, label: d[0].toUpperCase() + d.slice(1) })),
  });
  const followed = door === hint;
  if (door === right) {
    if (!followed) ctx.matrix.adjust(partner.id, human.id, { trust: 3, liking: 2 });
    ctx.say(`Sala ${room}: {user} abriu ${door} e o balão passou inteiro${followed ? ', como {user1} tinha dito' : ''}.`, [human, partner]);
    return true;
  }
  if (!followed) ctx.matrix.adjust(partner.id, human.id, { hatred: 6, trust: -4 });
  else ctx.matrix.adjust(human.id, partner.id, { trust: -5, hatred: 3 });
  ctx.say(
    followed
      ? `Sala ${room}: {user} seguiu o palpite de {user1} e abriu ${door}. Um espeto na parede e o balão virou farrapo.`
      : `Sala ${room}: {user} ignorou {user1} e abriu ${door}. Um espeto e o balão estourou; a porta certa era ${right}.`,
    [human, partner],
  );
  return false;
}

function funHouse(origin: string, prizeAvailable: number, perBalloon: number): MissionDefinition {
  const uk = origin === UK;
  return {
    key: 'fun-house',
    origin,
    name: 'A Casa dos Espelhos',
    description: `Em duplas, os jogadores atravessam uma casa de espelhos levando um balão dourado. Cada sala tem quatro portas e a errada estoura o balão; cada balão que sai inteiro vale dinheiro.${uk ? ' A primeira dupla a sair com o balão ganha escudos.' : ''}`,
    prizeAvailable,
    play(ctx) {
      ctx.say(`Espelhos, palhaços e portas que enganam. Cada balão intacto vale ${ctx.money(perBalloon)}.`);
      let earned = 0;
      let first: [SimPlayer, SimPlayer] | undefined;
      for (const [a, b] of ctx.pairs(Math.round(prizeAvailable / perBalloon))) {
        let intact = true;
        const human = [a, b].find((p) => ctx.isHuman(p));
        for (let room = 1; room <= 4 && intact; room++) {
          const chooser = chance(ctx.rng, 0.5) ? a : b;
          if (human) {
            intact = humanDoor(ctx, human, human === a ? b : a, room);
          } else if (ctx.happens(0.03)) {
            intact = false;
            ctx.say(`Sala ${room}: um palhaço saltou do escuro e {user} apertou o balão com o susto. Estourou.`, [chooser]);
          } else if (!ctx.attempt(chooser, 30 + room * 3, [a, b])) {
            intact = false;
            ctx.say(`Sala ${room}: {user} escolheu a porta errada. Um espeto na parede e o balão da dupla virou farrapo.`, [chooser]);
          }
        }
        if (intact) {
          earned += perBalloon;
          first ??= [a, b];
          ctx.say('{user} e {user1} saíram do outro lado com o balão inteiro.', [a, b]);
        } else {
          ctx.matrix.adjust(a.id, b.id, { hatred: 4, liking: -3 });
          ctx.matrix.adjust(b.id, a.id, { hatred: 4, liking: -3 });
        }
      }
      if (!earned) ctx.say('Nenhum balão sobreviveu. O prêmio não ganhou um centavo.');
      ctx.chatter(2);
      if (uk && first) ctx.shield('A primeira dupla a sair inteira, {user} e {user1}, ganha escudos.', first);
      return { prizeEarned: earned, shieldIds: uk && first ? first.map((p) => p.id) : [] };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// As estátuas
// ---------------------------------------------------------------------------------------------

const HILL_INCIDENTS: readonly Incident[] = [
  { text: 'A cabeça escapou das mãos de {user} e rolou ladeira abaixo. Tudo de novo.', minutes: 5, cast: 1 },
  { text: 'Começou a chover e a grama virou sabão. {user} escorregou de joelhos.', minutes: 3, cast: 1 },
  { text: '{user} e {user1} brigaram sobre qual cabeça ia em qual corpo.', minutes: 3, cast: 2, effect: fight },
  { text: '{user} achou um atalho pelo bosque e o grupo ganhou tempo.', minutes: -4, cast: 1, effect: laugh },
];

function statues(origin: string, prizeAvailable: number, count: number): MissionDefinition {
  const uk = origin === UK;
  return {
    key: 'statues',
    origin,
    name: 'As Estátuas',
    description: uk
      ? `Em 45 minutos, cabeças e corpos gigantes sobem a colina para formar ${count} estátuas. Cada cabeça tem o nome de um jogador; a cabeça colocada no pedestal do escudo protege quem ela representa.`
      : `Em 45 minutos, cabeças e corpos gigantes sobem a colina para formar ${count} estátuas. Cada cabeça tem o nome de um jogador: quem tem a estátua completa ganha escudo.`,
    prizeAvailable,
    play(ctx) {
      const clock = ctx.clock(45);
      const per = prizeAvailable / count;
      const faces = ctx.pick(Math.min(count, ctx.players.length), () => 1);
      const teams = ctx.teams(2).filter((t) => t.length);
      ctx.say(`${count} pedestais no alto da colina e 45 minutos. As cabeças têm nomes do elenco.`);
      // Jogador: escolhe qual cabeça a equipe dele sobe primeiro (e carrega ele mesmo). O tempo pode não dar para todas.
      const human = ctx.human && ctx.players.includes(ctx.human) ? ctx.human : undefined;
      const humanTeam = human ? teams.findIndex((t) => t.includes(human)) : -1;
      let humanSlot = -1;
      if (human && humanTeam >= 0) {
        const slots = faces.map((_, i) => i).filter((i) => i % teams.length === humanTeam);
        if (slots.length) {
          const firstId = ctx.ask({
            id: 'statues-first',
            prompt: `Sua equipe tem ${slots.length} cabeça(s) para subir a colina. Estátua completa protege quem está esculpido. Qual você carrega primeiro?`,
            playerIds: [],
            options: personOptions(slots.map((i) => faces[i])),
          });
          const from = slots.find((i) => faces[i].id === firstId) ?? slots[0];
          [faces[slots[0]], faces[from]] = [faces[from], faces[slots[0]]];
          humanSlot = slots[0];
        }
      }
      let earned = 0;
      const built: SimPlayer[] = [];
      for (const [i, face] of faces.entries()) {
        const team = teams[i % teams.length];
        const builder = i === humanSlot && human ? human : ctx.pick(1, (p) => p.traits.skill + p.traits.aggression * 0.3, team)[0];
        let minutes = (45 / count) * (0.7 + ctx.rng() * 0.6) - (builder.traits.skill - 50) / 25;
        if (ctx.happens(0.2)) minutes += incident(ctx, HILL_INCIDENTS, team);
        if (!clock.spend(minutes)) {
          ctx.say(`O tempo acabou com ${faces.length - i} estátua(s) sem cabeça.`);
          break;
        }
        if (ctx.attempt(builder, 45, team)) {
          earned += per;
          built.push(face);
          ctx.say('{user} encaixou a cabeça no pedestal: a estátua de {user1} ficou de pé.', pair(builder, face));
        } else {
          ctx.say('A estátua de {user} rachou no encaixe e não conta.', [face]);
        }
      }
      ctx.chatter(1);
      let shielded: SimPlayer[] = built;
      if (uk) {
        const plinth = built.length ? ctx.oneOf(built) : undefined;
        shielded = plinth ? [plinth] : [];
        if (plinth) ctx.shield('A cabeça de {user} foi parar no pedestal do escudo: protegido(a) esta noite.', [plinth]);
      } else if (built.length) {
        ctx.shield(`${built.length} estátua(s) completa(s): os rostos esculpidos ganham escudo.`, []);
      }
      return { prizeEarned: roundMoney(earned, stepOf(origin)), shieldIds: shielded.map((p) => p.id) };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Os retratos (só nos EUA)
// ---------------------------------------------------------------------------------------------

interface Riddle {
  text: string;
  answer: string;
  wrong: readonly [string, string];
}

const RIDDLES: readonly Riddle[] = [
  { text: 'Charada: "O que é, o que é: quanto mais se tira, maior fica?"', answer: 'O buraco', wrong: ['A sombra', 'A dívida'] },
  { text: 'Enigma: "Tenho cidades, mas não casas; florestas, mas não árvores; água, mas não peixes. O que sou?"', answer: 'Um mapa', wrong: ['Um sonho', 'Um livro'] },
  { text: 'Adivinha: "Anda com os pés na cabeça."', answer: 'O piolho', wrong: ['O chapéu', 'A formiga'] },
  { text: 'Charada: "O que é, o que é: tem dentes mas não morde?"', answer: 'O pente', wrong: ['A chave', 'O relógio'] },
  { text: 'Enigma: "Quanto mais seca, mais molhada fica. O que é?"', answer: 'A toalha', wrong: ['A areia', 'O guarda-chuva'] },
  { text: 'Adivinha: "Fala sem boca, ouve sem ouvidos e responde ao vento."', answer: 'O eco', wrong: ['O sino', 'A sombra'] },
  { text: 'Charada: "O que é, o que é: cai em pé e corre deitado?"', answer: 'A chuva', wrong: ['O rio', 'A neve'] },
  { text: 'Enigma: "Se me nomeia, eu desapareço. O que sou?"', answer: 'O silêncio', wrong: ['O segredo', 'A escuridão'] },
  { text: 'Adivinha: "Tem pescoço mas não tem cabeça; tem corpo mas não tem pernas."', answer: 'A garrafa', wrong: ['A camisa', 'O violão'] },
  { text: 'Charada: "O que é, o que é: quanto mais cresce, menos se vê?"', answer: 'A escuridão', wrong: ['A neblina', 'A idade'] },
];

/** Molduras do escudo na galeria: só dois retratos ficam no fim. */
const FRAMES = 2;

/**
 * Quem acerta pendura um retrato. A preferência é o próprio; às vezes protege um aliado (um Traidor
 * tende a proteger o parceiro), e isso levanta suspeitas. Com as molduras cheias, tira o retrato de
 * quem menos gosta.
 */
function placePortrait(ctx: MissionContext, player: SimPlayer, frames: SimPlayer[]): void {
  const selfFramed = frames.includes(player);
  const ally = top(
    ctx.players.filter((p) => p !== player && !frames.includes(p)),
    (p) => ctx.matrix.get(player.id, p.id).liking + ctx.matrix.get(player.id, p.id).trust + (isTraitor(player) && isTraitor(p) ? 60 : 0) + ctx.rng() * 20,
    1,
  )[0];
  const bond = ally ? ctx.matrix.get(player.id, ally.id).liking : 0;
  const partnerInCrime = !!ally && isTraitor(player) && isTraitor(ally);

  let chosen: SimPlayer | undefined;
  if (ctx.isHuman(player)) {
    chosen = humanPortraitChoice(ctx, player, frames);
  } else if (!selfFramed) {
    const generosity = 0.1 + (player.traits.loyalty - 50) / 250 + (bond - 60) / 200 + (partnerInCrime ? 0.15 : 0);
    chosen = ally && ctx.happens(Math.max(0.03, generosity)) ? ally : player;
  } else if (ally) {
    // Já está na parede: pode proteger um aliado ou deixar tudo como está.
    const other = frames.find((p) => p !== player);
    const dislikeOther = other ? 60 - ctx.matrix.get(player.id, other.id).liking : 40;
    if (ctx.happens(Math.max(0.1, 0.35 + dislikeOther / 150 + (partnerInCrime ? 0.2 : 0)))) chosen = ally;
  }
  if (!chosen) {
    ctx.say('Com o próprio retrato já na moldura, {user} preferiu não mexer na parede.', [player]);
    return;
  }
  const protectedPartner = chosen !== player && isTraitor(player) && isTraitor(chosen);

  // Com as duas molduras cheias, alguém sai (nunca o próprio retrato de quem pendura).
  if (frames.length >= FRAMES) {
    const removable = frames.filter((p) => p !== player);
    const removed =
      ctx.isHuman(player) && removable.length > 1
        ? ctx.askPerson({ id: 'portrait-remove', prompt: `As duas molduras estão ocupadas. Para pendurar ${chosen === player ? 'o seu retrato' : 'o retrato'}, você precisa tirar alguém. Quem sai?`, playerIds: [] }, removable)
        : top(removable, (p) => 100 - ctx.matrix.get(player.id, p.id).liking + ctx.matrix.suspicion(player.id, p.id) * 0.5 + ctx.rng() * 20, 1)[0];
    frames.splice(frames.indexOf(removed), 1);
    ctx.matrix.adjust(removed.id, player.id, { hatred: 8, trust: -5 }, 0.6 + removed.traits.volatility / 100);
    ctx.say('{user} tirou o retrato de {user1} da moldura.', [player, removed]);
  }
  frames.push(chosen);

  if (chosen === player) {
    ctx.say('{user} pendurou o próprio retrato numa moldura dourada.', [player]);
    return;
  }
  ctx.matrix.adjust(chosen.id, player.id, { liking: 10, trust: 8 });
  const penalty = selfFramed ? 0.5 : 1;
  for (const observer of ctx.players) {
    if (observer === player || observer === chosen) continue;
    ctx.matrix.adjust(observer.id, player.id, { trust: -5 * penalty }, 0.5 + observer.traits.paranoia / 100);
    ctx.matrix.adjust(observer.id, chosen.id, { trust: -3 * penalty }, 0.5 + observer.traits.paranoia / 100);
  }
  ctx.say(
    selfFramed
      ? 'Já protegido(a), {user} usou a vez para pendurar o retrato de {user1}. Alguns trocaram olhares.'
      : 'Em vez do próprio, {user} pendurou o retrato de {user1}. A galeria murmurou: por que proteger justo {user1}?',
    [player, chosen],
  );
  if (protectedPartner) ctx.secret('Traidor(a), {user} protegeu o(a) parceiro(a) de torre, {user1}.', [player, chosen]);
}

/** O jogador acertou: escolhe qual retrato pendurar (o próprio, o de outra pessoa ou, já na parede, nenhum). */
function humanPortraitChoice(ctx: MissionContext, player: SimPlayer, frames: readonly SimPlayer[]): SimPlayer | undefined {
  const selfFramed = frames.includes(player);
  const others = ctx.players.filter((p) => p !== player && !frames.includes(p));
  const wall = frames.length ? `Na parede agora: ${tokenList(frames.length)}.` : 'As duas molduras estão vazias.';
  const answer = ctx.ask({
    id: 'portrait-hang',
    prompt: `Você acertou! ${wall} Qual retrato você pendura? Proteger outra pessoa no lugar de si mesmo(a) levanta suspeitas.`,
    playerIds: frames.map((p) => p.id),
    options: [
      selfFramed ? { id: 'none', label: 'Não mexer na parede (meu retrato já está lá)' } : { id: 'self', label: 'Pendurar o meu retrato' },
      ...personOptions(others),
    ],
  });
  if (answer === 'self') return player;
  return others.find((p) => p.id === answer);
}

const portraits: MissionDefinition = {
  key: 'portraits',
  origin: US,
  name: 'Os Retratos',
  description:
    'Enigmas, charadas e adivinhas na galeria de retratos. Cada acerto vale dinheiro e dá direito a pendurar um retrato numa das duas molduras do escudo; com as duas ocupadas, é preciso tirar alguém. ' +
    'Cada um prefere pendurar o próprio retrato, mas pode proteger outra pessoa, o que levanta suspeitas. Quem erra sai da galeria. Os dois retratos que sobram no fim ganham escudo.',
  prizeAvailable: 20000,
  play(ctx) {
    ctx.say(`Na galeria, oito enigmas e duas molduras douradas vazias. Cada acerto vale ${ctx.money(2500)} e um retrato na parede; errar tira o jogador da sala.`);
    let alive = [...ctx.players];
    const frames: SimPlayer[] = [];
    const riddles = shuffle(ctx.rng, RIDDLES);
    let earned = 0;
    for (let q = 1; q <= 8 && alive.length; q++) {
      const { text: riddle, answer, wrong } = riddles[(q - 1) % riddles.length];
      const answerer = ctx.pick(1, (p) => p.traits.skill + p.traits.insight + 10, alive)[0];
      if (ctx.isHuman(answerer)) {
        // Sua vez: responder o enigma (errar tira você da galeria).
        const guess = ctx.ask({
          id: 'portrait-riddle',
          prompt: `Pergunta ${q} de 8, e é a sua vez. ${riddle} Errar tira você da galeria.`,
          playerIds: [],
          options: shuffle(ctx.rng, [answer, ...wrong]).map((a) => ({ id: a, label: a })),
        });
        if (guess !== answer) {
          alive = alive.filter((p) => p !== answerer);
          ctx.say(`${riddle} {user} respondeu "${guess}". Era "${answer}": fora da galeria.`, [answerer]);
          continue;
        }
      } else if (ctx.happens(0.07)) {
        ctx.say(`${riddle} {user} sabia a resposta, mas travou quando o relógio da galeria badalou. Fora.`, [answerer]);
        alive = alive.filter((p) => p !== answerer);
        continue;
      } else if (!ctx.attempt(answerer, 55)) {
        alive = alive.filter((p) => p !== answerer);
        ctx.say(`${riddle} {user} bateu o pé na resposta errada e saiu da galeria.`, [answerer]);
        continue;
      }
      earned += 2500;
      ctx.say(`${riddle} {user} acertou e ganhou o direito de pendurar um retrato.`, [answerer]);
      placePortrait(ctx, answerer, frames);
      if (q === 4) ctx.chatter(1);
    }
    if (frames.length) ctx.shield(frames.length === 2 ? 'No fim, os retratos de {user} e {user1} ficaram nas molduras douradas: escudos.' : 'No fim, só o retrato de {user} ficou na moldura dourada: escudo.', frames);
    ctx.chatter(1);
    return { prizeEarned: earned, shieldIds: frames.map((p) => p.id) };
  },
};

// ---------------------------------------------------------------------------------------------
// A pólvora
// ---------------------------------------------------------------------------------------------

function gunpowder(origin: string, prizeAvailable: number): MissionDefinition {
  const uk = origin === UK;
  return {
    key: 'gunpowder',
    origin,
    name: 'A Pólvora',
    description: uk
      ? 'Cada jogador destranca um caixote: dentro há ouro (vale dinheiro) ou pólvora. Com 500 kg de pólvora a estátua dos Traidores vai pelos ares, e nesta noite não há assassinato.'
      : 'Cada jogador destranca um caixote: dentro há pólvora ou, em três deles, um escudo secreto. Com 500 kg de pólvora a estátua dos Traidores vai pelos ares e o prêmio vem inteiro; menos que isso, nada.',
    prizeAvailable,
    play(ctx) {
      const clock = ctx.clock(40);
      // Caixotes especiais (ouro ou escudo) e, nos outros, a pólvora: 500 kg pedem uns 70% deles.
      const specialCount = Math.min(uk ? Math.round(prizeAvailable / 1000) : 3, Math.floor(ctx.players.length * 0.3));
      const needed = Math.max(2, Math.ceil((ctx.players.length - specialCount) * 0.7));
      ctx.say(`Caixotes trancados cobrem o pátio. ${needed} barris (500 kg) derrubam a estátua dos Traidores.${uk ? ' Alguns caixotes guardam ouro.' : ' Três caixotes guardam escudos.'}`);
      const special = new Set(ctx.pick(specialCount, () => 1).map((p) => p.id));
      let barrels = 0;
      let gold = 0;
      const shielded: SimPlayer[] = [];
      for (const player of ctx.players) {
        if (!clock.spend(40 / ctx.players.length * (0.6 + ctx.rng() * 0.7))) {
          ctx.say('O relógio zerou com caixotes ainda trancados.');
          break;
        }
        if (ctx.happens(0.05)) {
          ctx.say('A chave de {user} quebrou dentro do cadeado. Aquele caixote não abre mais.', [player]);
          continue;
        }
        if (!ctx.attempt(player, 42)) continue;
        if (special.has(player.id)) {
          if (uk) {
            gold += 1000;
            ctx.say('{user} abriu o caixote e o ouro brilhou: ' + ctx.money(1000) + ' para o prêmio.', [player]);
          } else {
            shielded.push(player);
            const tell =
              ctx.isHuman(player) &&
              ctx.ask({
                id: 'gunpowder-shield',
                prompt: 'Você girou a chave e, em vez de pólvora, encontrou um escudo! Ninguém viu. Conta para o grupo ou guarda segredo?',
                playerIds: [],
                options: [
                  { id: 'secret', label: 'Guardar segredo (os Traidores não sabem que estou protegido(a))' },
                  { id: 'tell', label: 'Contar ao grupo (ganho confiança, mas todos sabem)' },
                ],
              }) === 'tell';
            if (tell) {
              for (const o of ctx.players) if (o !== player) ctx.matrix.adjust(o.id, player.id, { trust: 4 });
              ctx.say('{user} ergueu o escudo e mostrou para todo mundo: "Não tenho nada a esconder."', [player]);
            } else {
              ctx.secret('{user} abriu o caixote e encontrou um escudo. Decidiu não contar a ninguém.', [player]);
            }
          }
        } else {
          barrels++;
        }
      }
      ctx.chatter(1);
      let blown = barrels >= needed;
      if (blown && ctx.happens(0.08)) {
        blown = false;
        ctx.say('Os barris estavam lá, mas o pavio molhou na garoa e apagou duas vezes. A estátua não caiu.');
      } else {
        ctx.say(blown ? `${barrels} barris. O pavio queimou e a estátua dos Traidores explodiu em mil pedaços.` : `Só ${barrels} de ${needed} barris: a estátua dos Traidores continua de pé.`);
      }
      if (uk && blown && ctx.traitors.length) {
        ctx.twists.noMurderTonight = true;
        ctx.secret('Com a estátua em pedaços, os Traidores não podem assassinar ninguém esta noite.');
      }
      ctx.chatter(1);
      const earned = uk ? gold : blown ? prizeAvailable : 0;
      return { prizeEarned: Math.min(prizeAvailable, earned), shieldIds: shielded.map((p) => p.id) };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Até que a morte nos separe (só nos EUA)
// ---------------------------------------------------------------------------------------------

const boxes: MissionDefinition = {
  key: 'boxes',
  origin: US,
  name: 'Até que a Morte nos Separe',
  description: 'Duplas de mãos dadas dentro de caixões cheios de bichos por oito minutos; cada dupla que resiste vale dinheiro. Depois, as duplas procuram alianças no meio dos bichos: quem acha ganha escudos.',
  prizeAvailable: 27000,
  play(ctx) {
    ctx.say('Seis caixões, seis duplas, oito minutos de mãos dadas entre aranhas, baratas e ratos.');
    const survivors: [SimPlayer, SimPlayer][] = [];
    let earned = 0;
    let humanPair: [SimPlayer, SimPlayer] | undefined;
    for (const [a, b] of ctx.pairs(6)) {
      const nerve = (p: SimPlayer) => 35 + (p.traits.volatility - 50) * 0.5;
      const minute = ctx.between(1, 8);
      const human = [a, b].find((p) => ctx.isHuman(p));
      if (human) {
        const partner = human === a ? b : a;
        const hold = ctx.ask({
          id: 'boxes-hold',
          prompt: `Minuto ${minute} de 8 dentro do caixão. Uma aranha peluda sobe pelo seu pescoço e algo mordisca o seu tornozelo. A mão de {user} aperta a sua. O que você faz?`,
          playerIds: [partner.id],
          options: [
            { id: 'hold', label: 'Fechar os olhos e aguentar firme' },
            { id: 'release', label: 'Soltar a mão e sair do caixão' },
          ],
        });
        if (hold === 'hold' && ctx.attempt(human, nerve(human) - 15, [partner]) && ctx.attempt(partner, nerve(partner), [human])) {
          earned += 4500;
          survivors.push([a, b]);
          humanPair = [human, partner];
          ctx.matrix.adjust(partner.id, human.id, { liking: 8, trust: 6 });
          ctx.say('{user} e {user1} aguentaram os oito minutos inteiros, de mãos dadas até o fim.', [human, partner]);
        } else if (hold === 'hold') {
          ctx.say('{user} aguentou firme, mas {user1} não segurou e soltou a mão.', [human, partner]);
          ctx.matrix.adjust(human.id, partner.id, { liking: -3 });
        } else {
          ctx.matrix.adjust(partner.id, human.id, { hatred: 7, liking: -5 });
          ctx.say('{user} soltou a mão e saiu do caixão. {user1} ficou sozinho(a) com os bichos e o dinheiro da dupla foi embora.', [human, partner]);
        }
        continue;
      }
      if (ctx.happens(0.06)) {
        ctx.say(`Minuto ${minute}: um rato entrou pela manga de {user}. Nem {user1} segurou.`, [a, b]);
      } else if (ctx.attempt(a, nerve(a), [b]) && ctx.attempt(b, nerve(b), [a])) {
        earned += 4500;
        survivors.push([a, b]);
        ctx.matrix.adjust(a.id, b.id, { liking: 6, trust: 5 });
        ctx.matrix.adjust(b.id, a.id, { liking: 6, trust: 5 });
        ctx.say('{user} e {user1} não soltaram as mãos nem quando as aranhas subiram pelo rosto.', [a, b]);
      } else {
        const [quitter, other] = chance(ctx.rng, 0.5) ? [a, b] : [b, a];
        ctx.matrix.adjust(other.id, quitter.id, { hatred: 5, liking: -4 });
        ctx.say(`Minuto ${minute}: {user} gritou e soltou a mão. {user1} saiu do caixão sem olhar para trás.`, [quitter, other]);
      }
    }
    ctx.chatter(1);
    const rings = top(survivors.filter((s) => s !== humanPair && !(humanPair && s.includes(humanPair[0]))), ([a, b]) => a.traits.skill + b.traits.skill + ctx.rng() * 60, ctx.between(1, 3));
    if (humanPair) {
      // A dupla do jogador procura a aliança: ele escolhe onde enfiar a mão.
      const spots = ['Debaixo das baratas', 'No meio das aranhas', 'No ninho dos ratos'];
      const lucky = ctx.oneOf(spots);
      const spot = ctx.ask({ id: 'boxes-ring', prompt: 'Vocês resistiram! Agora, a aliança escondida no caixão vale escudo para a dupla. Onde você procura?', playerIds: [], options: spots.map((s) => ({ id: s, label: s })) });
      if (spot === lucky) rings.push(humanPair);
      else ctx.say(`{user} revirou ${spot.toLowerCase()} e não achou nada. A aliança estava ${lucky.toLowerCase()}.`, [humanPair[0]]);
    }
    for (const [a, b] of rings) ctx.shield('{user} e {user1} acharam uma aliança no meio dos bichos: escudos para os dois.', [a, b]);
    return { prizeEarned: earned, shieldIds: rings.flat().map((p) => p.id) };
  },
};

// ---------------------------------------------------------------------------------------------
// Cantigas ao contrário
// ---------------------------------------------------------------------------------------------

const SONGS: readonly string[] = [
  'Atirei o pau no gato',
  'Nana neném que a Cuca vem pegar',
  'Marcha soldado cabeça de papel',
  'Ciranda cirandinha vamos todos cirandar',
  'O cravo brigou com a rosa',
  'Borboletinha tá na cozinha',
  'Se essa rua fosse minha',
  'Escravos de Jó jogavam caxangá',
];

/** A cantiga como a boneca canta: de trás para frente. */
const reversed = (song: string) => [...song.toLowerCase()].reverse().join('');

function nurseryRhymes(origin: string, prizeAvailable: number): MissionDefinition {
  return {
    key: 'nursery-rhymes',
    origin,
    name: 'Cantigas ao Contrário',
    description: 'Uma equipe acha, no bosque, bonecas que cantam cantigas de ninar de trás para frente e repete o som por telefone; no castelo, a outra grava no gramofone, inverte e descobre a cantiga. Um escudo está escondido na casa de bonecas.',
    prizeAvailable,
    play(ctx) {
      const clock = ctx.clock(40);
      const [woods, castle] = ctx.teams(2);
      const per = prizeAvailable / 4;
      ctx.say('Bonecas antigas, cantigas ao contrário e um telefone chiando entre o bosque e o castelo.');
      let earned = 0;
      const shieldFinder = ctx.happens(0.8) ? ctx.pick(1, (p) => p.traits.insight + p.traits.skill, woods)[0] : undefined;
      const songs = shuffle(ctx.rng, SONGS);
      for (let rhyme = 1; rhyme <= 4; rhyme++) {
        // O jogador faz a primeira cantiga da equipe dele (no bosque, ouvindo; no castelo, cantando).
        const humanTurn = rhyme === 1 && ctx.human && ctx.players.includes(ctx.human) ? ctx.human : undefined;
        const listener = humanTurn && woods.includes(humanTurn) ? humanTurn : ctx.pick(1, (p) => p.traits.skill, woods)[0];
        const singer = humanTurn && castle.includes(humanTurn) ? humanTurn : castle.length ? ctx.pick(1, (p) => p.traits.sociability + p.traits.skill, castle)[0] : listener;
        if (humanTurn) {
          const song = songs[rhyme - 1];
          const inWoods = woods.includes(humanTurn);
          const guess = ctx.ask({
            id: 'nursery-rhyme',
            prompt: inWoods
              ? `Cantiga ${rhyme}: a boneca do bosque canta, de trás para frente: "${reversed(song)}". Qual cantiga é essa? (A equipe do castelo depende de você.)`
              : `Cantiga ${rhyme}: pelo telefone, {user} repete o som da boneca: "${reversed(song)}". Você grava no gramofone e inverte. Qual cantiga é essa?`,
            playerIds: inWoods ? [] : [listener.id],
            options: shuffle(ctx.rng, [song, ...songs.filter((s) => s !== song).slice(0, 2)]).map((s) => ({ id: s, label: s })),
          });
          clock.spend(8 + ctx.rng() * 4);
          const otherSide = inWoods ? ctx.attempt(singer, 50, castle) : ctx.attempt(listener, 55, woods);
          if (guess === song && otherSide) {
            earned += per;
            ctx.say(`Cantiga ${rhyme}: {user} reconheceu "${song}" e a equipe acertou no gramofone.`, [humanTurn]);
          } else if (guess === song) {
            ctx.say(`Cantiga ${rhyme}: {user} reconheceu "${song}", mas a outra ponta do telefone embaralhou a letra.`, [humanTurn]);
          } else {
            ctx.say(`Cantiga ${rhyme}: {user} apostou em "${guess}". Era "${song}".`, [humanTurn]);
          }
          continue;
        }
        let minutes = 7 + ctx.rng() * 5;
        if (ctx.happens(0.2)) {
          minutes += 4;
          ctx.say(`Cantiga ${rhyme}: a linha caiu no meio da ligação. {user} correu de volta até a boneca.`, [listener]);
        }
        if (!clock.spend(minutes)) {
          ctx.say(`O tempo acabou antes da cantiga ${rhyme}.`);
          break;
        }
        if (ctx.attempt(listener, 55, woods) && ctx.attempt(singer, 50, castle)) {
          earned += per;
          ctx.say(`Cantiga ${rhyme}: {user} decorou o som e {user1} descobriu a cantiga no gramofone.`, pair(listener, singer));
        } else {
          ctx.say(`Cantiga ${rhyme}: entre o telefone de {user} e a voz de {user1}, a letra se perdeu.`, pair(listener, singer));
        }
      }
      ctx.chatter(2);
      if (shieldFinder) ctx.shield('Na casa de bonecas, {user} achou o escudo escondido.', [shieldFinder]);
      return { prizeEarned: roundMoney(earned, stepOf(origin)), shieldIds: shieldFinder ? [shieldFinder.id] : [] };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// O xadrez humano
// ---------------------------------------------------------------------------------------------

function chess(origin: string, prizeAvailable: number, perAnswer: number): MissionDefinition {
  const uk = origin === UK;
  return {
    key: 'chess',
    origin,
    name: 'O Xadrez Humano',
    description: `Os Traidores responderam em segredo a perguntas sobre o elenco. No tabuleiro gigante, o grupo põe as peças nos nomes que acha que os Traidores escolheram; cada acerto vale dinheiro.${uk ? ' No fim, cada um escolhe um baú, e um deles guarda um escudo.' : ''}`,
    prizeAvailable,
    play(ctx) {
      const traitors = ctx.players.filter(isTraitor);
      const faithful = ctx.players.filter((p) => !isTraitor(p));
      const avgFrom = (from: readonly SimPlayer[], f: (a: SimPlayer) => number) => (from.length ? from.reduce((s, a) => s + f(a), 0) / from.length : ctx.rng() * 100);
      const questions: { text: string; answer: () => SimPlayer | undefined; clears: boolean }[] = shuffle(ctx.rng, [
        { text: 'Quem os Traidores consideram a maior ameaça?', answer: () => top(faithful, (p) => avgFrom(traitors, (k) => ctx.matrix.suspicion(p.id, k.id)), 1)[0], clears: true },
        { text: 'Quem os Traidores acham mais fácil de enganar?', answer: () => top(faithful, (p) => avgFrom(traitors, (k) => ctx.matrix.get(p.id, k.id).trust), 1)[0], clears: false },
        { text: 'Quem os Traidores gostariam de levar para a final?', answer: () => top(faithful, (p) => avgFrom(traitors, (k) => ctx.matrix.get(k.id, p.id).liking), 1)[0], clears: false },
        { text: 'Quem os Traidores gostariam de ver banido(a)?', answer: () => top(faithful, (p) => avgFrom(traitors, (k) => ctx.matrix.get(k.id, p.id).hatred), 1)[0], clears: true },
        { text: 'Quem é o(a) jogador(a) mais barulhento(a) do castelo?', answer: () => top(ctx.players, (p) => p.traits.sociability + p.traits.volatility, 1)[0], clears: false },
        { text: 'Quem os Traidores menos gostariam de enfrentar na mesa final?', answer: () => top(faithful, (p) => p.traits.influence + p.traits.paranoia, 1)[0], clears: true },
      ]).slice(0, Math.round(prizeAvailable / perAnswer));
      ctx.say('Um tabuleiro de xadrez gigante com os nomes do elenco. As peças devem cair onde os Traidores apontaram.');
      let earned = 0;
      for (const [i, q] of questions.entries()) {
        const answer = q.answer();
        if (!answer) continue;
        // O jogador move a peça da primeira pergunta.
        const human = i === 0 && ctx.human && ctx.players.includes(ctx.human) ? ctx.human : undefined;
        const guesser = human ?? ctx.pick(1, (p) => p.traits.skill + p.traits.paranoia * 0.5)[0];
        if (human) {
          const knows = isTraitor(human);
          const pick = ctx.ask({
            id: 'chess-piece',
            prompt: `"${q.text}" A peça está nas suas mãos. ${knows ? 'Você é Traidor(a): na torre, vocês responderam {user}. Acertar enche o prêmio; errar de propósito afasta a suspeita das respostas de vocês.' : 'Em que nome você coloca a peça?'}`,
            playerIds: knows ? [answer.id] : [],
            options: personOptions(ctx.players),
          });
          if (pick === answer.id) {
            earned += perAnswer;
            ctx.say(`"${q.text}" {user} moveu a peça para o nome de {user1}. Os Traidores tinham respondido o mesmo.`, pair(human, answer));
            if (q.clears) for (const p of ctx.players) if (p.id !== answer.id && !isTraitor(p)) ctx.matrix.adjust(p.id, answer.id, { trust: 6 });
          } else {
            const wrong = ctx.players.find((p) => p.id === pick) ?? answer;
            ctx.say(`"${q.text}" {user} colocou a peça em {user1}. Errou: a resposta dos Traidores era {user2}.`, [human, wrong, answer]);
            if (knows) ctx.secret('{user} sabia a resposta e errou de propósito.', [human]);
          }
          continue;
        }
        // Um Traidor na mesa pode "errar" de propósito.
        const sabotage = isTraitor(guesser) && ctx.happens(0.3);
        if (!sabotage && ctx.attempt(guesser, 58)) {
          earned += perAnswer;
          ctx.say(`"${q.text}" {user} moveu a peça para o nome de {user1}. Os Traidores tinham respondido o mesmo.`, pair(guesser, answer));
          if (q.clears) for (const p of ctx.players) if (p.id !== answer.id && !isTraitor(p)) ctx.matrix.adjust(p.id, answer.id, { trust: 6 });
        } else {
          ctx.say(`"${q.text}" {user} errou a casa. A resposta dos Traidores era {user1}.`, pair(guesser, answer));
          if (sabotage) ctx.secret('{user} sabia a resposta e errou de propósito.', [guesser]);
        }
        if (i === 1) ctx.chatter(1);
      }
      ctx.chatter(1);
      let chest: SimPlayer | undefined;
      if (uk) {
        chest = ctx.oneOf(ctx.players);
        ctx.shield('Entre os baús, {user} abriu o que guardava o escudo.', [chest]);
      }
      return { prizeEarned: earned, shieldIds: chest ? [chest.id] : [] };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// O poder do Vidente
// ---------------------------------------------------------------------------------------------

/**
 * Os palhaços, para o jogador: estourar balão por balão. Cada um tem ouro ou uma caveira, que leva
 * tudo o que ele juntou na rodada. Parar a tempo guarda o ouro.
 */
function clownsForHuman(ctx: MissionContext, player: SimPlayer, piece: (factor: number) => number): number {
  let gold = 0;
  for (let balloon = 1; balloon <= 4; balloon++) {
    const choice = ctx.ask({
      id: 'seer-balloon',
      prompt:
        balloon === 1
          ? 'Os palhaços seguram balões: cada um tem ouro ou uma caveira. A caveira leva todo o ouro desta rodada. Estourar o primeiro?'
          : `Você já tem ${ctx.money(gold)} nesta rodada. Estourar o balão ${balloon} ou parar e guardar?`,
      playerIds: [],
      options: [
        { id: 'pop', label: `Estourar o balão ${balloon}` },
        { id: 'stop', label: balloon === 1 ? 'Não arriscar' : 'Parar e guardar o ouro' },
      ],
    });
    if (choice === 'stop') break;
    if (chance(ctx.rng, 0.22 + balloon * 0.05)) {
      ctx.say(`{user} estourou o balão ${balloon} e caiu uma caveira. ${gold ? `Os ${ctx.money(gold)} da rodada foram embora.` : 'Nada a perder, mas nada ganho.'}`, [player]);
      return 0;
    }
    gold += piece(0.5 + ctx.rng() * 0.5);
  }
  ctx.say(gold ? `{user} saiu dos palhaços com ${ctx.money(gold)}.` : '{user} não estourou nenhum balão.', [player]);
  return gold;
}

/** Missão do Vidente: sai uma vez, perto da final (ver finale.ts); não entra na sequência normal. */
function seer(origin: string, prizeAvailable: number): MissionDefinition {
  const step = origin === US ? 100 : 50;
  return {
    key: 'seer',
    origin,
    name: 'O Poder do Vidente',
    description: 'Três provas valendo ouro individual: palhaços com balões (ouro ou caveira, que zera a rodada), as cordas da boneca e moedas escondidas no bosque em cinco minutos. Quem juntar mais ouro vira o(a) Vidente e descobre a verdade sobre alguém.',
    prizeAvailable,
    play(ctx) {
      ctx.say('Três provas, ouro individual e um prêmio que vale mais que dinheiro: o poder do Vidente.');
      const banked = new Map<string, number>();
      const cap = prizeAvailable / 3;
      let total = 0;
      const add = (p: SimPlayer, amount: number) => banked.set(p.id, (banked.get(p.id) ?? 0) + amount);

      // 1. Palhaços: cada balão estourado tem ouro ou uma caveira.
      let round = 0;
      const piece = (factor: number) => roundMoney((cap / ctx.players.length) * factor, step);
      for (const p of ctx.players) {
        if (ctx.isHuman(p)) {
          const gold = Math.min(clownsForHuman(ctx, p, piece), cap - round);
          round += gold;
          add(p, gold);
          continue;
        }
        if (!ctx.attempt(p, 50)) continue;
        if (ctx.happens(0.2)) {
          ctx.say('{user} estourou o balão e caiu uma caveira. O ouro da rodada foi embora.', [p]);
          continue;
        }
        const gold = Math.min(roundMoney(cap / ctx.players.length * (0.8 + ctx.rng() * 0.8), step), cap - round);
        round += gold;
        add(p, gold);
      }
      total += round;
      ctx.say(`Os palhaços do terror: ${ctx.money(round)} para o prêmio.`);

      // 2. Cordas da boneca: cada corda puxada revela um valor (às vezes nada).
      round = 0;
      for (const p of ctx.players) {
        let pulled = ctx.oneOf([0, 0.5, 1, 1, 1.5, 2]);
        if (ctx.isHuman(p)) {
          // As seis cordas escondem valores diferentes; o jogador escolhe uma.
          const cords = shuffle(ctx.rng, [0, 0.5, 1, 1, 1.5, 2]);
          const cord = Number(ctx.ask({ id: 'seer-cord', prompt: 'A boneca tem seis cordas. Uma vale o maior prêmio; outra, nada. Qual você puxa?', playerIds: [], options: cords.map((_, i) => ({ id: String(i), label: `Corda ${i + 1}` })) }));
          pulled = cords[cord] ?? 0;
          ctx.say(pulled ? `{user} puxou a corda ${cord + 1}: ${ctx.money(piece(pulled))}.` : `{user} puxou a corda ${cord + 1} e a boneca só riu. Nada.`, [p]);
        }
        const gold = Math.min(roundMoney((cap / ctx.players.length) * pulled, step), cap - round);
        round += gold;
        add(p, gold);
        if (pulled === 2 && gold) ctx.say('{user} puxou a corda de ouro da boneca: o maior valor da rodada.', [p]);
      }
      total += round;
      ctx.say(`As cordas da boneca: ${ctx.money(round)} para o prêmio.`);

      // 3. Moedas no bosque: cinco minutos, quem é rápido dispara.
      round = 0;
      for (const p of shuffle(ctx.rng, ctx.players)) {
        if (!ctx.attempt(p, 55)) continue;
        const gold = Math.min(roundMoney((cap / ctx.players.length) * (0.5 + ctx.rng() * 1.5), step), cap - round);
        round += gold;
        add(p, gold);
      }
      total += round;
      const leader = top(ctx.players, (p) => banked.get(p.id) ?? 0, 1)[0];
      ctx.say(`As moedas do bosque: ${ctx.money(round)}. {user} lidera a disputa pelo poder.`, [leader]);
      ctx.chatter(1);

      const theSeer = top(ctx.players, (p) => (banked.get(p.id) ?? 0) + ctx.rng(), 1)[0];
      ctx.say('{user} juntou mais ouro e ganhou o poder do Vidente. Esta noite, {user} janta a sós com quem quiser e descobre se é Traidor(a) ou Fiel.', [theSeer]);
      ctx.applaud(theSeer, 2);
      ctx.twists.seerId = theSeer.id;
      return { prizeEarned: Math.round(total), shieldIds: [] };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Missão final: o helicóptero
// ---------------------------------------------------------------------------------------------

function helicopter(origin: string, prizeAvailable: number): MissionDefinition {
  const uk = origin === UK;
  return {
    key: 'helicopter',
    origin,
    name: 'O Dia do Juízo Final',
    description: uk
      ? 'Voluntários penduram-se sob um helicóptero com sacos de ouro e precisam soltá-los dentro de um anel de fogo; um jogador fica no castelo guiando pelo rádio. Cada voluntário vale dinheiro e cada saco no anel vale mais.'
      : 'Primeiro, charadas para achar dez sacos de dinheiro pela propriedade em 30 minutos. Depois, duplas penduradas num helicóptero soltam os sacos num anel de fogo: acertar dobra o valor.',
    prizeAvailable,
    play(ctx) {
      if (uk) {
        const radio = byInfluence(ctx.players);
        const brave = ctx.players.filter((p) => p !== radio && ctx.attempt(p, 30 + p.traits.paranoia * 0.3));
        const per = 2500;
        const slots = Math.floor(prizeAvailable / per / 2);
        const flying = brave.slice(0, slots);
        ctx.say(`{user} fica no castelo com o rádio. ${flying.length} voluntário(s) sobem no helicóptero.`, [radio]);
        let earned = flying.length * per;
        for (const p of flying) {
          if (ctx.happens(0.1)) {
            ctx.say('Uma rajada balançou {user} e o saco caiu longe do anel.', [p]);
          } else if (ctx.attempt(p, 55, [radio])) {
            earned += per;
            ctx.say('Guiado(a) pela voz de {user1}, {user} soltou o saco no meio do fogo.', pair(p, radio));
          } else {
            ctx.say('{user} soltou cedo demais. O saco quicou fora do anel.', [p]);
          }
        }
        ctx.chatter(1);
        return { prizeEarned: Math.min(prizeAvailable, earned), shieldIds: [] };
      }

      const clock = ctx.clock(30);
      ctx.say('Parte 1: trinta minutos para decifrar charadas e achar dez sacos de dinheiro.');
      const teams = ctx.teams(2).filter((t) => t.length);
      let bags = 0;
      for (let i = 0; i < 10; i++) {
        if (!clock.spend(2 + ctx.rng() * 2.5)) {
          ctx.say(`O relógio zerou: ${10 - i} saco(s) ficaram escondidos.`);
          break;
        }
        const team = teams[i % teams.length];
        const human = ctx.human && team.includes(ctx.human) && i < teams.length ? ctx.human : undefined;
        if (human) {
          // A primeira charada da equipe do jogador é dele.
          const riddle = ctx.oneOf(RIDDLES);
          const guess = ctx.ask({
            id: 'helicopter-riddle',
            prompt: `A charada que leva ao saco de dinheiro da sua equipe: ${riddle.text}`,
            playerIds: [],
            options: shuffle(ctx.rng, [riddle.answer, ...riddle.wrong]).map((a) => ({ id: a, label: a })),
          });
          if (guess === riddle.answer) bags++;
          ctx.say(guess === riddle.answer ? `{user} matou a charada ("${riddle.answer}") e achou o saco.` : `{user} apostou em "${guess}" e correu para o lugar errado.`, [human]);
          continue;
        }
        const solver = ctx.pick(1, (p) => p.traits.skill + p.traits.insight * 0.3, team)[0];
        if (ctx.attempt(solver, 55, team)) bags++;
      }
      ctx.say(`O grupo encontrou ${bags} de 10 sacos.`);
      ctx.chatter(1);
      const bag = prizeAvailable / 20;
      ctx.say('Parte 2: o helicóptero decola. Cada saco solto dentro do anel de fogo vale o dobro.');
      let earned = 0;
      let pairs = ctx.pairs();
      const human = ctx.human && ctx.players.includes(ctx.human) ? ctx.human : undefined;
      const flies =
        human &&
        bags > 0 &&
        ctx.ask({
          id: 'helicopter-volunteer',
          prompt: `O grupo achou ${bags} saco(s). Voluntários se penduram no helicóptero, em duplas, e soltam os sacos no anel de fogo. Você sobe?`,
          playerIds: [],
          options: [
            { id: 'fly', label: 'Subir no helicóptero' },
            { id: 'ground', label: 'Ficar em terra' },
          ],
        }) === 'fly';
      if (human && !flies) pairs = pairs.filter((d) => !d.includes(human));
      if (human && flies) pairs = [...pairs.filter((d) => d.includes(human)), ...pairs.filter((d) => !d.includes(human))];
      for (let i = 0; i < bags; i++) {
        const duo = pairs[i % Math.max(1, pairs.length)];
        if (!duo) {
          earned += bag;
          continue;
        }
        const [a, b] = duo;
        if (human && flies && i === 0 && duo.includes(human)) {
          const partner = a === human ? b : a;
          const wind = ctx.oneOf(['now', 'wait']);
          const drop = ctx.ask({
            id: 'helicopter-drop',
            prompt: 'Pendurado(a) sob o helicóptero, o anel de fogo passa lá embaixo. O vento sopra forte. Quando você solta o saco?',
            playerIds: [],
            options: [
              { id: 'now', label: 'Soltar agora' },
              { id: 'wait', label: 'Esperar o vento acalmar' },
            ],
          });
          if (chance(ctx.rng, drop === wind ? 0.85 : 0.3)) {
            earned += bag * 2;
            ctx.applaud(human, 4);
            ctx.say('{user} soltou o saco na hora certa: direto no centro do fogo, com {user1} gritando de alegria.', [human, partner]);
          } else {
            earned += bag;
            ctx.say('{user} errou o tempo e o vento levou o saco para fora do anel.', [human]);
          }
          continue;
        }
        if (!ctx.happens(0.08) && ctx.attempt(a, 58, [b])) {
          earned += bag * 2;
          ctx.say('{user} soltou o saco no centro do fogo enquanto {user1} gritava a direção.', [a, b]);
        } else {
          earned += bag;
          ctx.say('O vento levou o saco de {user} para fora do anel.', [a]);
        }
      }
      ctx.chatter(1);
      return { prizeEarned: Math.min(prizeAvailable, earned), shieldIds: [] };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Só no Reino Unido
// ---------------------------------------------------------------------------------------------

const train: MissionDefinition = {
  key: 'train',
  origin: UK,
  name: 'O Trem Fantasma',
  description: 'Um trem a vapor atravessa as Highlands. Três voluntários precisam descer no meio do nada em até dez minutos; cada minuto até o terceiro descer custa dinheiro.',
  prizeAvailable: 10000,
  play(ctx) {
    ctx.say('O trem apita. A ordem: três pessoas devem descer na próxima parada e seguir sozinhas, na chuva.');
    const volunteers: SimPlayer[] = [];
    let minute = 0;
    while (volunteers.length < 3 && minute < 10 && volunteers.length < ctx.players.length) {
      minute++;
      if (minute === 4 && ctx.happens(0.3)) ctx.say('O vagão virou um tribunal: ninguém quer descer, todo mundo quer apontar quem deveria.');
      for (const p of shuffle(ctx.rng, ctx.players)) {
        if (volunteers.includes(p) || volunteers.length >= 3) continue;
        if (chance(ctx.rng, (p.traits.loyalty + (100 - p.traits.paranoia)) / 900)) {
          volunteers.push(p);
          ctx.applaud(p, 4);
          ctx.say(`Minuto ${minute}: {user} se levantou e desceu do trem.`, [p]);
        }
      }
    }
    const earned = volunteers.length < 3 ? 0 : Math.max(0, 10000 - minute * 1000);
    if (volunteers.length < 3) {
      ctx.say('Dez minutos e nem três voluntários. O dinheiro inteiro ficou no trem. Olhares tortos no vagão.');
      const stayed = ctx.players.filter((p) => !volunteers.includes(p));
      for (const p of stayed) for (const q of stayed) if (p !== q && q.traits.paranoia > 60) ctx.matrix.adjust(p.id, q.id, { trust: -2 });
    }
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

const ceremony: MissionDefinition = {
  key: 'ceremony',
  origin: UK,
  name: 'A Cerimônia da Verdade',
  description: 'Todos começam com um escudo. De olhos vendados, cada um aponta quem não merece o seu; se o grupo concorda, o apontado leva um balde de água e perde o escudo, senão quem apontou perde o dele. Acaba quando só três escudos restam.',
  prizeAvailable: 5000,
  play(ctx) {
    ctx.say('Vendas nos olhos, baldes suspensos e um escudo para cada um. No fim, só três vão sobrar.');
    let holders = [...ctx.players];
    const ids = ctx.players.map((p) => p.id);
    let guard = 0;
    while (holders.length > 3 && guard++ < 40) {
      const accuser = ctx.oneOf(holders);
      const target = top(holders.filter((p) => p !== accuser), (p) => ctx.matrix.suspicion(accuser.id, p.id) + ctx.matrix.get(accuser.id, p.id).hatred + ctx.rng() * 25, 1)[0];
      if (!target) break;
      const doubt = 100 - ctx.matrix.toward(target.id, ids).trust;
      if (doubt + (ctx.rng() * 40 - 20) > 50) {
        holders = holders.filter((p) => p !== target);
        ctx.matrix.adjust(target.id, accuser.id, { hatred: 10, trust: -8 });
        ctx.say('{user} apontou {user1}. O grupo concordou e o balde gelado desabou: escudo perdido.', [accuser, target]);
      } else {
        holders = holders.filter((p) => p !== accuser);
        ctx.matrix.adjust(target.id, accuser.id, { hatred: 6 });
        ctx.say('{user} apontou {user1}, mas o grupo discordou. O balde caiu na cabeça de {user}.', [accuser, target]);
      }
    }
    ctx.shield(`Secos(as) e com escudo até o fim: ${tokenList(holders.length)}.`, holders);
    ctx.chatter(2);
    return { prizeEarned: 5000, shieldIds: holders.map((p) => p.id) };
  },
};

const hidden: MissionDefinition = {
  key: 'hidden',
  origin: UK,
  name: 'Os Desaparecidos',
  description: 'Três jogadores foram escondidos pela propriedade. Charadas levam ao primeiro, e cada um encontrado traz a pista do próximo; errar uma charada no tempo quebra a corrente.',
  prizeAvailable: 6500,
  play(ctx) {
    const clock = ctx.clock(45);
    const missing = ctx.pick(Math.min(3, ctx.players.length - 2), () => 1);
    const searchers = ctx.players.filter((p) => !missing.includes(p));
    ctx.say(`Ao amanhecer, ${tokenList(missing.length)} tinham sumido. Só as charadas dizem onde estão.`, missing);
    const values = [2000, 2000, 2500];
    let earned = 0;
    for (const [i, person] of missing.entries()) {
      const team = ctx.pick(Math.min(3, searchers.length), (p) => p.traits.skill + p.traits.insight * 0.5, searchers);
      const inTime = clock.spend(10 + ctx.rng() * 10 + (ctx.happens(0.2) ? 8 : 0));
      const finder = inTime ? team.find((p) => ctx.attempt(p, 55, team)) : undefined;
      if (!finder) {
        ctx.say('A charada venceu o grupo. {user} e quem mais estava escondido(a) voltaram sozinhos, bem irritados.', [person]);
        for (const p of missing.slice(i)) for (const s of searchers) ctx.matrix.adjust(p.id, s.id, { liking: -2 });
        break;
      }
      earned += values[i] ?? 0;
      ctx.matrix.adjust(person.id, finder.id, { liking: 8 });
      ctx.say('{user} decifrou a charada e encontrou {user1} trancado(a) na cripta. No bolso, a próxima pista.', [finder, person]);
    }
    ctx.chatter(2);
    return { prizeEarned: earned, shieldIds: [] };
  },
};

// ---------------------------------------------------------------------------------------------
// As duas temporadas
// ---------------------------------------------------------------------------------------------

/** EUA T3 (2025), na ordem da exibição. */
export const US_SEASON_3_MISSIONS: readonly MissionDefinition[] = [
  longboat(US, 40000),
  cages(US, 15000, 3),
  funHouse(US, 20000, 2000),
  statues(US, 20000, 10),
  portraits,
  gunpowder(US, 30000),
  boxes,
  nurseryRhymes(US, 20000),
  chess(US, 20000, 5000),
];
export const US_SEASON_3_SEER = seer(US, 30000);
export const US_SEASON_3_FINALE = helicopter(US, 50000);

/** Reino Unido T3 (2025), na ordem da exibição. */
export const UK_SEASON_3_MISSIONS: readonly MissionDefinition[] = [
  train,
  gunpowder(UK, 10000),
  longboat(UK, 10000),
  cages(UK, 7450, 2),
  funHouse(UK, 9000, 1000),
  ceremony,
  hidden,
  nurseryRhymes(UK, 10000),
  statues(UK, 10000, 5),
  chess(UK, 10000, 2000),
];
export const UK_SEASON_3_SEER = seer(UK, 12000);
export const UK_SEASON_3_FINALE = helicopter(UK, 30000);
