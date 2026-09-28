import { EndgameChoice, GamePhase, PhrasePhase, PhraseTone, PlayerRole, SimulationEventKind } from '../enums';
import { AllianceBook, AllianceGroup } from './alliances';
import { ApproachMoment, approachHuman, LastTable } from './approaches';
import { surprises } from './chaos';
import {
  acceptsRecruitment,
  decideMurder,
  endgameChoice,
  leadersOf,
  murderScores,
  recruitmentTarget,
  firstVoteRound,
  revoteRound,
  SimVote,
  VoteResult,
} from './decisions';
import { isCoffinNight, murdersOver } from './finale';
import { MissionContext, MissionDefinition, MissionOutcome } from './missions/MissionContext';
import { DialogueScene, NarratedEvent, Narrator, PhraseTemplate } from './narration';
import { RelationshipMatrix } from './RelationshipMatrix';
import { chance, clamp, pickOne, Rng, shuffle, softmaxPick, weightedPick } from './random';
import { Social } from './social';
import { HumanMemory } from './humanActions';
import { isTraitor, SimPlayer } from './traits';
import { tokenList } from './tokens';
import { HIDDEN_ROLE_TABLE } from '../rules';

type Tones = DialogueScene['tones'];

const T = PhraseTone;
// Pesos dos teores: a proporção de falas de cada teor no momento (não depende de quantas frases há na biblioteca).
// Na chegada ninguém sabe nada do jogo: só primeiras impressões.
const ARRIVAL_TONES: Tones = { [T.FRIENDLY]: 4, [T.HUMOR]: 3.2, [T.NEUTRAL]: 1.3, [T.ALLIANCE]: 0.6, [T.CONFLICT]: 0.5, [T.EMOTION]: 0.45 };
/** Quanto o que alguém disse na mesa pesa no próprio voto (a temperatura do voto é 9). */
const STANCE_WEIGHT: Partial<Record<PhraseTone, number>> = { [T.ACCUSATION]: 40, [T.SUSPICION]: 18, [T.DEFENSE]: -40 };
const BREAKFAST_TONES: Tones = { [T.EMOTION]: 3.1, [T.SUSPICION]: 2.7, [T.HUMOR]: 1.5, [T.CONFLICT]: 0.8, [T.ACCUSATION]: 0.55, [T.FRIENDLY]: 0.5, [T.NEUTRAL]: 0.5, [T.ALLIANCE]: 0.25, [T.DEFENSE]: 0.2 };
const ROUND_TABLE_TONES: Tones = { [T.ACCUSATION]: 5.5, [T.DEFENSE]: 1.65, [T.SUSPICION]: 1.5, [T.CONFLICT]: 0.6, [T.EMOTION]: 0.4, [T.HUMOR]: 0.15, [T.NEUTRAL]: 0.1, [T.ALLIANCE]: 0.1 };
const REACTION_TONES: Tones = { [T.EMOTION]: 3, [T.SUSPICION]: 1, [T.HUMOR]: 0.5, [T.ACCUSATION]: 0.4, [T.CONFLICT]: 0.4, [T.DEFENSE]: 0.3 };
const ENDGAME_TONES: Tones = { [T.ACCUSATION]: 2.6, [T.EMOTION]: 2.3, [T.DEFENSE]: 1.9, [T.SUSPICION]: 1.7, [T.CONFLICT]: 0.6, [T.ALLIANCE]: 0.5, [T.HUMOR]: 0.35 };
/** Torre: é um debate sobre quem matar ou recrutar, não conversa de salão. */
const TOWER_TONES: Tones = { [T.STRATEGY]: 9, [T.CONFLICT]: 0.7, [T.HUMOR]: 0.15, [T.EMOTION]: 0.1, [T.NEUTRAL]: 0.1 };
/** Pontos a mais no voto de um traidor contra o jogador humano (a dificuldade do modo Jogador). */
const HUMAN_THREAT = 8;

/**
 * Memória da simulação entre fases (fica gravada na temporada).
 * Cada reviravolta icônica acontece no máximo uma vez e só quando faz sentido.
 */
export interface SimulationFlags {
  /** Dia em que a taça envenenada foi usada (a vítima cai no café seguinte). */
  poisonDay?: number;
  /** A missão do dia armou a taça envenenada para esta noite. */
  poisonArmedDay?: number;
  /** Condenados da masmorra: a noite deste dia só pode matar um deles. */
  dungeon?: { day: number; playerIds: string[] };
  /** Pares ("a|b") cujo segredo já foi revelado. */
  revealedBonds?: string[];
  confessionUsed?: boolean;
  temptationUsed?: boolean;
  /** Modo Jogador: convite dos traidores esperando a resposta do usuário. */
  pendingOffer?: HumanOffer;
  /** Modo Jogador: histórico de acusações/defesas do usuário e o que ele combinou na torre. */
  human?: HumanMemory;
  /** As alianças (cada uma um grupo; a mesma pessoa pode estar em várias). */
  alliances?: AllianceGroup[];
  /** Última mesa redonda: quem votou em quem e quem saiu (as conversas do dia seguinte lembram disso). */
  lastTable?: LastTable;
  /** Modo Jogador: votação empatada esperando o voto do jogador na revotação. */
  pendingRevote?: PendingRevote;
  /** O poder do Vidente (sai numa missão perto da final): quem ganhou, com quem jantou e o que descobriu. */
  seer?: SeerState;
  /** A noite dos caixões: três nomes à vista de todos e quem teve o caixão pregado. */
  coffins?: { day: number; playerIds: string[]; victimId: string };
  /** Banidos na reta final: saíram sem revelar o papel (o castelo só descobre no fim). */
  hiddenRoles?: string[];
  /** Dia em que a missão fechou a torre: não há assassinato nesta noite. */
  noMurderDay?: number;
}

export interface SeerState {
  /** Dia da missão do Vidente (o jantar é na noite desse dia). */
  day: number;
  seerId: string;
  guestId?: string;
  /** O que o Vidente descobriu sobre o convidado. */
  guestRole?: PlayerRole;
  /** O Vidente já contou (ou escondeu) no café da manhã. */
  announced?: boolean;
}

/** No café seguinte ao jantar, o que o Vidente conta ao castelo. */
export type SeerAnnouncement = 'TRUTH' | 'LIE' | 'SECRET';

export interface BreakfastOptions {
  /** Primeiro café da reta final: não haverá mais assassinatos. */
  final?: boolean;
  /** Modo Jogador: o que o usuário, Vidente, conta no café. */
  seerAnnouncement?: SeerAnnouncement;
}

/**
 * Empate na votação com o jogador humano na mesa: a primeira rodada já aconteceu e
 * a revotação (só entre os empatados) espera o voto dele. Guarda o necessário para continuar.
 */
export interface PendingRevote {
  day: number;
  table: 'ROUND_TABLE' | 'ENDGAME';
  tiedIds: string[];
  /** Votos da primeira rodada. */
  votes: SimVote[];
  confessorId?: string;
  /** Mesa final: a rodada e o que cada um escolheu (encerrar ou banir). */
  round?: number;
  endgameVotes?: { voterId: string; choice: EndgameChoice }[];
  /** O que cada um disse na mesa (pesa também na revotação). */
  stances: Record<string, Record<string, number>>;
}

/** Rodada da mesa final pronta para registrar. */
export interface EndgameRound {
  endgameVotes: { voterId: string; choice: EndgameChoice }[];
  votes: SimVote[];
  banishedId: string | null;
}

export interface MeetingDecision {
  murderTargetId: string | null;
  recruitment: { targetId: string; accepted: boolean; isUltimatum: boolean } | null;
  /** Assassinato à vista de todos (taça envenenada): escudo não protege. */
  plainSight: boolean;
  /** Os traidores chamaram o jogador humano: a noite só termina quando ele responder. */
  awaitingHuman?: HumanOffer;
}

/** Convite (carta ou ultimato) feito ao jogador humano. */
export interface HumanOffer {
  day: number;
  ultimatum: boolean;
  recruiterId: string;
}

/** O que o jogador humano decidiu na torre, sendo traidor. */
export interface HumanTowerChoice {
  murderTargetId?: string | null;
  /** Noite dos caixões: os três nomes (a vítima é um deles). */
  coffinIds?: string[] | null;
  recruit?: { targetId: string; ultimatum: boolean; victimIfAcceptedId?: string | null } | null;
}

/** Escolhas do jogador humano numa rodada da mesa final. */
export interface HumanEndgameChoice {
  choice: EndgameChoice;
  voteTargetId: string;
}

/** O que a torre precisa saber sobre recrutamentos anteriores. */
export interface RecruitmentContext {
  originalTraitors: number;
  recruitmentsSoFar: number;
  /** Fiéis que já recusaram um convite (não são chamados de novo). */
  declinedIds: string[];
  /** Houve recrutamento na noite anterior. */
  recruitedLastNight: boolean;
}

export interface NightNews {
  /** Assassinado na noite anterior. */
  murderedId?: string | null;
  /** Alvo que sobreviveu graças ao escudo. */
  savedId?: string | null;
  recruitedIds?: string[];
  declinedIds?: string[];
}

export interface BreakfastOutcome {
  /** Deixou o jogo por motivos pessoais. */
  withdrawnId: string | null;
}

export interface EngineOptions {
  rng: Rng;
  matrix: RelationshipMatrix;
  /** Todos os jogadores da temporada (inclusive eliminados, para citar vítimas). */
  everyone: SimPlayer[];
  /** Quem está no castelo agora. */
  activeIds: readonly string[];
  phrases: readonly PhraseTemplate[];
  money: (amount: number) => string;
  /** Número do dia atual. */
  day?: number;
  /** Loucura da temporada (0 a 1). */
  chaos?: number;
  /** Memória entre fases; o engine altera e quem chama grava. */
  flags?: SimulationFlags;
  /** Modo Jogador: o participante controlado pelo usuário. */
  humanId?: string;
  /** A temporada escolhida tem a noite dos caixões (padrão: sim). */
  coffins?: boolean;
  /** Alguém pode deixar o castelo por motivos pessoais (padrão: sim). */
  withdrawals?: boolean;
}

/**
 * Simula uma fase de cada vez: decide (votos, assassinato, missão...), narra os acontecimentos
 * e atualiza os relacionamentos. Não grava nada: quem chama registra o resultado.
 */
