import { GamePhase, PhraseTone, SimulationEventKind } from '../enums';
import { surprises } from './chaos';
import { MurderReason, publicSuspicion, traitorPreference } from './decisions';
import { NarratedEvent } from './narration';
import { RelationshipMatrix } from './RelationshipMatrix';
import { chance, clamp, gameRng, pickOne, Rng, shuffle } from './random';
import { AllianceBook, MAX_ALLIANCE, MAX_ALLIANCES_PER_PLAYER } from './alliances';
import { Moment, pickLine } from './dialogue/lines';
import { SAY_ACCUSE, SAY_INSULT, SAY_SUSPECT } from './dialogue/player-attack';
import { SAY_ALLIANCE, SAY_DEFEND, SAY_JOKE, SAY_PRAISE, SAY_TRUST } from './dialogue/player-support';
import { SAY_ASK, SAY_ASK_ABOUT, SAY_PERSUADE_GUILTY, SAY_PERSUADE_INNOCENT } from './dialogue/player-talk';
import { SAY_TOWER_ASK, SAY_TOWER_KILL, SAY_TOWER_RECRUIT, SAY_TOWER_SPARE } from './dialogue/player-tower';
import { CALM_DENIAL, REPLY_ACCUSE, REPLY_INSULT, REPLY_SUSPECT } from './dialogue/replies-attack';
import {
  PERSUADE_GUILTY_MAYBE,
  PERSUADE_GUILTY_NO,
  PERSUADE_GUILTY_YES,
  PERSUADE_INNOCENT_MAYBE,
  PERSUADE_INNOCENT_NO,
  PERSUADE_INNOCENT_YES,
  TELL_ON,
} from './dialogue/replies-persuade';
import { REPLY_ALLIANCE_NO, REPLY_ALLIANCE_YES, REPLY_DEFEND, REPLY_JOKE, REPLY_PRAISE, REPLY_TRUST } from './dialogue/replies-support';
import { REPLY_ASK_NAME, REPLY_ASK_REFUSE, REPLY_ASK_YOU, REPLY_FIRST_IMPRESSION, REPLY_OPINION } from './dialogue/replies-talk';
import {
  ALLIANCE_ALREADY,
  ALLIANCE_FULL,
  INVITE_DECLINE_HURT,
  INVITE_DECLINE_OK,
  TOWER_ANSWER,
  TOWER_KILL_NO,
  TOWER_KILL_SAME,
  TOWER_KILL_YES,
  TOWER_RECRUIT_NO,
  TOWER_RECRUIT_YES,
  TOWER_SPARE_NO,
  TOWER_SPARE_YES,
} from './dialogue/replies-tower';
import { tokenList } from './tokens';
import { isTraitor, SimPlayer } from './traits';

/** O que o jogador humano pode fazer ao clicar na foto de alguém. */
export const HUMAN_ACTIONS = [
  'ACCUSE',
  'SUSPECT',
  'DEFEND',
  'TRUST',
  'PRAISE',
  'JOKE',
  'INSULT',
  'ALLIANCE',
  'ASK',
  'ASK_ABOUT',
  'PERSUADE_GUILTY',
  'PERSUADE_INNOCENT',
  'TOWER_ASK',
  'TOWER_KILL',
  'TOWER_SPARE',
  'TOWER_RECRUIT',
] as const;
export type HumanAction = (typeof HUMAN_ACTIONS)[number];

/** Ações que falam de uma terceira pessoa (escolhida depois de clicar em quem ouve). */
export const SUBJECT_ACTIONS: readonly HumanAction[] = ['ASK_ABOUT', 'PERSUADE_GUILTY', 'PERSUADE_INNOCENT', 'TOWER_KILL', 'TOWER_SPARE', 'TOWER_RECRUIT'];
/** Conversas da torre (só com os outros traidores). */
export const TOWER_ACTIONS: readonly HumanAction[] = ['TOWER_ASK', 'TOWER_KILL', 'TOWER_SPARE', 'TOWER_RECRUIT'];
/** Na chegada ninguém sabe nada do jogo: só dá para se apresentar, criar laços (ou antipatias). */
export const ARRIVAL_ACTIONS: readonly HumanAction[] = ['TRUST', 'PRAISE', 'JOKE', 'INSULT', 'ALLIANCE', 'ASK_ABOUT'];

/** O que o jogador pode dizer neste momento. */
export function actionsFor(phase: GamePhase | null, towerTalk: boolean): HumanAction[] {
  if (towerTalk) return [...TOWER_ACTIONS];
  if (phase === GamePhase.ARRIVAL) return [...ARRIVAL_ACTIONS];
  return HUMAN_ACTIONS.filter((a) => !TOWER_ACTIONS.includes(a));
}

/**
 * Memória do jogador humano (fica em sim_state): quem ele acusou ou defendeu, quantas vezes
 * acertou/errou (vira credibilidade) e o que combinou com os outros traidores na torre de hoje.
 */
export interface HumanMemory {
  accused?: string[];
  defended?: string[];
  hits?: number;
  misses?: number;
  tower?: { day: number; pledges: Record<string, string>; spares: Record<string, string[]>; recruits: Record<string, string> };
  /** Convites para aliança esperando resposta (valem só no momento em que foram feitos). */
  invites?: HumanInvite[];
  /** Último dia em que o jogador conversou com cada um (aliado esquecido cobra). */
  talkedOn?: Record<string, number>;
}

