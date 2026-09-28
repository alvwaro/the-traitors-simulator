import { GamePhase, PhraseTone, SimulationEventKind } from '../enums';
import { surprises } from './chaos';
import { publicSuspicion } from './decisions';
import { HumanInvite, HumanMemory } from './humanActions';
import { NarratedEvent } from './narration';
import { RelationshipMatrix } from './RelationshipMatrix';
import { chance, pickOne, Rng, weightedPick } from './random';
import { AllianceBook, MAX_ALLIANCE } from './alliances';
import {
  APPROACH_CONFRONT,
  APPROACH_HELP,
  APPROACH_AGREE,
  APPROACH_CONFRONT_ACCUSED,
  APPROACH_CONFRONT_VOTED,
  APPROACH_GRIEF,
  APPROACH_SUSPICION,
} from './dialogue/approach-talk';
import {
  APPROACH_ALLY_COMPLAINT,
  APPROACH_ALLY_PLAN,
  APPROACH_FALLOUT_EXPLAIN,
  APPROACH_FALLOUT_FAITHFUL,
  APPROACH_FALLOUT_TOGETHER,
  APPROACH_FALLOUT_TRAITOR,
  APPROACH_PARTNER,
  APPROACH_RUMOR_ALLIANCE,
  APPROACH_RUMOR_FEUD,
} from './dialogue/approach-game';
import {
  APPROACH_GOSSIP_DISLIKE,
  APPROACH_GOSSIP_VOTED,
  APPROACH_IMPRESSION_BAD,
  APPROACH_IMPRESSION_GOOD,
  APPROACH_INVITE_GROUP,
  APPROACH_INVITE_PAIR,
  APPROACH_WARNING_GENERIC,
  APPROACH_WARNING_LEADER,
} from './dialogue/approach-social';
import { pickLine } from './dialogue/lines';
import { tokenList } from './tokens';
import { isTraitor, SimPlayer } from './traits';

/** A última mesa redonda (fica gravada na temporada para as conversas do dia seguinte). */
export interface LastTable {
  day: number;
  banishedId: string;
  /** O banido era traidor(a). */
  traitor: boolean;
  /** O papel foi revelado à mesa (na reta final, não é). */
  revealed?: boolean;
  /** Votos da primeira rodada. */
  votes: { voterId: string; targetId: string }[];
}

/** Momentos em que alguém pode vir falar a sós com o jogador. */
export type ApproachMoment = 'ARRIVAL' | 'BREAKFAST' | 'MISSION';

export interface ApproachInput {
  rng: Rng;
  matrix: RelationshipMatrix;
  alliances: AllianceBook;
  human: SimPlayer;
  /** Quem está no castelo (inclusive o jogador). */
  active: readonly SimPlayer[];
  /** Todos da temporada, para citar quem já saiu. */
  byId: ReadonlyMap<string, SimPlayer>;
  moment: ApproachMoment;
  phase: GamePhase;
  day: number;
  memory: HumanMemory;
  lastTable?: LastTable;
  /** Assassinado(a) desta noite (café da manhã). */
  victim?: SimPlayer;
  chaos?: number;
}

export interface ApproachResult {
  events: NarratedEvent[];
  invites: HumanInvite[];
}

/** Uma conversa possível: quem vem, o quanto a situação pede e o que acontece. */
interface Candidate {
  /** Tipo de conversa: no mesmo momento, cada tipo aparece uma vez só. */
  kind: string;
  npc: SimPlayer;
  score: number;
  run: () => void;
}

/** Quantas pessoas vêm falar com o jogador em cada momento. */
const MAX_APPROACHES: Record<ApproachMoment, number> = { ARRIVAL: 2, BREAKFAST: 3, MISSION: 2 };

/** O que as regras de abordagem compartilham: quem está no castelo, como falar e como propor uma conversa. */
interface ApproachContext {
  input: ApproachInput;
  npcs: SimPlayer[];
  ids: string[];
  pressure: Map<string, number>;
  /** O que cada personagem sente pelo jogador. */
  toHuman: (p: SimPlayer) => Feeling;
  say: Say;
  pick: (lines: readonly string[]) => string;
  add: AddCandidate;
  lastTable?: LastTable;
  /** Em quem o jogador votou na última mesa. */
  humanVote?: string;
  banished?: SimPlayer;
  events: NarratedEvent[];
  invites: HumanInvite[];
}