export class SimulationEngine {
  readonly narrator: Narrator;
  readonly flags: SimulationFlags;
  private readonly social: Social;
  /** As alianças da temporada (grupos independentes; ficam gravadas em flags.alliances). */
  readonly alliances: AllianceBook;
  private readonly rng: Rng;
  private readonly matrix: RelationshipMatrix;
  private readonly byId: Map<string, SimPlayer>;
  private readonly chaos: number;
  private readonly day: number;
  private readonly humanId?: string;
  private active: SimPlayer[];
  /** O que cada um disse na mesa desta votação: quem fala -> (alvo -> peso no voto). */
  private readonly stances = new Map<string, Map<string, number>>();

  constructor(private readonly options: EngineOptions) {
    this.rng = options.rng;
    this.matrix = options.matrix;
    this.chaos = clamp(options.chaos ?? 0, 0, 1);
    this.day = options.day ?? 1;
    this.flags = options.flags ?? {};
    this.humanId = options.humanId;
    this.byId = new Map(options.everyone.map((p) => [p.id, p]));
    this.active = options.everyone.filter((p) => options.activeIds.includes(p.id));
    this.narrator = new Narrator(options.rng, options.phrases, this.chaos);
    this.alliances = new AllianceBook(options.matrix, this.flags, options.activeIds);
    this.social = new Social(options.rng, options.matrix, () => this.active, this.alliances, this.chaos, options.humanId);
  }

  get events(): NarratedEvent[] {
    return this.narrator.events;
  }

  /** Quantas falas por momento, conforme o tamanho do elenco. */
  private lines(extra = 0): number {
    return clamp(Math.round(this.active.length / 3) + extra, 2, 9);
  }

  /** Quem está no castelo, sem o jogador humano. */
  private get npcs(): SimPlayer[] {
    return this.active.filter((p) => p.id !== this.humanId);
  }

  private isHuman(p: SimPlayer | undefined): boolean {
    return !!p && p.id === this.humanId;
  }

  private talk(phase: PhrasePhase, count: number, tones: Tones, scene: Partial<DialogueScene> = {}): void {
    const speakers = (scene.speakers ?? this.active).filter((p) => !this.isHuman(p));
    if (!speakers.length) return;
    for (let i = 0; i < count; i++) {
      const line = this.narrator.speak(this.matrix, { phase, audience: this.active, tones, ...scene, speakers });
      if (!line) continue;
      if ((phase === PhrasePhase.ROUND_TABLE || phase === PhrasePhase.ENDGAME) && line.target && !scene.aboutVictim) this.takeStance(line.speaker.id, line.target.id, line.phrase.tone);
      if (this.social.applyLine(line) && line.target) {
        if (scene.private) this.narrator.line(SimulationEventKind.NARRATION, '{user} falou demais e {user1} não gostou nada.', [line.speaker, line.target], null, true);
        else this.say(SimulationEventKind.NARRATION, 'A fala de {user} saiu pela culatra: a mesa ficou do lado de {user1}.', [line.speaker, line.target]);
      }
    }
  }

  /** Guarda o que alguém disse na mesa para o voto dele ficar coerente com a fala. */
  private takeStance(speakerId: string, targetId: string, tone: PhraseTone): void {
    const weight = STANCE_WEIGHT[tone];
    if (!weight) return;
    const mine = this.stances.get(speakerId) ?? new Map<string, number>();
    mine.set(targetId, (mine.get(targetId) ?? 0) + weight);
    this.stances.set(speakerId, mine);
  }

  /** A acusação mais forte que `voterId` fez na mesa (se fez alguma). */
  private accused(voterId: string): string | undefined {
    const mine = [...(this.stances.get(voterId) ?? [])].filter(([, w]) => w >= STANCE_WEIGHT[T.ACCUSATION]!).sort((a, b) => b[1] - a[1]);
    return mine[0]?.[0];
  }

  private say(kind: SimulationEventKind, text: string, players: readonly SimPlayer[] = [], tone: PhraseTone | null = null): void {
    this.narrator.line(kind, text, players, tone);
  }

  private remove(playerId: string): void {
    this.active = this.active.filter((p) => p.id !== playerId);
    this.alliances.removePlayer(playerId);
  }

  // ------------------------------------------------------------------ fases

  arrival(): void {
    this.say(SimulationEventKind.NARRATION, `Os portões do castelo se abrem. ${this.active.length} desconhecidos chegam às Highlands, cada um escondendo as próprias intenções.`);
    const ids = this.active.map((p) => p.id);
    const [star] = [...this.active].sort((a, b) => this.matrix.toward(b.id, ids).liking - this.matrix.toward(a.id, ids).liking);
    const [lightning] = [...this.active].sort((a, b) => this.matrix.toward(b.id, ids).hatred - this.matrix.toward(a.id, ids).hatred);
    if (star) this.say(SimulationEventKind.NARRATION, 'Em minutos, {user} já conquistou o salão.', [star]);
    if (lightning && lightning !== star) this.say(SimulationEventKind.NARRATION, 'Já {user} não caiu nas graças de todos: olhares atravessados desde a chegada.', [lightning]);
    // Conversas de canto: cada um só sabe das que viveu.
    this.talk(PhrasePhase.ARRIVAL, this.lines(2), ARRIVAL_TONES, { private: true });
    this.social.formAlliances(this.narrator, 2);
    this.approachHuman('ARRIVAL', GamePhase.ARRIVAL);
  }

  /** Escolhe os traidores originais (os dissimulados têm mais chance; com loucura, qualquer um). */
  selectTraitors(): string[] {
    const count = Math.max(1, Math.min(4, Math.round(this.active.length / 7), this.active.length - 1));
    const pool = [...this.active];
    const traitors: SimPlayer[] = [];
    const wild = surprises(this.rng, this.chaos);
    while (traitors.length < count && pool.length) {
      const chosen = weightedPick(this.rng, pool, (p) => (wild ? 1 : 1 + p.traits.deception / 35))!;
      pool.splice(pool.indexOf(chosen), 1);
      traitors.push(chosen);
    }
    for (const p of this.active) p.role = traitors.includes(p) ? PlayerRole.TRAITOR : PlayerRole.FAITHFUL;

    this.say(SimulationEventKind.NARRATION, 'À meia-noite, todos se sentam em círculo, de olhos vendados. Um toque no ombro muda tudo.');
    for (const t of traitors) this.say(SimulationEventKind.SECRET, 'Um toque no ombro: {user} agora é Traidor(a).', [t]);
    if (traitors.length > 1) this.say(SimulationEventKind.SECRET, `Na torre, ${tokenList(traitors.length)} se reconhecem sob os capuzes.`, traitors);
    this.social.bondTraitors(traitors);
    return traitors.map((t) => t.id);
  }

  /**
   * Café da manhã como no programa: os jogadores descem aos poucos, cada porta que se abre é um alívio
   * (ou uma angústia), e só quando a porta não se abre mais o castelo descobre quem morreu.
   * Depois vêm as reações à morte (em público), as conversas de canto e quem vem falar com o jogador.
   */
  breakfast(news: NightNews, options: BreakfastOptions = {}): BreakfastOutcome {
    this.social.dailyDrift();
    this.coolTowardHuman();
    const victim = news.murderedId ? this.byId.get(news.murderedId) : undefined;
    const saved = news.savedId ? this.byId.get(news.savedId) : undefined;
    const poisoned = this.flags.poisonDay === this.day - 1;
    const coffins = this.flags.coffins?.day === this.day - 1 ? this.flags.coffins : undefined;

    if (coffins && victim) {
      this.coffinCeremony(coffins, victim);
    } else {
      this.say(SimulationEventKind.NARRATION, 'O café da manhã é servido. A porta do salão se abre, um grupo de cada vez.');
      this.arrivals(victim, saved);
    }

    if (coffins && victim) {
      this.social.murderAftermath(victim);
    } else if (victim && poisoned) {
      this.say(SimulationEventKind.MURDER, 'A porta não abre mais. {user} bebeu da taça envenenada ontem e não acordou.', [victim]);
      this.social.murderAftermath(victim);
    } else if (victim) {
      this.say(SimulationEventKind.MURDER, 'A porta não abre mais. {user} não vem: foi assassinado(a) pelos Traidores.', [victim]);
      this.social.murderAftermath(victim);
    } else if (saved && this.humanId) {
      this.say(SimulationEventKind.NARRATION, 'Todos desceram. Ninguém morreu esta noite... e isso assusta mais do que um corpo.');
      this.say(SimulationEventKind.SECRET, 'Só {user} sabe: os Traidores vieram, mas o escudo segurou a adaga.', [saved]);
    } else if (saved) {
      this.say(SimulationEventKind.NARRATION, 'Todos desceram. Os Traidores atacaram, mas o escudo de {user} segurou a adaga.', [saved]);
    } else {
      this.say(SimulationEventKind.NARRATION, 'Todos desceram. Ninguém morreu esta noite... e isso assusta mais do que um corpo.');
    }
    for (const id of news.recruitedIds ?? []) {
      const p = this.byId.get(id);
      if (p) this.say(SimulationEventKind.SECRET, '{user} desce para o café carregando um segredo: agora é Traidor(a).', [p]);
    }
    for (const id of news.declinedIds ?? []) {
      const p = this.byId.get(id);
      if (p) this.say(SimulationEventKind.SECRET, '{user} recusou o convite dos Traidores e ninguém sabe disso.', [p]);
    }

    // Reações à notícia: todos à mesa ouvem.
    if (victim) {
      this.mourn(victim);
      this.talk(PhrasePhase.BREAKFAST, 2, REACTION_TONES, { victim, aboutVictim: true });
    }
    this.seerNews(options.seerAnnouncement);
    if (options.final) {
      this.say(
        SimulationEventKind.NARRATION,
        `Restam ${this.active.length}. Começa a reta final: acabaram os assassinatos, e quem for banido(a) daqui em diante sai sem revelar o papel. Depois da última mesa redonda, o Fogo da Verdade decide se o jogo acaba.`,
      );
    }
    this.revealSecretBond();
    // Depois, as conversas de canto.
    this.talk(PhrasePhase.BREAKFAST, this.lines(0), BREAKFAST_TONES, { victim, private: true });
    const withdrawnId = this.maybeWithdraw();
    this.social.formAlliances(this.narrator, 2);
    this.approachHuman('BREAKFAST', GamePhase.BREAKFAST, victim);
    return { withdrawnId };
  }