/** Um personagem chamou o jogador para a aliança dele(a). */
export interface HumanInvite {
  fromId: string;
  /** A aliança para a qual o jogador foi chamado; null = uma aliança nova, só com quem convidou. */
  groupId: string | null;
  /** Quem estava nessa aliança no momento do convite (inclusive quem convidou). */
  memberIds: string[];
  day: number;
  phase: GamePhase;
}

export interface HumanActionInput {
  rng: Rng;
  matrix: RelationshipMatrix;
  human: SimPlayer;
  /** Com quem o jogador fala. */
  target: SimPlayer;
  /** De quem se fala (convencer, perguntar sobre, torre). */
  subject?: SimPlayer;
  /** Quem está no lugar (todo o castelo, ou só os traidores na torre). */
  present: readonly SimPlayer[];
  /** Todos os ativos (a torre precisa saber quem são os fiéis). */
  active: readonly SimPlayer[];
  action: HumanAction;
  phase: GamePhase;
  day: number;
  /** Morto(a) da última noite, citado(a) no café da manhã. */
  victim?: SimPlayer;
  memory: HumanMemory;
  dungeonIds?: readonly string[];
  chaos?: number;
  /** As alianças da temporada (a mesma pessoa pode estar em várias). */
  alliances: AllianceBook;
}

type Mood = 'good' | 'neutral' | 'bad';
type Cast = { user?: SimPlayer; user1?: SimPlayer; user2?: SimPlayer };

/** Momentos em que todo mundo ouve (nos outros, só parte do grupo). */
const PUBLIC_PHASES: GamePhase[] = [GamePhase.BREAKFAST, GamePhase.ROUND_TABLE, GamePhase.ENDGAME_ROUND_TABLE];
/** Conversas a dois: ninguém mais ouve. */
const PRIVATE: readonly HumanAction[] = ['TRUST', 'ALLIANCE', 'ASK', 'ASK_ABOUT', 'PERSUADE_GUILTY', 'PERSUADE_INNOCENT', ...TOWER_ACTIONS];

export const REASON_TEXT: Record<MurderReason, string> = {
  THREAT: 'está desconfiando de nós',
  HATE: 'eu não suporto essa pessoa',
  INFLUENCE: 'manda na mesa redonda',
  POPULAR: 'todo mundo gosta; o choque vai confundir o castelo',
  EASY: 'é o alvo mais seguro',
};

// ------------------------------------------------------------------ falas

function momentOf(phase: GamePhase): Moment {
  switch (phase) {
    case GamePhase.ARRIVAL:
      return 'ARRIVAL';
    case GamePhase.BREAKFAST:
      return 'BREAKFAST';
    case GamePhase.MISSION:
      return 'MISSION';
    case GamePhase.ROUND_TABLE:
      return 'TABLE';
    case GamePhase.ENDGAME_ROUND_TABLE:
      return 'FINAL';
    default:
      return 'TOWER';
  }
}

/** Fala do jogador: {user} = jogador, {user1} = com quem fala, {user2} = de quem fala (ou a vítima). */
const SAYS: Record<HumanAction, readonly string[]> = {
  ACCUSE: SAY_ACCUSE,
  SUSPECT: SAY_SUSPECT,
  DEFEND: SAY_DEFEND,
  TRUST: SAY_TRUST,
  PRAISE: SAY_PRAISE,
  JOKE: SAY_JOKE,
  INSULT: SAY_INSULT,
  ALLIANCE: SAY_ALLIANCE,
  ASK: SAY_ASK,
  ASK_ABOUT: SAY_ASK_ABOUT,
  PERSUADE_GUILTY: SAY_PERSUADE_GUILTY,
  PERSUADE_INNOCENT: SAY_PERSUADE_INNOCENT,
  TOWER_ASK: SAY_TOWER_ASK,
  TOWER_KILL: SAY_TOWER_KILL,
  TOWER_SPARE: SAY_TOWER_SPARE,
  TOWER_RECRUIT: SAY_TOWER_RECRUIT,
};

/** Falas que dependem da situação e têm prioridade sobre as do banco. */
function specialSay(input: HumanActionInput, pressure: number): string | null {
  const { action, matrix, human, target, victim, rng } = input;
  const allied = matrix.isAllied(human.id, target.id);
  // Só às vezes: o banco é grande e deve aparecer mais.
  if (!chance(rng, 0.35)) return null;
  if (action === 'ACCUSE' && allied) return '{user} quebrou a aliança na frente de todos: "Eu confiei em você, {user1}. Mas é você."';
  if (action === 'ACCUSE' && victim && momentOf(input.phase) === 'BREAKFAST') {
    return pickOne(rng, ['{user} encarou {user1}: "Onde você estava quando {user2} morreu?"', '"{user2} desconfiava de você, {user1}. E agora {user2} não está aqui", disse {user}.'])!;
  }
  if (action === 'ACCUSE' && pressure >= 60) return '{user} engrossou o coro contra {user1}: "Todo mundo já sabe. Só falta admitir."';
  if (action === 'DEFEND' && pressure >= 60) return 'Quando todos se viraram contra {user1}, {user} ficou do lado: "Vocês estão errando feio."';
  if (action === 'DEFEND' && allied) return '{user} defendeu o(a) aliado(a) {user1} com unhas e dentes.';
  if (action === 'JOKE' && victim && momentOf(input.phase) === 'BREAKFAST') return '{user} brincou com {user1}: "Pelo menos sobra mais bacon." Humor ácido, logo depois de {user2}.';
  return null;
}