type Say = (text: string, tone: PhraseTone, cast: readonly SimPlayer[]) => void;
type AddCandidate = (kind: string, npc: SimPlayer, score: number, run: () => void) => void;
type Feeling = ReturnType<RelationshipMatrix['get']>;

/**
 * Strategy: cada regra olha a situação e propõe conversas (candidatas). A chegada tem poucas
 * (ninguém sabe nada do jogo); nos outros momentos, todas valem.
 */
type ApproachRule = (ctx: ApproachContext) => void;

const ARRIVAL_RULES: readonly ApproachRule[] = [inviteRule, impressionRule, (ctx) => rumorRule(ctx, 0.6)];
const GAME_RULES: readonly ApproachRule[] = [
  inviteRule,
  gossipRule,
  warningRule,
  suspicionRule,
  confrontRule,
  helpRule,
  griefRule,
  voteFalloutRule,
  allyRule,
  partnerRule,
  (ctx) => rumorRule(ctx, 1),
];

/**
 * Personagens que vêm falar a sós com o jogador, como no programa: convite para aliança,
 * fofoca ("fulano não gosta de você"), aviso de voto, cobrança pelo voto de ontem, luto,
 * pedido de ajuda... Tudo nasce do que cada um sente de verdade (e traidores mentem).
 * Só o jogador vê essas conversas (e quem assiste à temporada).
 */
export function approachHuman(input: ApproachInput): ApproachResult {
  const { human, active } = input;
  const events: NarratedEvent[] = [];
  const invites: HumanInvite[] = [];
  const npcs = active.filter((p) => p.id !== human.id);
  if (!npcs.length) return { events, invites };

  const candidates: Candidate[] = [];
  const ctx = approachContext(input, npcs, events, invites, candidates);
  for (const rule of input.moment === 'ARRIVAL' ? ARRIVAL_RULES : GAME_RULES) rule(ctx);
  return finish(input, candidates, events, invites);
}

function approachContext(input: ApproachInput, npcs: SimPlayer[], events: NarratedEvent[], invites: HumanInvite[], candidates: Candidate[]): ApproachContext {
  const { rng, matrix, human, active, moment } = input;
  // {user} = cast[0], {user1} = cast[1]...; os ids seguem a ordem em que os marcadores aparecem no texto.
  // O jogador sempre está na conversa (é com ele que vieram falar), mesmo que a frase não cite o nome.
  const say: Say = (text, tone, cast) => {
    const order = [...new Set([...text.matchAll(/\{user(\d*)\}/g)].map((m) => m[0]))];
    const playerIds = order.map((t) => cast[Number(t.replace(/\D/g, '') || 0)].id);
    if (!playerIds.includes(human.id)) playerIds.push(human.id);
    events.push({ kind: SimulationEventKind.APPROACH, tone, text, playerIds, isPrivate: true });
  };
  // A mesma fala não se repete no mesmo momento (duas pessoas não dizem a mesma frase).
  const used = new Set<string>();
  const lastTable = input.lastTable?.day === input.day - 1 && input.lastTable.revealed !== false ? input.lastTable : undefined;
  return {
    input,
    npcs,
    ids: active.map((p) => p.id),
    pressure: publicSuspicion(matrix, active),
    toHuman: (p) => matrix.get(p.id, human.id),
    say,
    pick: (lines) => pickLine(rng, lines, moment, used),
    add: (kind, npc, score, run) => {
      if (score > 0) candidates.push({ kind, npc, score, run });
    },
    lastTable,
    humanVote: lastTable?.votes.find((v) => v.voterId === human.id)?.targetId,
    banished: lastTable ? input.byId.get(lastTable.banishedId) : undefined,
    events,
    invites,
  };
}

/**
 * Convite para aliança: quem confia e gosta de você chama você para uma aliança dele(a) com vaga
 * (fala quem do grupo mais quer você) ou para uma aliança nova, só vocês dois.
 */