  /**
   * A chegada ao salão: grupos de 1 a 3 abrem a porta. Quem já está sentado sente falta de quem gosta;
   * traidores fingem a mesma aflição. O escudado costuma chegar por último, para o susto.
   */
  private arrivals(victim?: SimPlayer, saved?: SimPlayer): void {
    const order = shuffle(this.rng, this.active.filter((p) => p !== saved));
    if (saved && this.active.includes(saved)) order.push(saved);
    // No fim, a porta abre para um ou dois de cada vez (é aí que a tensão sobe); antes, grupos de até 5.
    const rest = [...order];
    const tail: SimPlayer[][] = [];
    const tailGroups = Math.min(4, Math.max(1, Math.floor(order.length / 3)));
    for (let g = 0; g < tailGroups && rest.length > 1; g++) {
      const size = Math.min(rest.length - 1, chance(this.rng, 0.55) ? 1 : 2);
      tail.unshift(rest.splice(rest.length - size, size));
    }
    const head: SimPlayer[][] = [];
    const per = Math.ceil(rest.length / Math.max(1, Math.ceil(rest.length / 5)));
    for (let i = 0; i < rest.length; i += per) head.push(rest.slice(i, i + per));
    const groups = [...head, ...tail];
    const arrived: SimPlayer[] = [];
    let worried = false;
    for (const [index, group] of groups.entries()) {
      const last = index === groups.length - 1;
      const text = this.doorLine(index === 0, group.length);
      this.say(SimulationEventKind.NARRATION, last && victim ? `${text} Mais alguém vem?` : text, group);
      arrived.push(...group);
      if (last) break;

      // No meio da espera, alguém que já chegou olha para a porta por quem ainda não desceu.
      if (!worried && index >= 1 && chance(this.rng, 0.6)) {
        const missing = new Set([...order.filter((p) => !arrived.includes(p)).map((p) => p.id), ...(victim ? [victim.id] : [])]);
        const watcher = shuffle(this.rng, arrived).find((p) => [...missing].some((id) => this.matrix.get(p.id, id).liking >= 65));
        if (watcher) {
          worried = true;
          const dear = [...missing].sort((a, b) => this.matrix.get(watcher.id, b).liking - this.matrix.get(watcher.id, a).liking)[0];
          const friend = this.byId.get(dear);
          // A vítima não pode ser citada antes da revelação.
          if (friend && friend !== victim) this.say(SimulationEventKind.NARRATION, '{user} não tira os olhos da porta: {user1} ainda não desceu.', [watcher, friend], PhraseTone.EMOTION);
          else this.say(SimulationEventKind.NARRATION, '{user} não tira os olhos da porta. Falta alguém importante.', [watcher], PhraseTone.EMOTION);
        }
      }
      if (index === 1) {
        const actor = pickOne(this.rng, arrived.filter(isTraitor));
        if (actor && victim) this.say(SimulationEventKind.SECRET, '{user} finge aflição a cada porta. Sabe muito bem quem não vem.', [actor]);
      }
    }
  }

  /**
   * A noite dos caixões, na manhã seguinte: três caixões abertos na cripta, os escolhidos se deitam
   * à vista de todos e os Traidores pregam um deles. Quem se levanta vira suspeito ("a teoria do caixão").
   */
  private coffinCeremony(coffins: NonNullable<SimulationFlags['coffins']>, victim: SimPlayer): void {
    const lying = coffins.playerIds.map((id) => this.byId.get(id)).filter((p): p is SimPlayer => !!p);
    const survivors = lying.filter((p) => p.id !== victim.id && this.active.includes(p));
    this.say(SimulationEventKind.NARRATION, 'Não há café esta manhã. O castelo inteiro é chamado à cripta, onde três caixões abertos esperam.');
    this.say(SimulationEventKind.NARRATION, `Os Traidores escolheram os nomes: ${tokenList(lying.length)} se deitam nos caixões, à vista de todos. As tampas se fecham.`, lying);
    this.say(SimulationEventKind.MURDER, 'Um caixão foi pregado. Quando as tampas se abrem, {user} não se levanta: foi assassinado(a) à vista de todos.', [victim]);
    if (!survivors.length) return;
    this.say(
      SimulationEventKind.NARRATION,
      survivors.length > 1
        ? '{user} e {user1} saem dos caixões tremendo. E a pergunta toma o salão: os Traidores colocariam um dos seus ali para parecer inocente?'
        : '{user} sai do caixão tremendo. E a pergunta toma o salão: os Traidores colocariam um dos seus ali para parecer inocente?',
      survivors,
    );
    // A teoria do caixão: quem saiu vivo fica sob suspeita (menos para quem gosta muito dele).
    for (const survivor of survivors) {
      for (const other of this.active) {
        if (other === survivor || lying.includes(other)) continue;
        if (this.matrix.get(other.id, survivor.id).liking < 70) this.matrix.adjust(other.id, survivor.id, { trust: -5 }, 0.6 + other.traits.paranoia / 100);
      }
    }
    const theorist = weightedPick(this.rng, this.npcs.filter((p) => !lying.includes(p)), (p) => p.traits.paranoia + p.traits.influence * 0.5);
    const target = theorist && [...survivors].sort((a, b) => this.matrix.get(theorist.id, a.id).trust - this.matrix.get(theorist.id, b.id).trust)[0];
    if (theorist && target) {
      this.say(SimulationEventKind.DIALOGUE, '{user} lançou a teoria do caixão: "Por que {user1} estava lá e saiu vivo(a)? Para parecer um de nós."', [theorist, target], PhraseTone.SUSPICION);
      this.social.broadcast(theorist, target, { trust: -4 });
    }
  }

  /**
   * O jantar do Vidente (na noite da missão do poder): ele chama alguém a sós e pergunta se é Traidor.
   * A resposta é sempre verdadeira. Só os dois ficam sabendo, até o Vidente decidir contar no café.
   */
  seerDinner(humanGuestId?: string | null): void {
    const state = this.flags.seer;
    if (!state || state.day !== this.day || state.guestId) return;
    const seer = this.active.find((p) => p.id === state.seerId);
    if (!seer) return;
    const others = this.active.filter((p) => p !== seer);
    const guest = this.isHuman(seer) ? others.find((p) => p.id === humanGuestId) : this.seerGuest(seer, others);
    if (!guest) return;
    state.guestId = guest.id;
    state.guestRole = guest.role;
    const both = [seer, guest];
    this.narrator.line(SimulationEventKind.NARRATION, 'Ao anoitecer, o(a) Vidente {user} chama {user1} para um jantar só dos dois, à luz de velas.', both, PhraseTone.NEUTRAL, true);
    this.narrator.line(
      SimulationEventKind.REVEAL,
      isTraitor(guest)
        ? '{user} olha nos olhos de {user1} e faz a pergunta. A resposta vem sem rodeios: {user1} é Traidor(a).'
        : '{user} olha nos olhos de {user1} e faz a pergunta. A resposta vem sem rodeios: {user1} é Fiel.',
      both,
      null,
      true,
    );
    // O Vidente agora sabe; um traidor exposto passa a ver o Vidente como ameaça.
    this.matrix.set(seer.id, guest.id, { trust: isTraitor(guest) ? 0 : 100 });
    if (isTraitor(guest) && !isTraitor(seer)) {
      this.matrix.adjust(guest.id, seer.id, { hatred: 25, trust: -20 });
      this.say(SimulationEventKind.SECRET, '{user} volta do jantar sabendo que foi descoberto(a). Agora {user1} é uma ameaça.', [guest, seer]);
    }
    if (isTraitor(seer) && !isTraitor(guest)) {
      this.say(SimulationEventKind.SECRET, 'Traidor(a), {user} usou o poder para ganhar a confiança de {user1}: já sabia a resposta.', [seer, guest]);
    }
  }

  /** Quem o Vidente chama: o fiel tira a maior dúvida; o traidor chama um fiel influente que desconfia dele. */
  private seerGuest(seer: SimPlayer, others: readonly SimPlayer[]): SimPlayer | undefined {
    if (isTraitor(seer)) {
      const faithful = others.filter((p) => !isTraitor(p));
      const pull = (p: SimPlayer) => this.matrix.suspicion(p.id, seer.id) + p.traits.influence * 0.5;
      return [...faithful].sort((a, b) => pull(b) - pull(a))[0];
    }
    return [...others].sort((a, b) => this.matrix.suspicion(seer.id, b.id) - this.matrix.suspicion(seer.id, a.id))[0];
  }

  /**
   * No café seguinte ao jantar, o Vidente conta (ou não) o que descobriu. O fiel costuma dizer a verdade;
   * o traidor, como Britney, costuma dizer a verdade sobre um fiel para ganhar crédito, mas pode mentir.
   * O castelo acredita na medida em que confia no Vidente.
   */
  private seerNews(humanChoice?: SeerAnnouncement): void {
    const state = this.flags.seer;
    if (!state?.guestId || state.announced || state.day !== this.day - 1) return;
    state.announced = true;
    const seer = this.active.find((p) => p.id === state.seerId);
    const guest = this.byId.get(state.guestId);
    if (!seer || !guest) return;
    const guestTraitor = state.guestRole === PlayerRole.TRAITOR;
    let choice: SeerAnnouncement;
    if (this.isHuman(seer)) choice = humanChoice ?? 'SECRET';
    else if (!isTraitor(seer)) choice = chance(this.rng, 0.9) ? 'TRUTH' : 'SECRET';
    else if (guestTraitor) choice = 'LIE';
    else choice = chance(this.rng, 0.7) ? 'TRUTH' : 'LIE';

    if (choice === 'SECRET') {
      this.say(SimulationEventKind.DIALOGUE, 'No café, todos esperavam o relato do(a) Vidente. {user} só disse: "O que {user1} me contou fica entre nós."', [seer, guest], PhraseTone.NEUTRAL);
      for (const other of this.active) if (other !== seer && other !== guest) this.matrix.adjust(other.id, seer.id, { trust: -4 });
      return;
    }
    const claimsTraitor = choice === 'TRUTH' ? guestTraitor : !guestTraitor;
    this.say(
      SimulationEventKind.REVEAL,
      claimsTraitor
        ? 'O(A) Vidente {user} contou a todos o que viu no jantar: "{user1} é Traidor(a)." O salão gelou.'
        : 'O(A) Vidente {user} contou a todos o que viu no jantar: "{user1} é Fiel." Alívio na mesa.',
      [seer, guest],
    );
    if (choice === 'LIE') this.say(SimulationEventKind.SECRET, claimsTraitor ? '{user} mentiu: {user1} é Fiel.' : '{user} mentiu: {user1} é Traidor(a).', [seer, guest]);
    for (const observer of this.active) {
      if (observer === seer || observer === guest) continue;
      const credibility = this.matrix.get(observer.id, seer.id).trust / 100;
      this.matrix.adjust(observer.id, guest.id, claimsTraitor ? { trust: -32 * credibility } : { trust: 22 * credibility });
    }
    if (claimsTraitor && !guestTraitor) this.matrix.adjust(guest.id, seer.id, { hatred: 35, trust: -40 });
    if (!claimsTraitor) this.matrix.adjust(guest.id, seer.id, { liking: 10, trust: 10 });
  }