/** Respostas por humor de quem responde: {user} = quem responde, {user1} = jogador. */
const REPLIES: Partial<Record<HumanAction, Record<Mood, readonly string[]>>> = {
  ACCUSE: REPLY_ACCUSE,
  SUSPECT: REPLY_SUSPECT,
  DEFEND: REPLY_DEFEND,
  TRUST: REPLY_TRUST,
  PRAISE: REPLY_PRAISE,
  JOKE: REPLY_JOKE,
  INSULT: REPLY_INSULT,
};

/** "O que você acha de...": o nível da resposta segue a confiança real (ou a mentira do traidor). */
function opinionLevel(trust: number): keyof typeof REPLY_OPINION {
  if (trust >= 75) return 'certain';
  if (trust >= 58) return 'faithful';
  if (trust >= 42) return 'unsure';
  if (trust >= 25) return 'doubt';
  return 'traitor';
}

/** Primeira impressão (chegada): segue a simpatia. */
function impressionLevel(liking: number): keyof typeof REPLY_FIRST_IMPRESSION {
  if (liking >= 70) return 'love';
  if (liking >= 55) return 'like';
  if (liking >= 40) return 'meh';
  if (liking >= 25) return 'dislike';
  return 'hate';
}

// ------------------------------------------------------------------ motor

type Reply = (text: string, tone?: PhraseTone | null, subject?: SimPlayer) => void;

/**
 * Aplica uma conversa do jogador humano e devolve as linhas da narrativa:
 *  - quem ouve depende do momento (café, mesa redonda e mesa final: todos; chegada e missão: parte do grupo;
 *    conversas a dois: ninguém);
 *  - o peso de cada fala depende da credibilidade do jogador (quanto cada um confia nele e o histórico de
 *    acertos/erros nas acusações);
 *  - atacar alguém mexe com os amigos e inimigos dessa pessoa; defender também.
 */
export function performHumanAction(input: HumanActionInput): NarratedEvent[] {
  const talk = new Conversation(input);
  input.memory.talkedOn = { ...(input.memory.talkedOn ?? {}), [input.target.id]: input.day };
  // Fala do jogador; depois, o efeito da ação (Command: um handler por ação) e a reação da sala.
  talk.say(specialSay(input, talk.pressure) ?? talk.pick(SAYS[input.action]), toneOf(input.action));
  ACTION_HANDLERS[input.action](talk);
  talk.roomReaction();
  return talk.events;
}

/** Tudo que uma conversa precisa: quem ouve, o quanto acredita e como a sala reage. */
class Conversation {
  readonly events: NarratedEvent[] = [];
  readonly moment: Moment;
  readonly pressure: number;
  /** Quem ouve a fala (conversa particular: ninguém). */
  readonly hearers: SimPlayer[];
  readonly convinced: SimPlayer[] = [];
  readonly upset: SimPlayer[] = [];
  readonly pleased: SimPlayer[] = [];
  /** Elogiar e defender nem sempre rendem resposta ou comentário da sala. */
  readonly quiet: boolean;
  private readonly roomQuiet: boolean;
  private readonly used = new Set<string>();
  private readonly secret: boolean;
  private readonly record: number;

  constructor(readonly input: HumanActionInput) {
    const { rng, matrix, human, target, present, action, memory } = input;
    this.moment = momentOf(input.phase);
    this.pressure = publicSuspicion(matrix, input.active).get(target.id) ?? 50;
    this.secret = PRIVATE.includes(action);
    const gentle = action === 'PRAISE' || action === 'DEFEND';
    this.quiet = gentle && chance(rng, 0.45);
    this.roomQuiet = gentle && chance(rng, 0.5);
    // Ninguém compra a palavra de um desconhecido de primeira; acertos e erros passados pesam.
    this.record = clamp(1 + 0.12 * (memory.hits ?? 0) - 0.22 * (memory.misses ?? 0), 0.4, 1.7);
    const others = present.filter((p) => p.id !== human.id && p.id !== target.id);
    this.hearers = whoHears(action, input.phase, others, rng);
  }

  /** Quanto o alvo reage a uma afronta (temperamento e rancor). */
  get heat(): number {
    const { target } = this.input;
    return (0.6 + target.traits.volatility / 100) * (0.6 + target.traits.grudge / 125);
  }

  /** Sorteia uma frase do banco que combine com o momento (sem repetir dentro desta conversa). */
  pick(lines: readonly string[]): string {
    return pickLine(this.input.rng, lines, this.moment, this.used);
  }

  /** O quanto `listener` acredita no jogador. */
  credibility(listener: SimPlayer): number {
    const { matrix, human } = this.input;
    return clamp((matrix.get(listener.id, human.id).trust / 100) * (0.5 + human.traits.influence / 140) * this.record, 0.05, 1.5);
  }

  /** Humor de quem responde ao jogador. */
  mood(): Mood {
    return mood(this.input.matrix, this.input.target, this.input.human);
  }

  say(text: string, tone: PhraseTone): void {
    const { human, target, subject, victim } = this.input;
    this.emit(SimulationEventKind.PLAYER, tone, text, { user: human, user1: target, user2: subject ?? victim });
  }

  readonly reply: Reply = (text, tone = null, about = this.input.subject) => {
    this.emit(SimulationEventKind.REACTION, tone, text, { user: this.input.target, user1: this.input.human, user2: about });
  };