function inviteRule(ctx: ApproachContext): void {
  const { input, npcs, toHuman, add } = ctx;
  const { matrix, human, memory } = input;
  const book = input.alliances;
  if (!book.canJoin(human.id)) return;
  const invitedNow = (memory.invites ?? []).filter((i) => i.day === input.day && i.phase === input.phase);
  const inviteScore = (npc: SimPlayer) => {
    const f = toHuman(npc);
    if (f.trust < 58 || f.liking < 50 || f.hatred >= 35) return 0;
    // Traidor adora um fiel aliado: é escudo na mesa redonda.
    const shield = isTraitor(npc) && !isTraitor(human) ? 10 : 0;
    return f.trust - 50 + (f.liking - 50) * 0.5 + npc.traits.loyalty * 0.2 + shield;
  };
  for (const group of book.toJSON()) {
    if (group.memberIds.includes(human.id) || group.memberIds.length >= MAX_ALLIANCE || invitedNow.some((i) => i.groupId === group.id)) continue;
    const members = group.memberIds.map((id) => input.byId.get(id)).filter((p): p is SimPlayer => !!p);
    const speaker = [...members].sort((a, b) => inviteScore(b) - inviteScore(a))[0];
    if (speaker) add('invite', speaker, inviteScore(speaker), inviteTo(ctx, speaker, group.id, members.filter((p) => p !== speaker)));
  }
  for (const npc of npcs) {
    if (matrix.isAllied(npc.id, human.id) || !book.canJoin(npc.id) || invitedNow.some((i) => i.fromId === npc.id && !i.groupId)) continue;
    add('invite', npc, inviteScore(npc), inviteTo(ctx, npc, null, []));
  }
}

function inviteTo(ctx: ApproachContext, npc: SimPlayer, groupId: string | null, others: SimPlayer[]): () => void {
  const { input, say, pick } = ctx;
  return () => {
    if (others.length) {
      const we = others.length === 1 ? 'Eu e {user2}' : `Eu, ${tokenList(others.length, 2)}`;
      say(pick(APPROACH_INVITE_GROUP).replaceAll('{we}', we), PhraseTone.ALLIANCE, [npc, input.human, ...others]);
    } else {
      say(pick(APPROACH_INVITE_PAIR), PhraseTone.ALLIANCE, [npc, input.human]);
    }
    ctx.invites.push({ fromId: npc.id, groupId, memberIds: [npc.id, ...others.map((p) => p.id)], day: input.day, phase: input.phase });
  };
}

/** Primeiras impressões (na chegada ninguém sabe nada do jogo). */
function impressionRule({ input, npcs, toHuman, add, say, pick }: ApproachContext): void {
  const { matrix, human } = input;
  for (const npc of npcs) {
    const f = toHuman(npc);
    if (f.liking >= 66) {
      add('impression', npc, (f.liking - 55) * 0.8 + npc.traits.sociability * 0.2, () => {
        matrix.adjust(npc.id, human.id, { liking: 2 });
        say(pick(APPROACH_IMPRESSION_GOOD), PhraseTone.FRIENDLY, [npc, human]);
      });
    } else if (f.hatred >= 38 || f.liking <= 30) {
      add('impression', npc, (f.hatred - 25) * 0.7 + 8, () => say(pick(APPROACH_IMPRESSION_BAD), PhraseTone.CONFLICT, [npc, human]));
    }
  }
}

/** Fofoca: "fulano não gosta de você" (verdade; traidor pode inventar para sujar um fiel). */
function gossipRule(ctx: ApproachContext): void {
  const { input, npcs, toHuman, add, say, pick, lastTable } = ctx;
  const { matrix, human } = input;
  for (const informer of npcs) {
    const fi = toHuman(informer);
    if (fi.liking < 55 && !matrix.isAllied(informer.id, human.id)) continue;
    const { subject, lie } = gossipSubject(ctx, informer);
    if (!subject) continue;
    const votedYou = lastTable?.votes.some((v) => v.voterId === subject.id && v.targetId === human.id);
    add('gossip', informer, (lie ? 30 : toHuman(subject).hatred * 0.5) + fi.liking * 0.3 + (votedYou ? 12 : 0), () => {
      matrix.adjust(informer.id, human.id, { trust: 2 });
      say(pick(votedYou ? APPROACH_GOSSIP_VOTED : APPROACH_GOSSIP_DISLIKE), PhraseTone.SUSPICION, [informer, human, subject]);
    });
  }
}