  /** Quem abre a porta do salão: o primeiro grupo, alguém sozinho, uma dupla ou um grupo maior. */
  private doorLine(first: boolean, size: number): string {
    if (first) return size > 1 ? `Os primeiros a descer: ${tokenList(size)}.` : '{user} é o(a) primeiro(a) a abrir a porta.';
    if (size === 1) return pickOne(this.rng, ['{user} abre a porta. Alívio no salão.', '{user} entra devagar, contando as cadeiras.', 'A porta range: é {user}.', '{user} aparece na porta e respira fundo.'])!;
    if (size === 2) return pickOne(this.rng, ['{user} e {user1} entram juntos. Abraços.', '{user} e {user1} descem lado a lado.'])!;
    return pickOne(this.rng, [`Mais gente na porta: ${tokenList(size)}.`, `Descem juntos: ${tokenList(size)}.`, `A porta abre de novo: ${tokenList(size)}.`])!;
  }

  /** Quem mais gostava da vítima desaba; quem a vítima desconfiava vira assunto na mesa. */
  private mourn(victim: SimPlayer): void {
    const [closest] = [...this.active].sort((a, b) => this.matrix.get(b.id, victim.id).liking - this.matrix.get(a.id, victim.id).liking);
    if (closest && this.matrix.get(closest.id, victim.id).liking >= 60) {
      // Mesma cena para fiel e traidor: a mesa não pode perceber a diferença (só quem assiste).
      this.say(SimulationEventKind.DIALOGUE, '{user} desaba: {user1} era a pessoa mais próxima dele(a) aqui.', [closest, victim], PhraseTone.EMOTION);
      if (isTraitor(closest)) this.say(SimulationEventKind.SECRET, 'As lágrimas de {user} são de mentira.', [closest]);
    }
    const [suspect] = [...this.active].filter((p) => p !== closest).sort((a, b) => this.matrix.get(victim.id, a.id).trust - this.matrix.get(victim.id, b.id).trust);
    if (suspect && this.matrix.get(victim.id, suspect.id).trust < 35) {
      const speaker = weightedPick(this.rng, this.npcs.filter((p) => p !== suspect && p !== closest), (p) => 100 - this.matrix.get(p.id, suspect.id).trust + p.traits.influence * 0.3);
      if (speaker) {
        this.say(SimulationEventKind.DIALOGUE, '{user} lembra: {user1} desconfiava de {user2}. Os olhares mudam de lado.', [speaker, victim, suspect], PhraseTone.SUSPICION);
        this.social.broadcast(speaker, suspect, { trust: -4 });
      }
    }
  }

  /**
   * Modo Jogador: sem conversa, a relação esfria. A cada manhã, o que o castelo sente pelo jogador
   * volta um pouco para o neutro (menos com os aliados, que cobram no café).
   */
  private coolTowardHuman(): void {
    if (!this.humanId || !this.active.some((p) => this.isHuman(p))) return;
    for (const npc of this.npcs) {
      const f = this.matrix.get(npc.id, this.humanId);
      const rate = f.allied ? 0.02 : 0.06;
      this.matrix.adjust(npc.id, this.humanId, { trust: (45 - f.trust) * rate, liking: (45 - f.liking) * rate });
    }
  }

  /** Personagens que vêm falar a sós com o jogador (fofoca, aviso, convite para aliança...). */
  private approachHuman(moment: ApproachMoment, phase: GamePhase, victim?: SimPlayer): void {
    const human = this.active.find((p) => this.isHuman(p));
    if (!human) return;
    const memory = (this.flags.human ??= {});
    const { events, invites } = approachHuman({
      rng: this.rng,
      matrix: this.matrix,
      alliances: this.alliances,
      human,
      active: this.active,
      byId: this.byId,
      moment,
      phase,
      day: this.day,
      memory,
      lastTable: this.flags.lastTable,
      victim,
      chaos: this.chaos,
    });
    this.narrator.events.push(...events);
    if (invites.length) memory.invites = [...(memory.invites ?? []), ...invites];
  }

  /**
   * Dois aliados muito próximos têm um passado em comum (o casal escondido, mãe e filho...).
   * Quando o segredo vem à tona, o castelo passa a vê-los como um bloco e desconfia dos dois.
   */
  private revealSecretBond(): void {
    const revealed = new Set(this.flags.revealedBonds ?? []);
    const candidates: [SimPlayer, SimPlayer][] = [];
    for (const a of this.active) {
      for (const b of this.active) {
        if (a.id >= b.id || revealed.has(`${a.id}|${b.id}`)) continue;
        if (this.matrix.isAllied(a.id, b.id) && this.matrix.get(a.id, b.id).liking >= 80 && this.matrix.get(b.id, a.id).liking >= 80) candidates.push([a, b]);
      }
    }
    const bond = pickOne(this.rng, candidates);
    if (!bond || !chance(this.rng, 0.15)) return;
    const [a, b] = bond;
    this.flags.revealedBonds = [...revealed, `${a.id}|${b.id}`];
    const secret = pickOne(this.rng, ['já se conheciam antes do jogo', 'estão juntos fora do castelo', 'são da mesma família']) ?? 'já se conheciam';
    this.say(SimulationEventKind.REVEAL, `Bomba no café: {user} e {user1} confessaram que ${secret}. O castelo se sentiu enganado.`, [a, b]);
    for (const other of this.active) {
      if (other === a || other === b) continue;
      this.matrix.adjust(other.id, a.id, { trust: -6 });
      this.matrix.adjust(other.id, b.id, { trust: -6 });
    }
  }

  /** Raramente alguém deixa o jogo por motivos pessoais (mais com loucura). */
  private maybeWithdraw(): string | null {
    if (this.options.withdrawals === false || this.active.length <= 6 || !chance(this.rng, 0.012 + this.chaos * 0.04)) return null;
    const leaving = weightedPick(this.rng, this.npcs, (p) => 0.5 + p.traits.volatility / 100);
    if (!leaving) return null;
    this.say(SimulationEventKind.REVEAL, '{user} reuniu todos no salão e anunciou que vai deixar o castelo por motivos pessoais. Ninguém esperava.', [leaving]);
    this.remove(leaving.id);
    return leaving.id;
  }

  mission(def: MissionDefinition): MissionOutcome {
    this.say(SimulationEventKind.MISSION_STEP, `${def.name}. ${def.description}`);
    const ctx = new MissionContext(this.rng, this.matrix, shuffle(this.rng, this.active), this.narrator, this.social, this.options.money, this.chaos);
    const outcome = def.play(ctx);
    let prizeEarned = Math.max(0, Math.min(def.prizeAvailable, Math.round(outcome.prizeEarned)));
    const shieldIds = [...new Set(outcome.shieldIds)];

    if (ctx.twists.poisonTonight) this.flags.poisonArmedDay = this.day;
    if (ctx.twists.seerId) this.flags.seer = { day: this.day, seerId: ctx.twists.seerId };
    if (ctx.twists.dungeonIds?.length) this.flags.dungeon = { day: this.day, playerIds: ctx.twists.dungeonIds };
    if (ctx.twists.noMurderTonight) this.flags.noMurderDay = this.day;

    // A tentação: um escudo pessoal em troca de parte do dinheiro do grupo.
    if (!this.flags.temptationUsed && this.active.length >= 6 && prizeEarned > 0 && chance(this.rng, 0.15)) {
      const tempted = weightedPick(this.rng, this.npcs.filter((p) => !shieldIds.includes(p.id)), (p) => p.traits.skill + 10);
      if (tempted) {
        this.flags.temptationUsed = true;
        this.say(SimulationEventKind.MISSION_STEP, 'No fim da missão, uma oferta a {user}: um escudo só seu, em troca de um quarto do dinheiro do grupo.', [tempted]);
        const refuses = surprises(this.rng, this.chaos, tempted) ? chance(this.rng, 0.5) : chance(this.rng, clamp(tempted.traits.loyalty / 100 + 0.1));
        if (refuses) {
          for (const other of this.active) if (other.id !== tempted.id) this.matrix.adjust(other.id, tempted.id, { liking: 6, trust: 5 });
          this.say(SimulationEventKind.MISSION_STEP, '{user} recusou o escudo e o dinheiro ficou inteiro no pote. Aplausos no salão.', [tempted]);
        } else {
          prizeEarned = Math.round(prizeEarned * 0.75);
          shieldIds.push(tempted.id);
          for (const other of this.active) if (other.id !== tempted.id) this.matrix.adjust(other.id, tempted.id, { trust: -6, hatred: 4 });
          this.say(SimulationEventKind.SHIELD, '{user} aceitou o escudo. O pote encolheu e os olhares também.', [tempted]);
        }
      }
    }

    this.say(SimulationEventKind.NARRATION, `Fim da missão: ${this.options.money(prizeEarned)} de ${this.options.money(def.prizeAvailable)} vão para o prêmio.`);
    this.approachHuman('MISSION', GamePhase.MISSION);
    return { prizeEarned, shieldIds };
  }

  /**
   * Mesa redonda: debate, votos e o banimento. Devolve null quando houve empate e a revotação
   * espera o voto do jogador; a próxima chamada (com o voto) continua de onde parou.
   */
  roundTable(humanVoteId?: string): { votes: SimVote[]; banishedId: string } | null {
    const pending = this.pendingRevote('ROUND_TABLE');
    let result: { votes: SimVote[]; banishedId: string } | null;
    if (pending) {
      result = this.resumeRevote(pending, humanVoteId);
    } else {
      this.say(SimulationEventKind.NARRATION, `As velas estão acesas. ${this.active.length} jogadores se sentam à mesa redonda.`);
      this.stances.clear();
      this.rememberLastVote();
      this.talk(PhrasePhase.ROUND_TABLE, this.lines(2), ROUND_TABLE_TONES);
      result = this.banishmentVote({ table: 'ROUND_TABLE' }, undefined, this.humanVote(humanVoteId));
    }
    if (!result) return null;
    this.talk(PhrasePhase.ROUND_TABLE, 2, REACTION_TONES, { victim: this.byId.get(result.banishedId), aboutVictim: true });
    return result;
  }

  /** Empate desta mesa esperando o voto do jogador. */
  private pendingRevote(table: PendingRevote['table']): PendingRevote | undefined {
    const pending = this.flags.pendingRevote;
    return pending?.day === this.day && pending.table === table ? pending : undefined;
  }