  /** Amigos e inimigos de quem foi atacado (sign < 0) ou defendido (sign > 0) reagem a você. */
  ripple(about: SimPlayer, sign: 1 | -1, strength = 1): void {
    const { matrix, human } = this.input;
    for (const l of this.hearers) {
      if (l.id === about.id) continue;
      const f = matrix.get(l.id, about.id);
      const vol = (0.6 + l.traits.volatility / 100) * strength;
      if (f.liking >= 65 || f.allied) {
        matrix.adjust(l.id, human.id, sign < 0 ? { trust: -8, liking: -7 } : { trust: 3, liking: 6 }, vol);
        (sign < 0 ? this.upset : this.pleased).push(l);
      } else if (f.hatred >= 55) {
        matrix.adjust(l.id, human.id, sign < 0 ? { trust: 3, liking: 5 } : { trust: -4, liking: -4 }, vol);
        (sign < 0 ? this.pleased : this.upset).push(l);
      }
    }
  }

  /** Quem ouviu muda a opinião sobre `about` na medida em que acredita no jogador. */
  sway(about: SimPlayer, base: number, perCredibility: number): void {
    const { matrix } = this.input;
    const sign = Math.sign(perCredibility);
    for (const l of this.hearers) {
      if (l.id === about.id || (isTraitor(l) && isTraitor(about))) continue;
      const c = this.credibility(l);
      // Quem já pensava parecido é mais fácil de mover; quem gosta muito de `about` resiste.
      const f = matrix.get(l.id, about.id);
      const agrees = sign < 0 ? (60 - f.trust) / 100 : (f.trust - 40) / 100;
      const resist = sign < 0 ? Math.max(0, f.liking - 60) / 120 : Math.max(0, f.hatred - 50) / 120;
      const weight = clamp(1 + agrees - resist, 0.5, 1.5);
      matrix.adjust(l.id, about.id, { trust: sign * (Math.abs(base) + Math.abs(perCredibility) * c) * weight });
      if (c * weight >= 0.35) this.convinced.push(l);
    }
  }

  /** Como a sala reagiu (o que qualquer um perceberia ali). */
  roomReaction(): void {
    const moved = this.convinced.filter((p) => !this.upset.includes(p));
    if (this.roomQuiet || (!moved.length && !this.upset.length && !this.pleased.length)) return;
    const cast: SimPlayer[] = [];
    const names = (group: SimPlayer[]) => {
      const unique = [...new Map(group.map((p) => [p.id, p])).values()].slice(0, 3);
      cast.push(...unique);
      return tokenList(unique.length, cast.length - unique.length);
    };
    const parts: string[] = [];
    if (moved.length) parts.push(`${names(moved)} ${moved.length > 1 ? 'pareceram concordar' : 'pareceu concordar'}`);
    if (this.upset.length) parts.push(`${names(this.upset)} ${this.upset.length > 1 ? 'fecharam' : 'fechou'} a cara para você`);
    if (this.pleased.length) parts.push(`${names(this.pleased)} ${this.pleased.length > 1 ? 'gostaram' : 'gostou'} de ouvir isso`);
    this.events.push({ kind: SimulationEventKind.REACTION, tone: null, text: `No salão: ${parts.join('; ')}.`, playerIds: cast.map((p) => p.id) });
  }

  private emit(kind: SimulationEventKind, tone: PhraseTone | null, text: string, cast: Cast): void {
    const order = [...new Set([...text.matchAll(/\{user\d*\}/g)].map((m) => m[0]))];
    const byToken: Record<string, SimPlayer | undefined> = { '{user}': cast.user, '{user1}': cast.user1, '{user2}': cast.user2 };
    const playerIds = order.map((t) => byToken[t]!.id);
    // Conversa particular: o jogador sempre está nela, mesmo quando a frase não cita o nome dele.
    if (this.secret && !playerIds.includes(this.input.human.id)) playerIds.push(this.input.human.id);
    this.events.push({ kind, tone, text, playerIds, ...(this.secret && { isPrivate: true }) });
  }
}

/** Command: o efeito de cada ação do jogador nos sentimentos do castelo e a resposta de quem ouviu. */
const ACTION_HANDLERS: Record<HumanAction, (talk: Conversation) => void> = {
  ACCUSE: accuse,
  SUSPECT: (talk) => {
    const { matrix, human, target } = talk.input;
    matrix.adjust(target.id, human.id, { trust: -6, hatred: 5 }, talk.heat);
    matrix.adjust(human.id, target.id, { trust: -10 });
    talk.sway(target, -5, -10);
    talk.ripple(target, -1, 0.5);
    talk.reply(talk.pick(REPLY_SUSPECT[talk.mood()]));
  },
  DEFEND: (talk) => {
    const { matrix, human, target, memory } = talk.input;
    matrix.adjust(target.id, human.id, { liking: 8, trust: 8 });
    matrix.adjust(human.id, target.id, { trust: 10 });
    talk.sway(target, 6, 13);
    talk.ripple(target, 1);
    memory.defended = [...new Set([...(memory.defended ?? []), target.id])];
    memory.accused = (memory.accused ?? []).filter((id) => id !== target.id);
    if (!talk.quiet) talk.reply(talk.pick(REPLY_DEFEND[talk.mood()]), PhraseTone.FRIENDLY);
  },
  TRUST: (talk) => {
    const { matrix, human, target } = talk.input;
    matrix.adjust(target.id, human.id, { trust: 9, liking: 4 });
    matrix.adjust(human.id, target.id, { trust: 12 });
    talk.reply(talk.pick(REPLY_TRUST[talk.mood()]), PhraseTone.ALLIANCE);
  },
  PRAISE: (talk) => {
    const { matrix, human, target } = talk.input;
    const wary = matrix.get(target.id, human.id).hatred > 50;
    matrix.adjust(target.id, human.id, { liking: wary ? 4 : 10 });
    matrix.adjust(human.id, target.id, { liking: 8 });
    talk.ripple(target, 1, 0.4);
    for (const l of talk.hearers) matrix.adjust(l.id, human.id, { liking: 1 });
    if (!talk.quiet) talk.reply(talk.pick(REPLY_PRAISE[talk.mood()]), PhraseTone.FRIENDLY);
  },
  JOKE: joke,
  INSULT: (talk) => {
    const { matrix, human, target, alliances } = talk.input;
    matrix.adjust(target.id, human.id, { hatred: 18, liking: -12, trust: -6 }, talk.heat);
    matrix.adjust(human.id, target.id, { hatred: 15, liking: -8 });
    if (matrix.isAllied(human.id, target.id)) alliances.leaveWith(human.id, target.id);
    talk.ripple(target, -1, 1.2);
    talk.reply(talk.pick(REPLY_INSULT[talk.mood()]), PhraseTone.CONFLICT);
  },
  ALLIANCE: proposeAlliance,
  ASK: (talk) => ask(talk.input, talk.reply),
  ASK_ABOUT: askAbout,
  PERSUADE_GUILTY: (talk) => persuadeWith(talk),
  PERSUADE_INNOCENT: (talk) => persuadeWith(talk),
  TOWER_ASK: (talk) => tower(talk.input, talk.reply),
  TOWER_KILL: (talk) => tower(talk.input, talk.reply),
  TOWER_SPARE: (talk) => tower(talk.input, talk.reply),
  TOWER_RECRUIT: (talk) => tower(talk.input, talk.reply),
};