/** De quem o informante fala: quem mais odeia o jogador; o traidor pode apontar um fiel que quer ver fora. */
function gossipSubject({ input, npcs, toHuman }: ApproachContext, informer: SimPlayer): { subject?: SimPlayer; lie: boolean } {
  const { matrix, human, rng } = input;
  if (isTraitor(informer) && !isTraitor(human) && chance(rng, informer.traits.deception / 150)) {
    const framed = [...npcs].filter((s) => s.id !== informer.id && !isTraitor(s)).sort((a, b) => matrix.suspicion(b.id, informer.id) - matrix.suspicion(a.id, informer.id))[0];
    if (framed) return { subject: framed, lie: true };
  }
  const enemies = npcs.filter((s) => s.id !== informer.id && (toHuman(s).hatred >= 40 || toHuman(s).trust <= 32));
  return { subject: [...enemies].sort((a, b) => toHuman(b).hatred - toHuman(a).hatred)[0], lie: false };
}

/** Aviso de voto: seu nome está rodando e alguém que gosta de você conta (e quem puxa o coro). */
function warningRule({ input, npcs, pressure, toHuman, add, say, pick }: ApproachContext): void {
  const { matrix, human, moment } = input;
  if (moment === 'BREAKFAST' && input.day <= 1) return;
  const myPressure = pressure.get(human.id) ?? 50;
  const rank = [...pressure.values()].filter((v) => v > myPressure).length;
  if (myPressure < 55 || rank >= 3) return;
  const leader = [...npcs].sort((a, b) => toHuman(a).trust - a.traits.influence * 0.3 - (toHuman(b).trust - b.traits.influence * 0.3))[0];
  for (const warner of npcs) {
    const allied = matrix.isAllied(warner.id, human.id);
    if (warner === leader || (toHuman(warner).liking < 58 && !allied)) continue;
    add('warning', warner, myPressure * 0.8 + (allied ? 15 : 0), () => {
      if (leader && toHuman(leader).trust < 40) say(pick(APPROACH_WARNING_LEADER), PhraseTone.SUSPICION, [warner, human, leader]);
      else say(pick(APPROACH_WARNING_GENERIC), PhraseTone.SUSPICION, [warner, human]);
    });
  }
}

/** Suspeita: quem confia em você conta de quem desconfia (traidor empurra para um fiel). */
function suspicionRule({ input, npcs, pressure, toHuman, add, say, pick }: ApproachContext): void {
  const { matrix, human, memory } = input;
  for (const npc of npcs) {
    const f = toHuman(npc);
    if (f.trust < 55) continue;
    const pool = npcs.filter((p) => p.id !== npc.id && !matrix.isAllied(npc.id, p.id));
    const suspect = isTraitor(npc)
      ? [...pool].filter((p) => !isTraitor(p)).sort((a, b) => (pressure.get(b.id) ?? 0) - (pressure.get(a.id) ?? 0))[0]
      : [...pool].sort((a, b) => matrix.get(npc.id, a.id).trust - matrix.get(npc.id, b.id).trust)[0];
    if (!suspect) continue;
    // Só conta quem desconfia de verdade de alguém; você ter acusado a mesma pessoa aproxima.
    const doubt = matrix.suspicion(npc.id, suspect.id);
    if (doubt < 50) continue;
    const agrees = memory.accused?.includes(suspect.id);
    add('suspicion', npc, (doubt - 40) * 0.5 + f.trust * 0.15 + (agrees ? 12 : 0), () => {
      matrix.adjust(npc.id, human.id, { trust: agrees ? 4 : 2 });
      say(pick(agrees ? APPROACH_AGREE : APPROACH_SUSPICION), agrees ? PhraseTone.ALLIANCE : PhraseTone.SUSPICION, [npc, human, suspect]);
    });
  }
}

/** Tirar satisfação: quem te odeia, quem você acusou ou em quem você votou (e sobreviveu). */
function confrontRule({ input, npcs, toHuman, add, say, pick, humanVote }: ApproachContext): void {
  const { matrix, human, memory } = input;
  for (const npc of npcs) {
    const f = toHuman(npc);
    const voted = humanVote === npc.id;
    const accused = memory.accused?.includes(npc.id);
    if (f.hatred < 50 && !voted && !accused) continue;
    add('confront', npc, f.hatred * 0.9 + (voted || accused ? 20 : 0) * (0.6 + npc.traits.aggression / 125), () => {
      matrix.adjust(npc.id, human.id, { hatred: 2 });
      let confrontation = APPROACH_CONFRONT;
      if (voted) confrontation = APPROACH_CONFRONT_VOTED;
      else if (accused) confrontation = APPROACH_CONFRONT_ACCUSED;
      say(pick(confrontation), PhraseTone.CONFLICT, [npc, human]);
    });
  }
}