  /**
   * Reta final, como na 3ª temporada: primeiro a última mesa redonda (banimento sem revelação);
   * depois, o Fogo da Verdade: todos escolhem encerrar ou banir mais alguém. Só acaba com unanimidade;
   * senão, mais um banimento (também sem revelação) e de volta ao fogo.
   */
  endgame(human?: HumanEndgameChoice, firstRound = 1): EndgameRound[] {
    const rounds: EndgameRound[] = [];
    // Com o jogador humano na mesa, cada chamada é uma rodada: ele decide a próxima depois de ver o resultado.
    const humanPlaying = this.active.some((p) => this.isHuman(p));
    // Continuação de um empate: termina a rodada com o voto do jogador na revotação.
    const pending = this.pendingRevote('ENDGAME');
    if (pending) {
      const result = this.resumeRevote(pending, human?.voteTargetId);
      rounds.push({ endgameVotes: pending.endgameVotes ?? [], ...result });
      if (humanPlaying && this.active.some((p) => this.isHuman(p))) return rounds;
      firstRound = (pending.round ?? firstRound) + 1;
    }
    for (let round = firstRound; ; round++) {
      if (isFinalTableRound(round, this.active.length)) {
        this.say(SimulationEventKind.NARRATION, `A última mesa redonda. Restam ${this.active.length}. Hoje alguém sai, e sai levando o segredo: não haverá revelação.`);
        this.stances.clear();
        this.rememberLastVote();
        this.talk(PhrasePhase.ROUND_TABLE, this.lines(2), ROUND_TABLE_TONES);
        this.talk(PhrasePhase.ENDGAME, 1, ENDGAME_TONES);
        const endgameVotes = this.active.map((p) => ({ voterId: p.id, choice: EndgameChoice.BANISH_AGAIN }));
        const result = this.banishmentVote({ table: 'ENDGAME', round, endgameVotes }, undefined, this.humanVote(human?.voteTargetId));
        if (!result) return rounds;
        rounds.push({ endgameVotes, ...result });
        if (humanPlaying && this.active.some((p) => this.isHuman(p))) return rounds;
        continue;
      }
      this.say(
        SimulationEventKind.NARRATION,
        `O Fogo da Verdade. Restam ${this.active.length}. Cada um joga a sua escolha nas chamas: encerrar o jogo ou banir mais alguém. Para acabar, todos precisam concordar.`,
      );
      this.stances.clear();
      this.talk(PhrasePhase.ENDGAME, 2, ENDGAME_TONES);

      const confessor = this.confession();
      const forceEnd = !confessor && (this.active.length <= 2 || round > 8);
      const endgameVotes = this.active.map((p) => ({ voterId: p.id, choice: this.fireChoice(p, round, confessor, forceEnd, human) }));
      for (const v of endgameVotes) {
        const text = v.choice === EndgameChoice.END_GAME ? '{user} jogou no fogo: encerrar o jogo.' : '{user} jogou no fogo: banir mais alguém.';
        this.say(SimulationEventKind.VOTE, text, [this.byId.get(v.voterId)!]);
      }

      if (endgameVotes.every((v) => v.choice === EndgameChoice.END_GAME)) {
        this.say(SimulationEventKind.NARRATION, 'Unanimidade no Fogo da Verdade. O jogo acabou: hora de revelar quem é quem.');
        this.finalReveal();
        rounds.push({ endgameVotes, votes: [], banishedId: null });
        return rounds;
      }
      const against = endgameVotes.filter((v) => v.choice === EndgameChoice.BANISH_AGAIN).length;
      this.say(SimulationEventKind.NARRATION, `${against} ${against === 1 ? 'pessoa não confia' : 'pessoas não confiam'} em todos à volta do fogo. Mais um banimento, também sem revelação.`);
      const result = this.banishmentVote({ table: 'ENDGAME', round, endgameVotes }, confessor?.id, this.humanVote(human?.voteTargetId));
      // Empate: a rodada fica em suspenso até o jogador votar na revotação.
      if (!result) return rounds;
      rounds.push({ endgameVotes, ...result });
      // O jogador decide a próxima rodada; se ele acabou de ser banido, o resto da final segue sozinho.
      if (humanPlaying && this.active.some((p) => this.isHuman(p))) return rounds;
    }
  }

  /** O que cada um joga no Fogo da Verdade: quem confessou quer sair; com 2 ou menos (ou rodadas demais), encerra. */
  private fireChoice(p: SimPlayer, round: number, confessor: SimPlayer | undefined, forceEnd: boolean, human?: HumanEndgameChoice): EndgameChoice {
    if (p === confessor) return EndgameChoice.BANISH_AGAIN;
    if (forceEnd) return EndgameChoice.END_GAME;
    if (this.isHuman(p) && human) return human.choice;
    return endgameChoice(this.rng, this.matrix, p, this.active, round, this.chaos);
  }

  /** Fim do jogo: os finalistas mostram quem são, e os banidos da reta final têm o papel revelado. */
  private finalReveal(): void {
    for (const p of this.active) {
      this.say(SimulationEventKind.REVEAL, isTraitor(p) ? '{user} revela: "Eu sou Traidor(a)."' : '{user} revela: "Eu sou Fiel."', [p]);
    }
    for (const id of this.flags.hiddenRoles ?? []) {
      const p = this.byId.get(id);
      if (p) this.say(SimulationEventKind.REVEAL, isTraitor(p) ? 'E a dúvida acaba: {user}, banido(a) na reta final, era Traidor(a).' : 'E a dúvida acaba: {user}, banido(a) na reta final, era Fiel.', [p]);
    }
    const traitors = this.active.filter(isTraitor);
    let outcome = 'Só Fiéis à volta do fogo: o prêmio é dividido entre eles.';
    if (traitors.length) {
      const who = traitors.length > 1 ? 'Traidores chegaram' : 'Um(a) Traidor(a) chegou';
      outcome = `${who} ao fim sem ser descoberto(a): o prêmio inteiro vai para a torre.`;
    }
    this.say(SimulationEventKind.NARRATION, outcome);
  }

  /**
   * A mesa lembra da votação anterior: se o banido era Fiel, quem gostava dele(a) cobra quem puxou o voto;
   * se era Traidor(a), quem votou em outra pessoa precisa se explicar. A cobrança vira postura no voto de hoje.
   */
  private rememberLastVote(): void {
    const table = this.flags.lastTable;
    // Banido sem revelação: ninguém sabe se a mesa acertou.
    if (!table || table.day !== this.day - 1 || table.revealed === false) return;
    const banished = this.byId.get(table.banishedId);
    if (!banished) return;
    const present = (id: string) => this.active.find((p) => p.id === id);
    const voters = table.votes.filter((v) => v.targetId === banished.id).map((v) => present(v.voterId)).filter((p): p is SimPlayer => !!p);
    const others = table.votes.filter((v) => v.targetId !== banished.id).map((v) => present(v.voterId)).filter((p): p is SimPlayer => !!p);

    if (!table.traitor) {
      // Fiel banido: quem gostava dele(a) vai atrás de quem votou.
      const mourner = [...this.npcs].filter((p) => !voters.includes(p)).sort((a, b) => this.matrix.get(b.id, banished.id).liking - this.matrix.get(a.id, banished.id).liking)[0];
      const culprit = mourner && [...voters].filter((v) => v !== mourner).sort((a, b) => this.matrix.get(mourner.id, a.id).trust - this.matrix.get(mourner.id, b.id).trust)[0];
      if (mourner && culprit && this.matrix.get(mourner.id, banished.id).liking >= 55) {
        this.say(SimulationEventKind.DIALOGUE, '{user} não esqueceu: {user1} votou em {user2}, que era Fiel.', [mourner, culprit, banished], PhraseTone.ACCUSATION);
        this.takeStance(mourner.id, culprit.id, PhraseTone.ACCUSATION);
        this.social.broadcast(mourner, culprit, { trust: -5 });
      }
      return;
    }
    // Traidor banido: quem não votou nele(a) é cobrado(a) por quem acertou.
    const accuser = weightedPick(this.rng, voters.filter((p) => !this.isHuman(p)), (p) => p.traits.influence + p.traits.aggression * 0.5);
    const dodger = accuser && [...others].sort((a, b) => this.matrix.get(accuser.id, a.id).trust - this.matrix.get(accuser.id, b.id).trust)[0];
    if (accuser && dodger && chance(this.rng, 0.7)) {
      this.say(SimulationEventKind.DIALOGUE, '{user} cobrou {user1}: "Por que você não votou em {user2}?"', [accuser, dodger, banished], PhraseTone.SUSPICION);
      this.takeStance(accuser.id, dodger.id, PhraseTone.SUSPICION);
      this.social.broadcast(accuser, dodger, { trust: -4 });
    }
  }

  /** Voto do humano, se ele ainda está no jogo e o alvo também. */
  private humanVote(targetId?: string): Map<string, string> | undefined {
    if (!this.humanId || !targetId) return undefined;
    if (!this.active.some((p) => p.id === this.humanId) || !this.active.some((p) => p.id === targetId)) return undefined;
    return new Map([[this.humanId, targetId]]);
  }

  /**
   * Na mesa final, um traidor que se apegou demais aos fiéis pode confessar e sair,
   * deixando o prêmio para quem ficou.
   */
  private confession(): SimPlayer | undefined {
    if (this.flags.confessionUsed || this.active.length < 3) return undefined;
    const ids = this.active.map((p) => p.id);
    const candidate = this.npcs.find((p) => {
      if (!isTraitor(p)) return false;
      const affection = this.active.filter((o) => !isTraitor(o)).reduce((s, o) => s + this.matrix.get(p.id, o.id).liking, 0) / Math.max(1, ids.length - 1);
      return p.traits.loyalty >= 60 && affection >= 62;
    });
    if (!candidate || !chance(this.rng, 0.35)) return undefined;
    this.flags.confessionUsed = true;
    this.say(SimulationEventKind.REVEAL, '{user} se levantou, trêmulo(a): "Eu não consigo mais mentir para vocês. Eu sou Traidor(a)." A mesa ficou em choque.', [candidate]);
    return candidate;
  }