function accuse(talk: Conversation): void {
  const { rng, matrix, human, target, memory, alliances } = talk.input;
  // Acusar um aliado rompe a aliança.
  if (matrix.isAllied(human.id, target.id)) {
    for (const id of alliances.leaveWith(human.id, target.id)) if (id !== target.id) matrix.adjust(id, human.id, { trust: -8 });
    matrix.adjust(target.id, human.id, { hatred: 20, trust: -20 });
  }
  matrix.adjust(target.id, human.id, { trust: -14, hatred: 14 }, talk.heat);
  matrix.adjust(human.id, target.id, { trust: -20 });
  talk.sway(target, -7, -17);
  talk.ripple(target, -1);
  // Acusar logo na chegada, sem motivo, pega mal.
  if (talk.moment === 'ARRIVAL') for (const l of talk.hearers) matrix.adjust(l.id, human.id, { trust: -4 });
  // Quem acusa todo mundo vira alvo: cada acusação nova pesa mais para quem não se convenceu.
  const loud = (memory.accused ?? []).filter((id) => id !== target.id).length;
  if (loud >= 2) for (const l of talk.hearers) if (!talk.convinced.includes(l)) matrix.adjust(l.id, human.id, { trust: -Math.min(6, loud) });
  memory.accused = [...new Set([...(memory.accused ?? []), target.id])];
  memory.defended = (memory.defended ?? []).filter((id) => id !== target.id);
  // O traidor frio responde com calma (o que às vezes convence).
  const calm = isTraitor(target) && chance(rng, 0.25 + target.traits.deception / 200);
  talk.reply(talk.pick(calm ? CALM_DENIAL : REPLY_ACCUSE[talk.mood()]), PhraseTone.DEFENSE);
}

function joke(talk: Conversation): void {
  const { rng, matrix, human, target } = talk.input;
  const f = matrix.get(target.id, human.id);
  const odds = clamp(0.5 + (f.liking - 50) / 100 + (target.traits.sociability - 50) / 200, 0.1, 0.95);
  const lands = chance(rng, surprises(rng, talk.input.chaos ?? 0, target) ? 0.5 : odds);
  matrix.adjust(target.id, human.id, { liking: lands ? 8 : -5 });
  for (const l of talk.hearers) matrix.adjust(l.id, human.id, { liking: lands ? 2 : -1 });
  talk.reply(talk.pick(REPLY_JOKE[jokeMood(lands, talk.mood())]), PhraseTone.HUMOR);
}

/** Cada aliança é um grupo próprio: propor aliança a alguém cria uma nova, só de vocês dois. */
function proposeAlliance(talk: Conversation): void {
  const { rng, matrix, human, target, alliances } = talk.input;
  if (matrix.isAllied(human.id, target.id)) return talk.reply(talk.pick(ALLIANCE_ALREADY));
  if (!alliances.canJoin(human.id)) {
    return talk.reply(chance(rng, 0.5) ? `{user} riu: "Você já está em ${MAX_ALLIANCES_PER_PLAYER} alianças, {user1}. Dá conta de mais uma?"` : talk.pick(ALLIANCE_FULL));
  }
  if (!alliances.canJoin(target.id)) return talk.reply(talk.pick(ALLIANCE_FULL));
  const f = matrix.get(target.id, human.id);
  // Traidores adoram um fiel aliado: é escudo humano na mesa redonda.
  const shieldBonus = isTraitor(target) && !isTraitor(human) ? 0.2 : 0;
  const odds = clamp((f.trust / 100) * (0.35 + target.traits.loyalty / 100) + shieldBonus - f.hatred / 180, 0.05, 0.9);
  const probability = surprises(rng, talk.input.chaos ?? 0, target) ? 0.5 : odds;
  if (chance(rng, probability) && alliances.create([human.id, target.id])) {
    matrix.adjust(target.id, human.id, { trust: 8, liking: 5 });
    matrix.adjust(human.id, target.id, { trust: 8 });
    return talk.reply(talk.pick(REPLY_ALLIANCE_YES), PhraseTone.ALLIANCE);
  }
  matrix.adjust(target.id, human.id, { liking: -2 });
  talk.reply(talk.pick(REPLY_ALLIANCE_NO));
}