/** Pedido de ajuda: quem está na mira procura quem pode defender. */
function helpRule({ input, npcs, pressure, toHuman, add, say, pick }: ApproachContext): void {
  for (const npc of npcs) {
    const press = pressure.get(npc.id) ?? 50;
    if (press < 58 || toHuman(npc).trust < 50) continue;
    add('help', npc, press * 0.6, () => say(pick(APPROACH_HELP), PhraseTone.EMOTION, [npc, input.human]));
  }
}

/** Luto: quem gostava da vítima desabafa com você. */
function griefRule({ input, npcs, toHuman, add, say, pick }: ApproachContext): void {
  const victim = input.victim;
  if (!victim) return;
  for (const npc of npcs) {
    const love = input.matrix.get(npc.id, victim.id).liking;
    if (love < 60 || toHuman(npc).trust < 45) continue;
    add('grief', npc, love * 0.6, () => say(pick(APPROACH_GRIEF), PhraseTone.EMOTION, [npc, input.human, victim]));
  }
}

/** O voto de ontem (no café): cobrança, elogio, explicação ou cumplicidade. */
function voteFalloutRule(ctx: ApproachContext): void {
  const { input, npcs, lastTable, banished } = ctx;
  if (!lastTable || !banished || input.moment !== 'BREAKFAST') return;
  for (const npc of npcs) voteFalloutFor(ctx, npc, lastTable, banished);
}

function voteFalloutFor(ctx: ApproachContext, npc: SimPlayer, lastTable: LastTable, banished: SimPlayer): void {
  const { input, toHuman, add, say, pick, humanVote } = ctx;
  const { matrix, human } = input;
  const f = toHuman(npc);
  const theirVote = lastTable.votes.find((v) => v.voterId === npc.id)?.targetId;
  const votedBanished = humanVote === banished.id;
  if (votedBanished && !lastTable.traitor && matrix.get(npc.id, banished.id).liking >= 60) {
    add('vote', npc, 35 + matrix.get(npc.id, banished.id).liking * 0.3, () => {
      matrix.adjust(npc.id, human.id, { trust: -4, hatred: 3 });
      say(pick(APPROACH_FALLOUT_FAITHFUL), PhraseTone.CONFLICT, [npc, human, banished]);
    });
  } else if (votedBanished && lastTable.traitor && !isTraitor(npc) && f.trust >= 45) {
    add('vote', npc, 30 + f.trust * 0.2, () => {
      matrix.adjust(npc.id, human.id, { trust: 3 });
      say(pick(APPROACH_FALLOUT_TRAITOR), PhraseTone.FRIENDLY, [npc, human, banished]);
    });
  } else if (theirVote === human.id && f.liking >= 50) {
    add('vote', npc, 22 + f.liking * 0.2, () => say(pick(APPROACH_FALLOUT_EXPLAIN), PhraseTone.DEFENSE, [npc, human]));
  } else if (humanVote && theirVote === humanVote && f.trust >= 50) {
    add('vote', npc, 15 + f.trust * 0.15, () => {
      matrix.adjust(npc.id, human.id, { trust: 2 });
      say(pick(APPROACH_FALLOUT_TOGETHER), PhraseTone.ALLIANCE, [npc, human]);
    });
  }
}

/** Aliados: cobram quando você some (no café) e combinam o voto do dia (na missão). */
function allyRule({ input, npcs, pressure, add, say, pick }: ApproachContext): void {
  const { matrix, human, memory, moment } = input;
  for (const ally of npcs.filter((p) => matrix.isAllied(p.id, human.id))) {
    const lastTalk = memory.talkedOn?.[ally.id];
    if (moment === 'BREAKFAST' && input.day >= 2 && (lastTalk === undefined || lastTalk < input.day - 1)) {
      add('ally', ally, 40, () => {
        matrix.adjust(ally.id, human.id, { trust: -3, liking: -2 });
        say(pick(APPROACH_ALLY_COMPLAINT), PhraseTone.EMOTION, [ally, human]);
      });
      continue;
    }
    if (moment !== 'MISSION') continue;
    const group = [ally.id, ...input.alliances.allies(ally.id)];
    const outside = npcs.filter((p) => !group.includes(p.id));
    // O aliado traidor puxa o voto para o fiel mais pressionado; o fiel, para quem ele mais desconfia.
    const target = isTraitor(ally)
      ? outside.filter((p) => !isTraitor(p)).sort((a, b) => (pressure.get(b.id) ?? 0) - (pressure.get(a.id) ?? 0))[0]
      : [...outside].sort((a, b) => matrix.get(ally.id, a.id).trust - matrix.get(ally.id, b.id).trust)[0];
    if (!target) continue;
    add('ally', ally, 38, () => {
      matrix.adjust(ally.id, human.id, { trust: 1 });
      say(pick(APPROACH_ALLY_PLAN), PhraseTone.STRATEGY, [ally, human, target]);
    });
  }
}