  traitorsMeeting(context: RecruitmentContext, humanChoice?: HumanTowerChoice): MeetingDecision {
    const none: MeetingDecision = { murderTargetId: null, recruitment: null, plainSight: false };
    const traitors = this.active.filter(isTraitor);
    const faithful = this.active.filter((p) => !isTraitor(p));
    if (traitors.length === 0) {
      this.say(SimulationEventKind.NARRATION, 'A torre está vazia: não resta nenhum Traidor no castelo.');
      return none;
    }
    this.say(SimulationEventKind.SECRET, `Na torre, à luz de velas, ${tokenList(traitors.length)} ${traitors.length > 1 ? 'se reúnem' : 'se senta sozinho(a)'}.`, traitors);
    if (murdersOver(this.active.length)) {
      this.say(SimulationEventKind.SECRET, 'As regras mudaram: não há mais assassinatos. Daqui em diante, o jogo se decide à mesa, no olho no olho.');
      return none;
    }
    if (faithful.length === 0) {
      this.say(SimulationEventKind.SECRET, 'Não há mais Fiéis para assassinar.');
      return none;
    }
    if (this.flags.noMurderDay === this.day) {
      this.talk(PhrasePhase.TRAITORS_MEETING, 1, TOWER_TONES, { speakers: traitors, tower: true });
      this.say(SimulationEventKind.SECRET, 'A missão de hoje fechou a torre: os Traidores só podem conversar. Ninguém morre esta noite.');
      return none;
    }

    const dungeon = this.flags.dungeon?.day === this.day ? this.flags.dungeon.playerIds.filter((id) => faithful.some((f) => f.id === id)) : [];
    const poison = this.flags.poisonArmedDay === this.day && this.flags.poisonDay === undefined;
    const coffinNight = isCoffinNight(this.flags, this.day, this.active.length, this.options.coffins ?? true);
    if (coffinNight) this.say(SimulationEventKind.SECRET, 'Esta noite é diferente: o assassinato será à vista de todos. Os Traidores escrevem três nomes para os caixões; um deles será pregado.');

    const human = traitors.find((p) => this.isHuman(p));
    if (human) return this.humanTower(traitors, human, humanChoice ?? {}, dungeon, poison, coffinNight);

    // Recrutamento nunca em duas noites seguidas, e quem já recusou não recebe outro convite.
    const candidates = faithful.filter((p) => !context.declinedIds.includes(p.id));
    const lonely = traitors.length === 1 && this.active.length >= 5;
    const reinforce = traitors.length < context.originalTraitors && context.recruitmentsSoFar === 0 && chance(this.rng, 0.45);
    if (!coffinNight && !dungeon.length && !poison && !context.recruitedLastNight && candidates.length >= 1 && faithful.length >= 2 && (lonely || reinforce)) {
      return this.recruit(traitors, candidates, context.declinedIds.length > 0);
    }

    if (dungeon.length) {
      this.say(SimulationEventKind.SECRET, `A missão limitou a escolha: só ${tokenList(dungeon.length)} podem morrer esta noite.`, dungeon.map((id) => this.byId.get(id)!));
    }
    this.talk(PhrasePhase.TRAITORS_MEETING, Math.min(4, traitors.length + 1), TOWER_TONES, { speakers: traitors, tower: true });
    const decision = decideMurder(this.rng, this.matrix, traitors, this.active, this.chaos, dungeon);
    const target = decision.targetId ? this.byId.get(decision.targetId) : undefined;
    for (const p of decision.proposals) {
      if (p.targetId === decision.targetId) continue;
      this.say(SimulationEventKind.SECRET, '{user} queria {user1}, mas foi voto vencido.', [this.byId.get(p.traitorId)!, this.byId.get(p.targetId)!]);
      this.matrix.adjust(p.traitorId, traitors.find((t) => t.id !== p.traitorId)?.id ?? p.traitorId, { liking: -3 });
    }
    if (!target) return none;
    if (coffinNight) return this.coffins(traitors, target, this.coffinCompanions(traitors, target));
    if (poison) {
      this.flags.poisonDay = this.day;
      const poisoner = weightedPick(this.rng, traitors, (p) => p.traits.deception + 10)!;
      this.say(SimulationEventKind.SECRET, 'À vista de todos, {user} serviu a taça envenenada a {user1}. Escudo nenhum protege contra veneno.', [poisoner, target], PhraseTone.STRATEGY);
      return { murderTargetId: target.id, recruitment: null, plainSight: true };
    }
    this.say(SimulationEventKind.SECRET, 'Decisão tomada: {user} vai morrer esta noite.', [target], PhraseTone.STRATEGY);
    return { murderTargetId: target.id, recruitment: null, plainSight: false };
  }

  /**
   * Os outros dois nomes dos caixões. Às vezes um traidor se oferece para deitar no caixão e sair
   * "limpo" (o que no programa os traidores cogitaram); os demais são fiéis que confundem a mesa.
   */
  private coffinCompanions(traitors: SimPlayer[], victim: SimPlayer): SimPlayer[] {
    const faithful = this.active.filter((p) => !isTraitor(p) && p !== victim);
    const companions: SimPlayer[] = [];
    const bold = [...traitors].sort((a, b) => b.traits.deception - a.traits.deception)[0];
    if (bold && traitors.length > 1 && chance(this.rng, 0.15 + bold.traits.deception / 400)) {
      companions.push(bold);
      this.say(SimulationEventKind.SECRET, '{user} teve a ideia ousada de entrar no próprio caixão: sair vivo(a) dali limpa qualquer suspeita.', [bold]);
    }
    const pool = faithful.filter((p) => !companions.includes(p));
    while (companions.length < 2 && pool.length) {
      const pick = weightedPick(this.rng, pool, (p) => 10 + this.matrix.toward(p.id, this.active.map((x) => x.id)).liking * 0.4 + p.traits.influence * 0.3)!;
      pool.splice(pool.indexOf(pick), 1);
      companions.push(pick);
    }
    return companions;
  }

  /** Registra a noite dos caixões: três nomes em público, um caixão pregado (escudo não protege). */
  private coffins(traitors: SimPlayer[], victim: SimPlayer, companions: SimPlayer[]): MeetingDecision {
    const names = shuffle(this.rng, [victim, ...companions]);
    this.flags.coffins = { day: this.day, playerIds: names.map((p) => p.id), victimId: victim.id };
    this.say(SimulationEventKind.SECRET, `Os nomes dos caixões: ${tokenList(names.length)}.`, names);
    this.say(SimulationEventKind.SECRET, `${traitors.length > 1 ? 'Os Traidores decidem' : '{user1} decide'}: o caixão de {user} será pregado ao amanhecer.`, [victim, traitors[0]], PhraseTone.STRATEGY);
    return { murderTargetId: victim.id, recruitment: null, plainSight: true };
  }

  private recruit(traitors: SimPlayer[], candidates: SimPlayer[], someoneDeclined: boolean): MeetingDecision {
    const target = surprises(this.rng, this.chaos) ? pickOne(this.rng, candidates)! : recruitmentTarget(this.matrix, traitors, [...traitors, ...candidates])!;
    // Depois de uma recusa, o traidor sozinho endurece: vira ultimato.
    const ultimatum = traitors.length === 1 && (this.active.length <= 8 || someoneDeclined || chance(this.rng, 0.3));
    this.talk(PhrasePhase.TRAITORS_MEETING, 1, { [T.STRATEGY]: 9, [T.CONFLICT]: 1 }, { speakers: traitors, tower: true });
    if (this.isHuman(target)) {
      // O jogador precisa responder: a noite fica em suspenso até lá.
      if (ultimatum) {
        this.say(SimulationEventKind.RECRUITMENT, 'Batem à porta do quarto de {user}. É {user1}, de capa preta: "Junte-se a nós ou morra esta noite."', [target, traitors[0]]);
      } else {
        this.say(SimulationEventKind.RECRUITMENT, 'Uma carta lacrada com cera aparece embaixo da porta de {user}: os Traidores querem você.', [target]);
      }
      return { murderTargetId: null, recruitment: null, plainSight: false, awaitingHuman: { day: this.day, ultimatum, recruiterId: traitors[0].id } };
    }
    if (ultimatum) {
      this.say(SimulationEventKind.RECRUITMENT, '{user} encara {user1} e dá o ultimato: juntar-se aos Traidores ou morrer esta noite.', [traitors[0], target]);
    } else {
      this.say(SimulationEventKind.RECRUITMENT, 'Uma carta lacrada com cera chega ao quarto de {user}: um convite para trair.', [target]);
    }
    const accepted = acceptsRecruitment(this.rng, target, ultimatum, this.chaos);
    if (accepted) {
      target.role = PlayerRole.TRAITOR;
      this.social.bondTraitors([...traitors, target]);
      this.say(SimulationEventKind.RECRUITMENT, '{user} aceitou. O castelo tem um(a) novo(a) Traidor(a).', [target]);
      // Ultimato aceito: recrutador e recrutado escolhem juntos a vítima da noite.
      if (ultimatum) return this.firstMurderTogether([...traitors, target], target);
    } else if (ultimatum) {
      this.say(SimulationEventKind.MURDER, '{user} recusou o ultimato e pagou com a vida.', [target]);
    } else {
      this.say(SimulationEventKind.RECRUITMENT, '{user} rasgou a carta. Não haverá assassinato esta noite.', [target]);
    }
    return { murderTargetId: null, recruitment: { targetId: target.id, accepted, isUltimatum: ultimatum }, plainSight: false };
  }

  /**
   * Regra das temporadas recentes: quem aceita o ultimato já sobe para a torre
   * e assassina outro fiel junto com quem o(a) recrutou, na mesma noite.
   */
  private firstMurderTogether(traitors: SimPlayer[], recruit: SimPlayer): MeetingDecision {
    const recruitment = { targetId: recruit.id, accepted: true, isUltimatum: true };
    const [recruiter] = traitors;
    this.say(SimulationEventKind.SECRET, 'Pacto selado. {user} leva {user1} até a torre: o primeiro assassinato dos dois é hoje.', [recruiter, recruit]);
    this.talk(PhrasePhase.TRAITORS_MEETING, 2, TOWER_TONES, { speakers: traitors, tower: true });
    const decision = decideMurder(this.rng, this.matrix, traitors, this.active, this.chaos);
    const target = decision.targetId ? this.byId.get(decision.targetId) : undefined;
    if (!target) {
      this.say(SimulationEventKind.SECRET, 'Não sobrou nenhum fiel para assassinar.');
      return { murderTargetId: null, recruitment, plainSight: false };
    }
    const disagreement = decision.proposals.find((p) => p.traitorId === recruit.id && p.targetId !== target.id);
    if (disagreement) {
      this.say(SimulationEventKind.SECRET, 'Recém-chegado(a), {user} sugeriu {user1}, mas quem manda na torre ainda é {user2}.', [recruit, this.byId.get(disagreement.targetId)!, recruiter]);
    }
    this.say(SimulationEventKind.SECRET, 'Juntos, {user} e {user1} escolhem a vítima: {user2} vai morrer esta noite.', [recruiter, recruit, target], PhraseTone.STRATEGY);
    return { murderTargetId: target.id, recruitment, plainSight: false };
  }