/** "O que você acha de...": na chegada, primeira impressão; depois, a opinião (o traidor mente). */
function askAbout(talk: Conversation): void {
  const { rng, matrix, human, target, subject } = talk.input;
  if (!subject) return;
  const f = matrix.get(target.id, human.id);
  if (f.hatred > 60 || f.trust < 25) return talk.reply(talk.pick(REPLY_ASK_REFUSE));
  matrix.adjust(target.id, human.id, { liking: 2, trust: 2 });
  if (talk.moment === 'ARRIVAL') {
    return talk.reply(talk.pick(REPLY_FIRST_IMPRESSION[impressionLevel(matrix.get(target.id, subject.id).liking)]), PhraseTone.NEUTRAL);
  }
  // O traidor mente: protege o parceiro e joga a dúvida nos fiéis.
  const honest = matrix.get(target.id, subject.id).trust;
  let said = honest;
  if (isTraitor(target)) said = isTraitor(subject) ? 70 + rng() * 20 : Math.min(honest, 45);
  talk.reply(talk.pick(REPLY_OPINION[opinionLevel(said)]), PhraseTone.NEUTRAL);
}

function persuadeWith(talk: Conversation): void {
  if (talk.input.subject) persuade(talk.input, talk.credibility(talk.input.target), talk.reply, talk.events);
}

function toneOf(action: HumanAction): PhraseTone {
  switch (action) {
    case 'ACCUSE':
    case 'PERSUADE_GUILTY':
      return PhraseTone.ACCUSATION;
    case 'SUSPECT':
      return PhraseTone.SUSPICION;
    case 'DEFEND':
    case 'PERSUADE_INNOCENT':
      return PhraseTone.DEFENSE;
    case 'TRUST':
    case 'ALLIANCE':
      return PhraseTone.ALLIANCE;
    case 'PRAISE':
      return PhraseTone.FRIENDLY;
    case 'JOKE':
      return PhraseTone.HUMOR;
    case 'INSULT':
      return PhraseTone.CONFLICT;
    case 'TOWER_ASK':
    case 'TOWER_KILL':
    case 'TOWER_SPARE':
    case 'TOWER_RECRUIT':
      return PhraseTone.STRATEGY;
    default:
      return PhraseTone.NEUTRAL;
  }
}

function mood(matrix: RelationshipMatrix, target: SimPlayer, human: SimPlayer): Mood {
  const f = matrix.get(target.id, human.id);
  const score = f.trust + f.liking - f.hatred * 1.2;
  if (score >= 110) return 'good';
  return score >= 60 ? 'neutral' : 'bad';
}

/** "Em quem você desconfia?": o personagem conta um nome, se confiar no jogador. Traidor mente. */
function ask(input: HumanActionInput, reply: Reply): void {
  const { matrix, target, human, present, rng } = input;
  const pick = (bank: readonly string[]) => pickLine(rng, bank, momentOf(input.phase));
  const f = matrix.get(target.id, human.id);
  if (f.hatred > 60 || f.trust < 25) {
    reply(pick(REPLY_ASK_REFUSE));
    return;
  }
  matrix.adjust(target.id, human.id, { liking: 2, trust: 2 });
  const candidates = present.filter((p) => p.id !== target.id);
  let named: SimPlayer | undefined;
  if (isTraitor(target)) {
    const pressure = publicSuspicion(matrix, present);
    named = [...candidates].filter((p) => !isTraitor(p) || p.id === human.id).sort((a, b) => (pressure.get(b.id) ?? 0) - (pressure.get(a.id) ?? 0))[0];
  } else {
    named = [...candidates].sort((a, b) => matrix.get(target.id, a.id).trust - matrix.get(target.id, b.id).trust)[0];
  }
  if (!named) return;
  if (named.id === human.id) {
    reply(pick(REPLY_ASK_YOU), PhraseTone.SUSPICION);
    return;
  }
  reply(pick(REPLY_ASK_NAME), PhraseTone.SUSPICION, named);
}

/**
 * Convencer alguém, a sós, de que uma terceira pessoa é traidora (ou fiel).
 * Funciona melhor com quem confia no jogador e já pensava parecido; falhar custa confiança
 * e, se o convencido gosta da pessoa acusada, ele(a) pode contar tudo para ela.
 */
