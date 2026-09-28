import { PhrasePhase, PhraseTone, SimulationEventKind } from '../../enums';
import { surprises } from '../chaos';
import { Narrator } from '../narration';
import { RelationshipMatrix } from '../RelationshipMatrix';
import { chance, clamp, Rng, shuffle, weightedPick } from '../random';
import { Social } from '../social';
import { isTraitor, SimPlayer } from '../traits';

export interface MissionOutcome {
  prizeEarned: number;
  shieldIds: string[];
}

/** Reviravoltas que uma missão deixa armadas para a noite. */
export interface MissionTwists {
  /** Condenados da masmorra: os traidores só podem assassinar um deles esta noite. */
  dungeonIds?: string[];
  /** A taça envenenada: o assassinato desta noite ignora escudos. */
  poisonTonight?: boolean;
  /** Quem ganhou o poder do Vidente (janta com alguém esta noite e descobre o papel). */
  seerId?: string;
  /** A missão impediu o assassinato desta noite (a estátua dos Traidores explodiu, o monumento se abriu...). */
  noMurderTonight?: boolean;
}

/** Uma opção de escolha do jogador numa missão. */
export interface MissionOption {
  id: string;
  /** Texto do botão; pode usar {user}, {user1}... de `playerIds` da pergunta. */
  label: string;
  /** Opção que é uma pessoa (a tela mostra o retrato). */
  playerId?: string;
}

/** Pergunta que a missão faz ao jogador humano (modo Jogador). */
export interface MissionQuestion {
  /** Tipo da escolha (a mesma pergunta repetida tem o mesmo id). */
  id: string;
  /** Enunciado com {user}, {user1}... na ordem de `playerIds`. */
  prompt: string;
  playerIds: string[];
  options: MissionOption[];
}

/**
 * A missão parou para perguntar algo ao jogador. Como o sorteio da missão tem semente fixa,
 * rodar de novo com as mesmas respostas reproduz tudo até aqui e segue com a nova resposta.
 */
export class MissionPause extends Error {
  constructor(
    readonly question: MissionQuestion,
    /** Quantas das respostas guardadas continuam valendo (as seguintes são descartadas). */
    readonly answered: number,
  ) {
    super('A missão espera a escolha do jogador');
  }
}

/** Missão jogável: roteiro com a ordem dos acontecimentos e as regras de dinheiro e escudos. */
export interface MissionDefinition {
  key: string;
  /** De qual temporada do programa ("EUA T1", "Reino Unido T2"...). */
  origin: string;
  name: string;
  description: string;
  prizeAvailable: number;
  play(ctx: MissionContext): MissionOutcome;
}

/** Ferramentas que o roteiro de uma missão usa para sortear, testar habilidade e narrar. */
export class MissionContext {
  constructor(
    readonly rng: Rng,
    readonly matrix: RelationshipMatrix,
    /** Jogadores presentes, em ordem aleatória. */
    readonly players: readonly SimPlayer[],
    private readonly narrator: Narrator,
    private readonly social: Social,
    /** Formata dinheiro na moeda da temporada. */
    readonly money: (amount: number) => string,
    /** Loucura (0 a 1): resultados que fogem da habilidade. */
    private readonly chaos = 0,
    /** Modo Jogador: o participante do usuário, se está na missão. */
    readonly human: SimPlayer | undefined = undefined,
    /** Respostas que o jogador já deu nesta missão, na ordem das perguntas. */
    private readonly answers: readonly string[] = [],
  ) {}

  private asked = 0;

  /** É o jogador humano. */
  isHuman(p: SimPlayer | undefined): boolean {
    return !!p && !!this.human && p.id === this.human.id;
  }

  /**
   * Pergunta ao jogador. Se ele já respondeu (numa rodada anterior da mesma missão), devolve a resposta;
   * senão, a missão para aqui até a resposta chegar.
   */
  ask(question: MissionQuestion): string {
    const answer = this.answers[this.asked];
    if (answer !== undefined && question.options.some((o) => o.id === answer)) {
      this.asked++;
      return answer;
    }
    throw new MissionPause(question, this.asked);
  }

  /** Quantas perguntas já foram respondidas nesta rodada. */
  get answered(): number {
    return this.asked;
  }

  /** Preenchido pelo roteiro; lido depois da missão. */
  readonly twists: MissionTwists = {};

  /** Traidores presentes (o público sabe quem são). */
  get traitors(): SimPlayer[] {
    return this.players.filter(isTraitor);
  }

  /** Linha do narrador; `text` usa {user}, {user1}... na ordem de `players`. */
  say(text: string, players: readonly SimPlayer[] = []): void {
    this.narrator.line(SimulationEventKind.MISSION_STEP, text, players);
  }

  /** Algo que só o público vê (escudo secreto, poder do Vidente...). */
  secret(text: string, players: readonly SimPlayer[] = []): void {
    this.narrator.line(SimulationEventKind.SECRET, text, players);
  }

  shield(text: string, players: readonly SimPlayer[]): void {
    this.narrator.line(SimulationEventKind.SHIELD, text, players);
  }