  /**
   * Torre com o jogador humano traidor. Ele recruta (carta ou, se estiver sozinho, ultimato)
   * ou propõe a vítima; os outros traidores também propõem e vale a maioria (empate: o humano decide).
   */
  private humanTower(traitors: SimPlayer[], human: SimPlayer, choice: HumanTowerChoice, dungeon: string[], poison: boolean, coffinNight = false): MeetingDecision {
    const partners = traitors.filter((p) => p !== human);
    if (partners.length) this.talk(PhrasePhase.TRAITORS_MEETING, Math.min(3, partners.length + 1), TOWER_TONES, { speakers: partners, tower: true });

    // Noite dos caixões: o jogador escreve os três nomes e escolhe qual caixão será pregado.
    if (coffinNight) {
      const victim = choice.murderTargetId ? this.byId.get(choice.murderTargetId) : undefined;
      const companions = (choice.coffinIds ?? []).filter((id) => id !== victim?.id).map((id) => this.byId.get(id)).filter((p): p is SimPlayer => !!p && this.active.includes(p));
      if (victim) return this.coffins(traitors, victim, companions.length ? companions.slice(0, 2) : this.coffinCompanions(traitors, victim));
    }

    if (choice.recruit) {
      const target = this.byId.get(choice.recruit.targetId)!;
      const ultimatum = choice.recruit.ultimatum;
      this.say(
        SimulationEventKind.RECRUITMENT,
        ultimatum ? '{user} encara {user1} e dá o ultimato: juntar-se aos Traidores ou morrer esta noite.' : '{user} manda uma carta lacrada para {user1}: um convite para trair.',
        [human, target],
      );
      const accepted = acceptsRecruitment(this.rng, target, ultimatum, this.chaos);
      const recruitment = { targetId: target.id, accepted, isUltimatum: ultimatum };
      if (accepted) {
        target.role = PlayerRole.TRAITOR;
        this.social.bondTraitors([...traitors, target]);
        this.say(SimulationEventKind.RECRUITMENT, '{user} aceitou. O castelo tem um(a) novo(a) Traidor(a).', [target]);
        const victim = ultimatum && choice.recruit.victimIfAcceptedId ? this.byId.get(choice.recruit.victimIfAcceptedId) : undefined;
        if (victim) {
          this.say(SimulationEventKind.SECRET, 'Juntos, {user} e {user1} escolhem a vítima: {user2} vai morrer esta noite.', [human, target, victim], PhraseTone.STRATEGY);
          return { murderTargetId: victim.id, recruitment, plainSight: false };
        }
      } else if (ultimatum) {
        this.say(SimulationEventKind.MURDER, '{user} recusou o ultimato e pagou com a vida.', [target]);
      } else {
        this.say(SimulationEventKind.RECRUITMENT, '{user} rasgou a carta. Não haverá assassinato esta noite.', [target]);
      }
      return { murderTargetId: null, recruitment, plainSight: false };
    }

    const wanted = choice.murderTargetId ? this.byId.get(choice.murderTargetId) : undefined;
    const npcProposals = this.partnerProposals(partners, dungeon);
    const proposals = [...npcProposals, ...(wanted ? [{ traitorId: human.id, targetId: wanted.id }] : [])];
    const counts = new Map<string, number>();
    for (const p of proposals) counts.set(p.targetId, (counts.get(p.targetId) ?? 0) + 1);
    const max = Math.max(0, ...counts.values());
    const tied = [...counts].filter(([, n]) => n === max).map(([id]) => id);
    const targetId = wanted && tied.includes(wanted.id) ? wanted.id : tied[0] ?? null;
    const target = targetId ? this.byId.get(targetId) : undefined;
    if (!target) {
      this.say(SimulationEventKind.SECRET, 'Os Traidores decidiram não matar ninguém esta noite.');
      return { murderTargetId: null, recruitment: null, plainSight: false };
    }
    if (wanted && wanted.id !== target.id) {
      this.say(SimulationEventKind.SECRET, '{user} queria {user1}, mas os outros traidores decidiram por {user2}.', [human, wanted, target]);
    }
    if (poison) {
      this.flags.poisonDay = this.day;
      this.say(SimulationEventKind.SECRET, 'À vista de todos, {user} serviu a taça envenenada a {user1}. Escudo nenhum protege contra veneno.', [human, target], PhraseTone.STRATEGY);
      return { murderTargetId: target.id, recruitment: null, plainSight: true };
    }
    this.say(SimulationEventKind.SECRET, 'Decisão tomada: {user} vai morrer esta noite.', [target], PhraseTone.STRATEGY);
    return { murderTargetId: target.id, recruitment: null, plainSight: false };
  }

  /**
   * O que cada parceiro vota na torre. Quem foi convencido pelo jogador cumpre o combinado;
   * quem prometeu poupar alguém tira essa pessoa da lista. O combinado vale só para esta noite.
   */
  private partnerProposals(partners: SimPlayer[], dungeon: string[]): { traitorId: string; targetId: string }[] {
    const plan = this.flags.human?.tower?.day === this.day ? this.flags.human.tower : undefined;
    if (this.flags.human) delete this.flags.human.tower;
    const traitors = this.active.filter(isTraitor);
    const faithful = this.active.filter((p) => !isTraitor(p) && (!dungeon.length || dungeon.includes(p.id)));
    const base = murderScores(this.matrix, traitors, this.active);
    const proposals: { traitorId: string; targetId: string }[] = [];
    for (const partner of partners) {
      const pledged = plan?.pledges[partner.id];
      if (pledged && faithful.some((f) => f.id === pledged)) {
        proposals.push({ traitorId: partner.id, targetId: pledged });
        this.say(SimulationEventKind.SECRET, '{user} cumpre o combinado com {user1} e vota em {user2}.', [partner, this.byId.get(this.humanId!)!, this.byId.get(pledged)!]);
        continue;
      }
      const spared = plan?.spares[partner.id] ?? [];
      const options = faithful.filter((f) => !spared.includes(f.id));
      const pool = options.length ? options : faithful;
      const pick = surprises(this.rng, this.chaos, partner)
        ? pickOne(this.rng, pool)
        : softmaxPick(
            this.rng,
            pool,
            (f) => (base.get(f.id) ?? 0) + this.matrix.get(partner.id, f.id).hatred * 0.3 - this.matrix.get(partner.id, f.id).liking * 0.2,
            8,
          );
      if (!pick) continue;
      proposals.push({ traitorId: partner.id, targetId: pick.id });
      this.say(SimulationEventKind.SECRET, spared.length ? '{user} poupa quem você pediu e sugere {user1}.' : '{user} sugere {user1}.', [partner, pick]);
    }
    return proposals;
  }

  /**
   * Credibilidade do jogador: quem ele acusou (ou defendeu) acaba de ser revelado.
   * Acertar faz o castelo ouvi-lo mais; errar, menos.
   */
  private judgeHuman(banished: SimPlayer): void {
    const memory = this.flags.human;
    const human = this.active.find((p) => this.isHuman(p));
    if (!memory || !human || banished.id === human.id) return;
    const others = this.active.filter((p) => p !== human);
    const nudge = (trust: number) => others.forEach((o) => this.matrix.adjust(o.id, human.id, { trust }));
    if (memory.accused?.includes(banished.id)) {
      if (isTraitor(banished)) {
        memory.hits = (memory.hits ?? 0) + 1;
        nudge(7);
        this.say(SimulationEventKind.NARRATION, '{user} tinha acusado {user1} e acertou. O castelo passou a ouvir {user} com outros ouvidos.', [human, banished]);
      } else {
        memory.misses = (memory.misses ?? 0) + 1;
        nudge(-6);
        this.say(SimulationEventKind.NARRATION, '{user} tinha acusado {user1}, que era Fiel. Os olhares se voltaram para {user}.', [human, banished]);
      }
    } else if (memory.defended?.includes(banished.id) && isTraitor(banished)) {
      memory.misses = (memory.misses ?? 0) + 1;
      nudge(-8);
      this.say(SimulationEventKind.NARRATION, '{user} defendeu {user1} até o fim, e {user1} era Traidor(a). Pegou muito mal.', [human, banished]);
    }
  }

  /** Resposta do jogador humano ao convite dos traidores. */
  answerOffer(offer: HumanOffer, accept: boolean, victimId?: string | null): MeetingDecision {
    const human = this.byId.get(this.humanId!)!;
    const recruiter = this.byId.get(offer.recruiterId);
    const recruitment = { targetId: human.id, accepted: accept, isUltimatum: offer.ultimatum };
    if (!accept) {
      if (offer.ultimatum) {
        this.say(SimulationEventKind.MURDER, '{user} recusou o ultimato. A capa preta se aproxima: fim de jogo.', [human]);
      } else {
        this.say(SimulationEventKind.RECRUITMENT, '{user} queimou a carta na lareira. Nenhum traidor vai saber o seu rosto.', [human]);
      }
      return { murderTargetId: null, recruitment, plainSight: false };
    }
    const partners = this.active.filter((p) => isTraitor(p) && p !== human);
    human.role = PlayerRole.TRAITOR;
    this.social.bondTraitors([...partners, human]);
    this.say(SimulationEventKind.RECRUITMENT, '{user} aceitou. Agora é Traidor(a).', [human]);
    if (partners.length) {
      this.say(SimulationEventKind.SECRET, `Na torre, os capuzes caem: ${tokenList(partners.length)} ${partners.length > 1 ? 'são' : 'é'} Traidor(es).`, partners);
    }
    const victim = offer.ultimatum && victimId ? this.byId.get(victimId) : undefined;
    if (victim) {
      this.say(SimulationEventKind.SECRET, 'Juntos, {user} e {user1} escolhem a vítima: {user2} vai morrer esta noite.', [recruiter ?? human, human, victim], PhraseTone.STRATEGY);
      return { murderTargetId: victim.id, recruitment, plainSight: false };
    }
    return { murderTargetId: null, recruitment, plainSight: false };
  }

  // ------------------------------------------------------------------ votação

  /** Pontos extras no voto: o que cada um disse na mesa e a caça dos traidores ao jogador humano. */
  private voteBias(): (voterId: string, targetId: string) => number {
    // Quem acusou na mesa tende a votar no acusado; quem defendeu, a poupar (com loucura, menos).
    // Traidores enxergam o jogador humano como a maior ameaça do castelo: pesam um pouco mais contra ele(a).
    const firmness = 1 - this.chaos * 0.5;
    const hunted = (voterId: string, targetId: string) => (targetId === this.humanId && isTraitor(this.byId.get(voterId)!) ? HUMAN_THREAT : 0);
    return (voterId, targetId) => (this.stances.get(voterId)?.get(targetId) ?? 0) * firmness + hunted(voterId, targetId);
  }