function persuade(input: HumanActionInput, credibility: number, reply: Reply, events: NarratedEvent[]): void {
  const { matrix, target, human, subject, action, rng } = input;
  const pick = (bank: readonly string[]) => pickLine(rng, bank, momentOf(input.phase));
  const s = subject!;
  const view = matrix.get(target.id, s.id);
  const guilty = action === 'PERSUADE_GUILTY';
  const openness = guilty
    ? (60 - view.trust) / 120 + (target.traits.paranoia - 50) / 200 + view.hatred / 300
    : (view.trust - 40) / 150 + (50 - target.traits.paranoia) / 200;
  // Aliado resiste a ouvir mal do aliado; traidor protege o parceiro.
  const loyalty = view.allied ? leaning(guilty, -0.35, 0.2) : 0;
  const protective = isTraitor(target) && isTraitor(s) ? leaning(guilty, -0.6, 0.3) : 0;
  const probability = surprises(rng, input.chaos ?? 0, target)
    ? 0.5
    : clamp(0.3 + 0.5 * credibility + openness + loyalty + protective - Math.max(0, view.liking - 50) / 250, 0.08, 0.9);
  const roll = rng();

  if (roll < probability) {
    matrix.adjust(target.id, s.id, { trust: guilty ? -(18 + 18 * credibility) : 16 + 18 * credibility, hatred: guilty ? 4 : -4 });
    matrix.adjust(target.id, human.id, { trust: 5, liking: 2 });
    reply(
      guilty ? pick(PERSUADE_GUILTY_YES) : pick(PERSUADE_INNOCENT_YES),
      guilty ? PhraseTone.SUSPICION : PhraseTone.DEFENSE,
    );
    return;
  }
  // Quase convenceu: a semente da dúvida fica plantada.
  if (roll < probability + 0.25 && protective === 0) {
    matrix.adjust(target.id, s.id, { trust: guilty ? -(7 + 6 * credibility) : 6 + 6 * credibility });
    reply(
      guilty ? pick(PERSUADE_GUILTY_MAYBE) : pick(PERSUADE_INNOCENT_MAYBE),
      PhraseTone.NEUTRAL,
    );
    return;
  }
  matrix.adjust(target.id, human.id, { trust: -4 });
  reply(
    guilty ? pick(PERSUADE_GUILTY_NO) : pick(PERSUADE_INNOCENT_NO),
    PhraseTone.CONFLICT,
  );
  // Quem gosta de quem foi acusado pode contar a ele(a).
  if (guilty && (view.liking >= 60 || view.allied) && chance(rng, 0.55)) {
    matrix.adjust(s.id, human.id, { hatred: 14, trust: -12 });
    // {user} = quem conta, {user1} = de quem se falou, {user2} = jogador (na ordem em que aparecem no texto).
    const text = pick(TELL_ON);
    const who: Record<string, string> = { '{user}': target.id, '{user1}': s.id, '{user2}': human.id };
    const order = [...new Set([...text.matchAll(/\{user\d*\}/g)].map((m) => m[0]))];
    events.push({ kind: SimulationEventKind.REACTION, tone: PhraseTone.CONFLICT, text, playerIds: order.map((t) => who[t]), isPrivate: true });
  }
}

/** Debate na torre: perguntar o plano de um parceiro, convencê-lo a matar ou poupar alguém, sugerir recrutar. */
function tower(input: HumanActionInput, reply: Reply): void {
  const { matrix, target: partner, human, subject, action, memory, rng, active, day } = input;
  if (!memory.tower || memory.tower.day !== day) memory.tower = { day, pledges: {}, spares: {}, recruits: {} };
  const plan = memory.tower;
  const traitors = active.filter(isTraitor);
  const spared = plan.spares[partner.id] ?? [];
  const pref = traitorPreference(matrix, partner, traitors, active, spared, input.dungeonIds ?? []);
  const current = plan.pledges[partner.id] ?? pref?.targetId;
  const trustInMe = matrix.get(partner.id, human.id).trust;
  const pick = (bank: readonly string[]) => pickLine(rng, bank, 'TOWER');

  if (action === 'TOWER_ASK') {
    const named = active.find((p) => p.id === current);
    if (!named) {
      reply(pick(TOWER_ANSWER.NONE));
      return;
    }
    reply(pick(TOWER_ANSWER[plan.pledges[partner.id] ? 'PLEDGED' : pref!.reason]), PhraseTone.STRATEGY, named);
    return;
  }
  if (!subject) return;

  if (action === 'TOWER_KILL') {
    if (current === subject.id) {
      plan.pledges[partner.id] = subject.id;
      reply(pick(TOWER_KILL_SAME), PhraseTone.STRATEGY);
      return;
    }
    const f = matrix.get(partner.id, subject.id);
    const probability = clamp(
      0.25 + trustInMe / 250 + (f.hatred - f.liking) / 250 + matrix.suspicion(subject.id, partner.id) / 300 + (partner.traits.conformity - 50) / 200 - (partner.traits.aggression - 50) / 300,
      0.05,
      0.9,
    );
    if (chance(rng, probability)) {
      plan.pledges[partner.id] = subject.id;
      plan.spares[partner.id] = spared.filter((id) => id !== subject.id);
      matrix.adjust(partner.id, human.id, { trust: 3 });
      reply(pick(TOWER_KILL_YES), PhraseTone.STRATEGY);
    } else {
      const own = active.find((p) => p.id === current);
      matrix.adjust(partner.id, human.id, { liking: -2 });
      // Com um nome próprio, o parceiro defende o dele ({user2}); sem, só recusa.
      const refusals = TOWER_KILL_NO.filter((l) => l.includes('{user2}') === !!own);
      reply(pick(refusals.length ? refusals : TOWER_KILL_NO), PhraseTone.CONFLICT, own);
    }
    return;
  }

  if (action === 'TOWER_SPARE') {
    const f = matrix.get(partner.id, subject.id);
    const probability = clamp(0.3 + trustInMe / 250 + (f.liking - f.hatred) / 250 - matrix.suspicion(subject.id, partner.id) / 250, 0.05, 0.9);
    if (chance(rng, probability)) {
      plan.spares[partner.id] = [...new Set([...spared, subject.id])];
      if (plan.pledges[partner.id] === subject.id) delete plan.pledges[partner.id];
      reply(pick(TOWER_SPARE_YES), PhraseTone.STRATEGY);
    } else {
      reply(pick(TOWER_SPARE_NO), PhraseTone.CONFLICT);
    }
    return;
  }

  // TOWER_RECRUIT: o parceiro diz se toparia trazer essa pessoa.
  const f = matrix.get(partner.id, subject.id);
  plan.recruits[partner.id] = subject.id;
  if (f.liking >= 55 && f.hatred < 40) {
    matrix.adjust(partner.id, human.id, { trust: 2 });
    reply(pick(TOWER_RECRUIT_YES), PhraseTone.STRATEGY);
  } else {
    reply(pick(TOWER_RECRUIT_NO), PhraseTone.CONFLICT);
  }
}