  /** Conversas durante a missão, com as frases da biblioteca. */
  chatter(count = 2, among: readonly SimPlayer[] = this.players): void {
    for (let i = 0; i < count; i++) {
      const line = this.narrator.speak(this.matrix, {
        phase: PhrasePhase.MISSION,
        speakers: among,
        audience: this.players,
        tones: {
          [PhraseTone.HUMOR]: 3.8,
          [PhraseTone.NEUTRAL]: 1.7,
          [PhraseTone.CONFLICT]: 1.45,
          [PhraseTone.FRIENDLY]: 1.2,
          [PhraseTone.SUSPICION]: 1,
          [PhraseTone.EMOTION]: 0.5,
          [PhraseTone.ALLIANCE]: 0.35,
        },
      });
      if (line) this.social.applyLine(line);
    }
  }

  /**
   * Testa a habilidade de alguém. Difícil (difficulty alto) derruba a chance; parceiros de quem
   * ele gosta ajudam. Parceiros reagem ao resultado: sucesso rende simpatia, fracasso rende rancor.
   */
  attempt(player: SimPlayer, difficulty = 50, partners: readonly SimPlayer[] = []): boolean {
    const others = partners.filter((p) => p.id !== player.id);
    const teamwork = others.length
      ? others.reduce((sum, q) => sum + (this.matrix.get(q.id, player.id).liking + this.matrix.get(player.id, q.id).liking) / 2 - 50, 0) / others.length / 250
      : 0;
    const expected = clamp(0.62 + (player.traits.skill - difficulty) / 110 + teamwork, 0.05, 0.95);
    const success = chance(this.rng, surprises(this.rng, this.chaos, player) ? 0.5 : expected);
    for (const partner of others) {
      if (success) this.matrix.adjust(partner.id, player.id, { liking: 2, trust: 1 });
      else this.matrix.adjust(partner.id, player.id, { trust: -2, hatred: 2 }, 0.6 + partner.traits.volatility / 100);
    }
    return success;
  }

  /** Divide todos em `count` equipes equilibradas. */
  teams(count: number): SimPlayer[][] {
    const teams: SimPlayer[][] = Array.from({ length: count }, () => []);
    shuffle(this.rng, this.players).forEach((p, i) => teams[i % count].push(p));
    return teams;
  }

  /** Duplas por afinidade: cada um procura quem mais gosta entre os que sobraram. */
  pairs(max = Infinity): [SimPlayer, SimPlayer][] {
    const free = shuffle(this.rng, this.players);
    const pairs: [SimPlayer, SimPlayer][] = [];
    while (free.length >= 2 && pairs.length < max) {
      const a = free.shift()!;
      const b = weightedPick(this.rng, free, (q) => (this.matrix.get(a.id, q.id).liking + this.matrix.get(q.id, a.id).liking + 10) ** 2)!;
      free.splice(free.indexOf(b), 1);
      pairs.push([a, b]);
    }
    return pairs;
  }

  /** Sorteia `count` pessoas diferentes, com chance proporcional ao peso. */
  pick(count: number, weight: (p: SimPlayer) => number = () => 1, pool: readonly SimPlayer[] = this.players): SimPlayer[] {
    const left = [...pool];
    const chosen: SimPlayer[] = [];
    while (chosen.length < count && left.length) {
      const p = weightedPick(this.rng, left, weight)!;
      left.splice(left.indexOf(p), 1);
      chosen.push(p);
    }
    return chosen;
  }

  /** Quem o grupo mais gosta (média de simpatia recebida). */
  popularity(p: SimPlayer): number {
    return this.matrix.toward(p.id, this.players.map((x) => x.id)).liking;
  }

  /**
   * Imprevisto: acontece com a chance dada (a loucura deixa tudo mais provável).
   * Serve para quebrar a ordem fixa dos acontecimentos de uma missão.
   */
  happens(probability: number): boolean {
    return chance(this.rng, clamp(probability * (1 + this.chaos * 1.5), 0, 0.95));
  }

  /** Um item qualquer da lista, sorteado. */
  oneOf<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  /** Número inteiro entre `min` e `max` (inclusive). */
  between(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  /** Relógio da missão: quando o tempo acaba, o que faltava não conta. */
  clock(limitMinutes: number): MissionClock {
    return new MissionClock(limitMinutes);
  }

  /** Todos passam a gostar um pouco mais de quem se destacou. */
  applaud(player: SimPlayer, amount = 3): void {
    for (const other of this.players) if (other.id !== player.id) this.matrix.adjust(other.id, player.id, { liking: amount });
  }

  /** O que alguém diz sobre outro chega a todos (como numa acusação). */
  spread(speaker: SimPlayer, target: SimPlayer, trust: number): void {
    this.social.broadcast(speaker, target, { trust });
  }
}

/** Minutos de uma missão cronometrada. */
export class MissionClock {
  private used = 0;
  constructor(readonly limit: number) {}

  /** Gasta minutos; devolve false se o tempo estourou. */
  spend(minutes: number): boolean {
    this.used += Math.max(0, minutes);
    return this.used <= this.limit;
  }

  get elapsed(): number {
    return Math.round(this.used);
  }

  get left(): number {
    return Math.max(0, Math.round(this.limit - this.used));
  }

  get over(): boolean {
    return this.used > this.limit;
  }
}