  /** A maioria de quem acusou alguém em voz alta sustenta a acusação no voto, mesmo com loucura. */
  private decidedVotes(players: readonly SimPlayer[], confessorId?: string, forced?: ReadonlyMap<string, string>): Map<string, string> {
    const decided = new Map(forced ?? []);
    if (confessorId) return decided;
    for (const p of players) {
      const accusedId = this.accused(p.id);
      if (!decided.has(p.id) && !this.isHuman(p) && accusedId && players.some((o) => o.id === accusedId) && chance(this.rng, 0.8 - this.chaos * 0.3)) {
        decided.set(p.id, accusedId);
      }
    }
    return decided;
  }

  /**
   * Vota, narra cada voto, revela o banido, deixa as últimas palavras e atualiza os relacionamentos.
   * Empate com o jogador humano na mesa: para depois da primeira rodada e devolve null;
   * a revotação acontece quando ele votar (`resumeRevote`).
   */
  private banishmentVote(
    context: Pick<PendingRevote, 'table' | 'round' | 'endgameVotes'>,
    confessorId?: string,
    forced?: ReadonlyMap<string, string>,
  ): { votes: SimVote[]; banishedId: string } | null {
    const players = [...this.active];
    const bias = this.voteBias();
    const decided = this.decidedVotes(players, confessorId, forced);
    const votes = firstVoteRound(this.rng, this.matrix, players, this.chaos, confessorId, decided, bias);
    this.say(SimulationEventKind.NARRATION, 'Hora de votar. Um a um, os nomes são escritos e revelados.');
    this.narrateVotes(votes, 1, confessorId);

    const leaders = leadersOf(votes, 1);
    if (leaders.length <= 1) return this.finishVote({ votes, banishedId: leaders[0], decidedByLot: false });

    const tied = leaders.map((id) => this.byId.get(id)!);
    this.say(SimulationEventKind.NARRATION, `Empate entre ${tokenList(tied.length)}. Nova votação só entre eles.`, tied);
    if (this.active.some((p) => this.isHuman(p))) {
      this.flags.pendingRevote = {
        day: this.day,
        ...context,
        tiedIds: leaders,
        votes,
        confessorId,
        stances: Object.fromEntries([...this.stances].map(([k, v]) => [k, Object.fromEntries(v)])),
      };
      return null;
    }
    return this.finishRevote(revoteRound(this.rng, this.matrix, players, votes, leaders, this.chaos, decided, bias));
  }

  /** Revotação de um empate com o voto do jogador (só entre os empatados). */
  private resumeRevote(pending: PendingRevote, humanVoteId?: string): { votes: SimVote[]; banishedId: string } {
    delete this.flags.pendingRevote;
    this.stances.clear();
    for (const [speaker, targets] of Object.entries(pending.stances)) this.stances.set(speaker, new Map(Object.entries(targets)));
    const players = [...this.active];
    const forced = this.humanId && humanVoteId && pending.tiedIds.includes(humanVoteId) ? new Map([[this.humanId, humanVoteId]]) : undefined;
    const decided = this.decidedVotes(players, pending.confessorId, forced);
    return this.finishRevote(revoteRound(this.rng, this.matrix, players, pending.votes, pending.tiedIds, this.chaos, decided, this.voteBias()));
  }

  private finishRevote(result: VoteResult): { votes: SimVote[]; banishedId: string } {
    this.narrateVotes(result.votes, 2);
    return this.finishVote(result);
  }

  /** Narra os votos de uma rodada; na primeira, cada voto também mexe nos relacionamentos. */
  private narrateVotes(votes: readonly SimVote[], round: number, confessorId?: string): void {
    for (const v of votes.filter((x) => x.round === round)) {
      const voter = this.byId.get(v.voterId)!;
      const target = this.byId.get(v.targetId)!;
      this.say(SimulationEventKind.VOTE, '{user} votou em {user1}.', [voter, target]);
      if (round !== 1) {
        // Na revotação, votar num aliado também rompe a aliança.
        if (this.social.breakAlliance(voter, target)) this.say(SimulationEventKind.BETRAYAL, '{user} votou no(a) aliado(a) {user1} e está fora da aliança.', [voter, target], PhraseTone.CONFLICT);
        continue;
      }
      this.voteVersusWords(voter, target);
      if (this.social.vote(voter, target)) {
        this.say(SimulationEventKind.BETRAYAL, '{user} votou no(a) aliado(a) {user1} e está fora da aliança.', [voter, target], PhraseTone.CONFLICT);
      }
      if (isTraitor(voter) && isTraitor(target) && v.targetId !== confessorId) {
        this.say(SimulationEventKind.SECRET, '{user} jogou o(a) parceiro(a) de traição, {user1}, embaixo do ônibus para salvar a própria pele.', [voter, target]);
        this.matrix.adjust(target.id, voter.id, { hatred: 25, trust: -30 });
      }
    }
  }

  /** Revela o banido, deixa as últimas palavras e atualiza os relacionamentos. */
  private finishVote({ votes, banishedId, decidedByLot }: VoteResult): { votes: SimVote[]; banishedId: string } {
    const banished = this.byId.get(banishedId)!;
    if (decidedByLot) this.say(SimulationEventKind.NARRATION, 'O empate persistiu e o destino de {user} foi decidido na sorte.', [banished]);
    const received = votes.filter((v) => v.round === Math.max(...votes.map((x) => x.round)) && v.targetId === banishedId).length;
    if (this.active.length <= HIDDEN_ROLE_TABLE) return this.finishHiddenVote(banished, votes, received);
    this.say(
      SimulationEventKind.REVEAL,
      isTraitor(banished)
        ? `Com ${received} voto(s), {user} foi banido(a) e revelou: "Eu sou um(a) Traidor(a)."`
        : `Com ${received} voto(s), {user} foi banido(a) e revelou: "Eu sou Fiel." O castelo errou.`,
      [banished],
    );
    this.social.coVoters(votes);
    this.flags.lastTable = {
      day: this.day,
      banishedId,
      traitor: isTraitor(banished),
      votes: votes.filter((v) => v.round === 1).map(({ voterId, targetId }) => ({ voterId, targetId })),
    };
    this.remove(banishedId);
    this.social.reveal(banished, votes);
    this.judgeHuman(banished);
    this.lastWords(banished);
    return { votes, banishedId };
  }

  /**
   * Reta final: o banido sai sem revelar o papel. O castelo não aprende nada com o voto
   * (quem assiste sabe; o papel só aparece no fim do jogo).
   */
  private finishHiddenVote(banished: SimPlayer, votes: SimVote[], received: number): { votes: SimVote[]; banishedId: string } {
    this.say(SimulationEventKind.NARRATION, `Com ${received} voto(s), {user} foi banido(a). Na reta final não há revelação: {user} deixa a mesa levando o segredo.`, [banished]);
    this.say(SimulationEventKind.SECRET, isTraitor(banished) ? 'Só quem assiste sabe: {user} era Traidor(a).' : 'Só quem assiste sabe: {user} era Fiel.', [banished]);
    this.social.coVoters(votes);
    this.flags.hiddenRoles = [...(this.flags.hiddenRoles ?? []), banished.id];
    this.flags.lastTable = {
      day: this.day,
      banishedId: banished.id,
      traitor: isTraitor(banished),
      revealed: false,
      votes: votes.filter((v) => v.round === 1).map(({ voterId, targetId }) => ({ voterId, targetId })),
    };
    this.remove(banished.id);
    this.lastWords(banished);
    return { votes, banishedId: banished.id };
  }

  /** Compara o voto com o que o jogador disse na mesa: quem fala uma coisa e vota em outra é notado. */
  private voteVersusWords(voter: SimPlayer, target: SimPlayer): void {
    if (this.isHuman(voter)) return;
    const accusedId = this.accused(voter.id);
    const defended = (this.stances.get(voter.id)?.get(target.id) ?? 0) <= STANCE_WEIGHT[T.DEFENSE]!;
    if (accusedId && accusedId !== target.id && this.active.some((p) => p.id === accusedId)) {
      const accused = this.byId.get(accusedId)!;
      this.say(SimulationEventKind.NARRATION, '{user} tinha acusado {user1} na mesa, mas na hora escreveu o nome de {user2}. Ninguém deixou passar.', [voter, accused, target], PhraseTone.SUSPICION);
      this.social.broadcast(accused, voter, { trust: -6 });
      this.matrix.adjust(accused.id, voter.id, { trust: 4, hatred: -4 });
    } else if (defended) {
      this.say(SimulationEventKind.NARRATION, '{user} defendeu {user1} minutos antes e mesmo assim votou nele(a). {user1} não acreditou.', [voter, target], PhraseTone.CONFLICT);
      this.matrix.adjust(target.id, voter.id, { trust: -15, hatred: 12, liking: -8 });
      this.social.broadcast(target, voter, { trust: -5 });
    }
  }

  /**
   * Últimas palavras do banido:
   *  - traidor pouco leal (ou magoado com um parceiro) pode deixar uma pista sobre outro traidor;
   *  - fiel aponta o maior suspeito, e quem confiava nele escuta.
   */
  private lastWords(banished: SimPlayer): void {
    if (this.isHuman(banished)) return;
    const others = this.active.filter((p) => p.id !== banished.id);
    if (!others.length) return;
    if (isTraitor(banished)) {
      const partners = others.filter(isTraitor);
      const grudge = [...partners].sort((a, b) => this.matrix.get(banished.id, b.id).hatred - this.matrix.get(banished.id, a.id).hatred)[0];
      if (grudge && (banished.traits.loyalty < 55 || this.matrix.get(banished.id, grudge.id).hatred > 40) && chance(this.rng, 0.5)) {
        this.say(SimulationEventKind.REVEAL, 'Antes de sair, {user} deixou um recado enigmático que fez todos olharem para {user1}.', [banished, grudge]);
        this.social.broadcast(banished, grudge, { trust: -14 }, 1.4);
      }
      return;
    }
    const suspect = [...others].sort((a, b) => this.matrix.get(banished.id, a.id).trust - this.matrix.get(banished.id, b.id).trust)[0];
    if (suspect && chance(this.rng, 0.6)) {
      this.say(SimulationEventKind.NARRATION, 'Nas últimas palavras, {user} apontou para {user1}: "Não cometam o mesmo erro duas vezes."', [banished, suspect]);
      this.social.broadcast(banished, suspect, { trust: -8 });
    }
  }
}

/** Na reta final, a primeira rodada é a última mesa redonda (com 3 ou mais jogadores); as outras, o Fogo da Verdade. */
export function isFinalTableRound(round: number, activeCount: number): boolean {
  return round === 1 && activeCount >= 3;
}