// ------------------------------------------------------------------ convites para aliança

export interface InviteAnswerInput {
  matrix: RelationshipMatrix;
  alliances: AllianceBook;
  invite: HumanInvite;
  human: SimPlayer;
  inviter: SimPlayer;
  active: readonly SimPlayer[];
  accept: boolean;
  memory: HumanMemory;
  day: number;
}

/**
 * Resposta do jogador a um convite: aceitar põe o jogador naquela aliança (ou cria uma nova a dois),
 * sem mexer nas outras alianças dele; recusar magoa quem convidou (mais se for rancoroso) e esfria o grupo.
 * Devolve null quando não dá mais para entrar (aliança cheia, desfeita ou alianças demais).
 */
export function answerInvite(input: InviteAnswerInput): NarratedEvent[] | null {
  const { matrix, alliances, invite, human, inviter, active, accept, memory } = input;
  const group = invite.groupId ? alliances.get(invite.groupId) : undefined;
  const theirs = group ? group.memberIds : [inviter.id];
  const blocked = invite.groupId ? !group || theirs.length >= MAX_ALLIANCE || !alliances.canJoin(human.id) : !alliances.canJoin(human.id) || !alliances.canJoin(inviter.id);
  if (accept && blocked) return null;
  memory.invites = (memory.invites ?? []).filter((i) => !(i.fromId === invite.fromId && i.groupId === invite.groupId));
  memory.talkedOn = { ...(memory.talkedOn ?? {}), [inviter.id]: input.day };
  const members = theirs
    .filter((id) => id !== inviter.id)
    .map((id) => active.find((p) => p.id === id))
    .filter((p): p is SimPlayer => !!p);

  if (accept) {
    const joined = group ? alliances.join(group.id, human.id) : !!alliances.create([inviter.id, human.id]);
    if (!joined) return null;
    for (const id of theirs) {
      matrix.adjust(id, human.id, { trust: 7, liking: 4 });
      matrix.adjust(human.id, id, { trust: 7, liking: 4 });
    }
    const others = members.length ? ` Agora são ${theirs.length}, com ${tokenList(members.length, 2)}.` : '';
    return [
      {
        kind: SimulationEventKind.ALLIANCE,
        tone: PhraseTone.ALLIANCE,
        text: `{user} aceitou o convite de {user1}.${others}`,
        playerIds: [human.id, inviter.id, ...members.map((p) => p.id)],
        isPrivate: true,
      },
    ];
  }

  const rancor = 0.6 + inviter.traits.grudge / 125;
  matrix.adjust(inviter.id, human.id, { liking: -7, trust: -5, hatred: 3 }, rancor);
  for (const m of members) matrix.adjust(m.id, human.id, { liking: -2, trust: -2 });
  const hurt = inviter.traits.grudge >= 60 || inviter.traits.volatility >= 65;
  return [
    // Não é PLAYER: responder a um convite não gasta conversa.
    { kind: SimulationEventKind.ALLIANCE, tone: PhraseTone.NEUTRAL, text: '{user} recusou o convite de {user1}.', playerIds: [human.id, inviter.id], isPrivate: true },
    {
      kind: SimulationEventKind.REACTION,
      tone: hurt ? PhraseTone.CONFLICT : PhraseTone.NEUTRAL,
      text: pickOne(gameRng, hurt ? INVITE_DECLINE_HURT : INVITE_DECLINE_OK)!,
      playerIds: [inviter.id, human.id],
      isPrivate: true,
    },
  ];
}

/** Convite ignorado (o momento passou sem resposta): quem convidou se sente deixado de lado. */
export function expireInvites(matrix: RelationshipMatrix, memory: HumanMemory, humanId: string, day: number, phase: GamePhase): void {
  const [open, expired] = [(memory.invites ?? []).filter((i) => i.day === day && i.phase === phase), (memory.invites ?? []).filter((i) => i.day !== day || i.phase !== phase)];
  for (const invite of expired) matrix.adjust(invite.fromId, humanId, { liking: -3, trust: -2 });
  memory.invites = open;
}

/** Quem ouve o que o jogador disse: conversa particular, ninguém; mesa e missão, todos; no resto, metade. */
function whoHears(action: HumanAction, phase: GamePhase, others: SimPlayer[], rng: Rng): SimPlayer[] {
  if (PRIVATE.includes(action)) return [];
  if (PUBLIC_PHASES.includes(phase)) return others;
  return shuffle(rng, others).slice(0, Math.ceil(others.length / 2));
}

/** Piada que funciona agrada (menos quem já estava de mal); a que não funciona, irrita. */
function jokeMood(lands: boolean, current: Mood): Mood {
  if (!lands) return 'bad';
  return current === 'bad' ? 'neutral' : 'good';
}

/** Peso para convencer contra (culpado) ou a favor (inocente). */
function leaning(guilty: boolean, against: number, towards: number): number {
  return guilty ? against : towards;
}