/** Parceiros de traição: um recado rápido no corredor sobre o fiel que mais ameaça. */
function partnerRule({ input, npcs, add, say, pick }: ApproachContext): void {
  const { matrix, human } = input;
  if (!isTraitor(human)) return;
  const partners = npcs.filter(isTraitor);
  const tower = [human, ...partners];
  const threat = npcs.filter((p) => !isTraitor(p)).sort((a, b) => threatTo(matrix, b, tower) - threatTo(matrix, a, tower))[0];
  if (!threat) return;
  for (const partner of partners) {
    add('partner', partner, 30 + threatTo(matrix, threat, tower) * 0.3, () => say(pick(APPROACH_PARTNER), PhraseTone.STRATEGY, [partner, human, threat]));
  }
}

/** Fofoca sobre os outros: quem anda cochichando junto, quem não suporta quem (fatos, não invenção). */
function rumorRule({ input, npcs, add, say, pick }: ApproachContext, weight: number): void {
  const { matrix, human, rng } = input;
  for (const npc of npcs) {
    const f = matrix.get(npc.id, human.id);
    if (f.liking < 50 || npc.traits.sociability < 45) continue;
    const others = npcs.filter((p) => p.id !== npc.id);
    // Uma aliança que não é a dele(a) nem a sua.
    const mine = [npc.id, ...input.alliances.allies(npc.id)];
    const pair = others.flatMap((a) => others.filter((b) => a.id < b.id && matrix.isAllied(a.id, b.id) && !mine.includes(a.id)).map((b) => [a, b] as const));
    const couple = pickOne(rng, pair);
    if (couple && !matrix.isAllied(human.id, couple[0].id) && !matrix.isAllied(human.id, couple[1].id)) {
      add('rumor', npc, (20 + npc.traits.sociability * 0.25) * weight, () => say(pick(APPROACH_RUMOR_ALLIANCE), PhraseTone.NEUTRAL, [npc, human, ...couple]));
    }
    const feud = others.flatMap((a) => others.filter((b) => a !== b && matrix.get(a.id, b.id).hatred >= 60).map((b) => [a, b] as const));
    const rivals = pickOne(rng, feud);
    if (rivals) {
      add('rumor', npc, (18 + npc.traits.sociability * 0.2) * weight, () => say(pick(APPROACH_RUMOR_FEUD), PhraseTone.NEUTRAL, [npc, human, ...rivals]));
    }
  }
}

/** Quanto um fiel desconfia de um grupo (média). */
function threatTo(matrix: RelationshipMatrix, faithful: SimPlayer, group: readonly SimPlayer[]): number {
  return group.reduce((sum, p) => sum + matrix.suspicion(faithful.id, p.id), 0) / Math.max(1, group.length);
}

/** Sorteia quem vem falar (cada um vem uma vez só), pesando pelo quanto a situação pede. */
function finish(input: ApproachInput, candidates: Candidate[], events: NarratedEvent[], invites: HumanInvite[]): ApproachResult {
  const { rng, moment } = input;
  const wanted = Math.min(MAX_APPROACHES[moment], Math.max(1, Math.round(candidates.length / 4)));
  const came = new Set<string>();
  const pool = [...candidates];
  for (let i = 0; i < wanted && pool.length; i++) {
    const chosen = surprises(rng, input.chaos ?? 0) ? pickOne(rng, pool) : weightedPick(rng, pool, (c) => Math.max(1, c.score) ** 1.6);
    if (!chosen) break;
    chosen.run();
    came.add(chosen.npc.id);
    for (let j = pool.length - 1; j >= 0; j--) if (came.has(pool[j].npc.id) || pool[j].kind === chosen.kind) pool.splice(j, 1);
  }
  return { events, invites };
}
