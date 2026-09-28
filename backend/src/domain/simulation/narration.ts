import { PhrasePhase, PhraseTone, SimulationEventKind } from '../enums';
import { surprises } from './chaos';
import { publicSuspicion } from './decisions';
import { RelationshipMatrix } from './RelationshipMatrix';
import { Rng, weightedPick } from './random';
import { isTraitor, SimPlayer, Traits } from './traits';

/** Frase da biblioteca como a simulação usa. */
export interface PhraseTemplate {
  id: string;
  phase: PhrasePhase;
  tone: PhraseTone;
  behaviorId: string | null;
  text: string;
}

export interface NarratedEvent {
  kind: SimulationEventKind;
  tone: PhraseTone | null;
  /** Marcadores {user}, {user1}... na ordem de playerIds. */
  text: string;
  playerIds: string[];
  /** Conversa particular: no modo Jogador, só quem está nela vê (quem assiste vê tudo). */
  isPrivate?: boolean;
}

/** Uma fala escolhida: quem falou, de quem falou e com qual frase. */
export interface SpokenLine {
  phrase: PhraseTemplate;
  speaker: SimPlayer;
  target?: SimPlayer;
  second?: SimPlayer;
  event: NarratedEvent;
}

export interface DialogueScene {
  phase: PhrasePhase;
  /** Quem pode falar. */
  speakers: readonly SimPlayer[];
  /** De quem se pode falar (jogadores presentes). */
  audience: readonly SimPlayer[];
  /** Quem acabou de sair do jogo ({victim}). */
  victim?: SimPlayer;
  /** Peso de cada teor neste momento (teor ausente = não usado). */
  tones: Partial<Record<PhraseTone, number>>;
  /** Torre: {user1} é um fiel e os demais marcadores são outros traidores. */
  tower?: boolean;
  /** Só frases que citam {victim} (reações logo depois de uma saída). */
  aboutVictim?: boolean;
  /** Conversas de canto (chegada, café): só quem fala e de quem se fala ficam sabendo. */
  private?: boolean;
}

const TOKEN = /\{(user\d*|victim)\}/g;
/** Personagem com o comportamento da frase: chance multiplicada; sem o comportamento: reduzida. */
const BEHAVIOR_MATCH = 6;
const BEHAVIOR_MISMATCH = 0.25;

/** Registro de tudo que é narrado numa fase, na ordem. */
export class Narrator {
  readonly events: NarratedEvent[] = [];
  private readonly spokenBy = new Map<string, number>();
  private readonly usedPhrases = new Set<string>();

  constructor(
    private readonly rng: Rng,
    private readonly phrases: readonly PhraseTemplate[],
    /** Loucura (0 a 1): falas fora do perfil de quem fala e alvos ao acaso. */
    private readonly chaos = 0,
  ) {}

  /** Linha do narrador. `text` usa {user}, {user1}... na mesma ordem de `players`. */
  line(kind: SimulationEventKind, text: string, players: readonly { id: string }[] = [], tone: PhraseTone | null = null, isPrivate = false): NarratedEvent {
    const event: NarratedEvent = { kind, tone, text, playerIds: players.map((p) => p.id), ...(isPrivate && { isPrivate }) };
    this.events.push(event);
    return event;
  }

  /** Escolhe quem fala, a frase (pelo teor e pelos comportamentos) e quem ocupa cada marcador. */
  speak(matrix: RelationshipMatrix, scene: DialogueScene): SpokenLine | null {
    for (let attempt = 0; attempt < 6; attempt++) {
      // Reação a uma saída: fala mais quem tinha um laço (bom ou ruim) com quem saiu.
      const bond = (p: SimPlayer) => {
        if (!scene.aboutVictim || !scene.victim) return 1;
        const f = matrix.get(p.id, scene.victim.id);
        return (0.3 + Math.max(f.liking, f.hatred) / 60) ** 2;
      };
      const speaker = weightedPick(
        this.rng,
        scene.speakers,
        (p) => ((0.25 + p.traits.sociability / 100) * bond(p)) / (1 + (this.spokenBy.get(p.id) ?? 0)),
      );
      if (!speaker) return null;
      const line = this.compose(matrix, scene, speaker);
      if (!line) continue;
      this.spokenBy.set(speaker.id, (this.spokenBy.get(speaker.id) ?? 0) + 1);
      this.usedPhrases.add(line.phrase.id);
      this.events.push(line.event);
      return line;
    }
    return null;
  }

  private compose(matrix: RelationshipMatrix, scene: DialogueScene, speaker: SimPlayer): SpokenLine | null {
    const candidates = this.phrases.filter(
      (p) => p.phase === scene.phase && (scene.tones[p.tone] ?? 0) > 0 && !this.usedPhrases.has(p.id) && (scene.victim || !p.text.includes('{victim}')) && (!scene.aboutVictim || p.text.includes('{victim}')),
    );
    const wild = surprises(this.rng, this.chaos, speaker);
    const mood = situationalTones(matrix, speaker, scene.audience);
    // O peso é do teor, não de cada frase: um teor com mais frases na biblioteca não fala mais por isso.
    const perTone = new Map<PhraseTone, number>();
    for (const p of candidates) perTone.set(p.tone, (perTone.get(p.tone) ?? 0) + 1);
    const phrase = weightedPick(this.rng, candidates, (p) => {
      if (wild) return 1;
      const behavior = behaviorWeight(p.behaviorId, speaker);
      return ((scene.tones[p.tone] ?? 0) / perTone.get(p.tone)!) * toneAffinity(speaker.traits, p.tone) * (mood[p.tone] ?? 1) * behavior;
    });
    if (!phrase) return null;

    const tokens = distinctTokens(phrase.text);
    const userTokens = tokens.filter((t) => t !== '{victim}').sort((a, b) => tokenNumber(a) - tokenNumber(b));
    const cast = new Map<string, SimPlayer>();
    cast.set(userTokens[0], speaker);

    const taken = new Set([speaker.id, scene.victim?.id]);
    const pressure = publicSuspicion(matrix, scene.audience);
    let target: SimPlayer | undefined;
    let second: SimPlayer | undefined;

    for (const [index, token] of userTokens.slice(1).entries()) {
      const pool = scene.audience.filter((p) => !taken.has(p.id) && this.fitsTower(scene, tokenNumber(token), p));
      const chosen =
        index === 0
          ? weightedPick(this.rng, pool, (c) => (wild ? 1 : targetWeight(matrix, speaker, c, phrase.tone, pressure)))
          : weightedPick(this.rng, pool, (c) => (wild ? 1 : secondWeight(matrix, speaker, target!, c, phrase.tone)));
      if (!chosen) return null;
      if (index === 0) target = chosen;
      if (index === 1) second = chosen;
      cast.set(token, chosen);
      taken.add(chosen.id);
    }
    if (tokens.includes('{victim}')) cast.set('{victim}', scene.victim!);

    // {victim} vira o próximo {userN} livre para o texto guardado usar só marcadores de jogador.
    const victimToken = `{user${Math.max(0, ...userTokens.map(tokenNumber)) + 1}}`;
    const text = phrase.text.replaceAll('{victim}', victimToken);
    const playerIds = distinctTokens(text).map((t) => (t === victimToken ? scene.victim!.id : cast.get(t)!.id));
    const event: NarratedEvent = { kind: SimulationEventKind.DIALOGUE, tone: phrase.tone, text, playerIds, ...(scene.private && { isPrivate: true }) };
    return { phrase, speaker, target, second, event };
  }

  /** Na torre, {user1} é o fiel na mira e {user2} em diante são outros traidores. */
  private fitsTower(scene: DialogueScene, token: number, p: SimPlayer): boolean {
    if (!scene.tower) return true;
    return token === 1 ? !isTraitor(p) : isTraitor(p);
  }
}

function distinctTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const match of text.matchAll(TOKEN)) if (!tokens.includes(match[0])) tokens.push(match[0]);
  return tokens;
}

/** {user} = 0, {user1} = 1... */
function tokenNumber(token: string): number {
  const digits = /\d+/.exec(token);
  return digits ? Number(digits[0]) : 0;
}

/** O quanto o jeito do personagem combina com cada teor. */
export function toneAffinity(t: Traits, tone: PhraseTone): number {
  const value = (() => {
    switch (tone) {
      case PhraseTone.FRIENDLY:
        return (t.sociability + 50 + t.likeGiven) / 100;
      case PhraseTone.ALLIANCE:
      case PhraseTone.DEFENSE:
        return t.loyalty / 55;
      case PhraseTone.SUSPICION:
        return t.paranoia / 50;
      case PhraseTone.ACCUSATION:
        return (t.aggression + t.paranoia + t.influence * 0.5) / 110;
      case PhraseTone.CONFLICT:
        return (t.aggression / 45) * (0.5 + t.volatility / 100) + Math.max(0, t.envy) / 40;
      case PhraseTone.STRATEGY:
        return (t.influence + t.deception) / 100;
      case PhraseTone.EMOTION:
        return t.volatility / 50;
      case PhraseTone.HUMOR:
        return t.sociability / 55;
      default:
        return 1;
    }
  })();
  return Math.max(0.1, value);
}

/**
 * O que o falante sente pelos presentes puxa o teor da fala: quem odeia alguém na sala
 * briga mais, quem desconfia acusa mais, quem vê um aliado na mira defende, quem está
 * entre amigos brinca e se aproxima. Traidores acusam por estratégia, não por sentimento.
 */
function situationalTones(matrix: RelationshipMatrix, speaker: SimPlayer, audience: readonly SimPlayer[]): Partial<Record<PhraseTone, number>> {
  const others = audience.filter((p) => p.id !== speaker.id);
  if (!others.length) return {};
  const feelings = others.map((p) => matrix.get(speaker.id, p.id));
  const maxHate = Math.max(...feelings.map((f) => f.hatred));
  const minTrust = Math.min(...feelings.map((f) => f.trust));
  const avgLiking = feelings.reduce((s, f) => s + f.liking, 0) / feelings.length;
  const friends = feelings.filter((f) => f.liking >= 65 || f.allied).length;
  const pressure = publicSuspicion(matrix, audience);
  const allyInDanger = others.some((p) => matrix.isAllied(speaker.id, p.id) && (pressure.get(p.id) ?? 50) >= 55);
  const doubt = isTraitor(speaker) ? 1.2 : 0.6 + (100 - minTrust) / 80;
  return {
    [PhraseTone.CONFLICT]: 0.5 + maxHate / 50,
    [PhraseTone.ACCUSATION]: doubt,
    [PhraseTone.SUSPICION]: doubt,
    [PhraseTone.DEFENSE]: allyInDanger ? 2.2 : 0.7,
    [PhraseTone.ALLIANCE]: Math.min(1.8, 0.7 + friends * 0.2),
    [PhraseTone.FRIENDLY]: 0.6 + avgLiking / 100,
    [PhraseTone.HUMOR]: 0.6 + avgLiking / 100 - maxHate / 250,
  };
}

/** Quem vira o {user1} de cada teor, a partir do que o falante sente. */
function targetWeight(matrix: RelationshipMatrix, speaker: SimPlayer, c: SimPlayer, tone: PhraseTone, pressure: ReadonlyMap<string, number>): number {
  const f = matrix.get(speaker.id, c.id);
  const press = pressure.get(c.id) ?? 50;
  switch (tone) {
    case PhraseTone.ALLIANCE:
      return (f.trust + 5) ** 2 * (f.allied ? 2 : 1);
    case PhraseTone.DEFENSE:
      return (f.trust + 5) ** 2 * (f.allied ? 3 : 1) * (press / 50 + 0.3);
    case PhraseTone.SUSPICION:
    case PhraseTone.ACCUSATION: {
      if (isTraitor(speaker)) {
        if (isTraitor(c)) return 1;
        return (press + matrix.suspicion(c.id, speaker.id)) ** 2;
      }
      return (100 - f.trust + f.hatred * 0.4) ** 2 * (f.allied ? 0.1 : 1);
    }
    case PhraseTone.CONFLICT:
      return (f.hatred + 5) ** 2;
    case PhraseTone.STRATEGY:
      return (matrix.suspicion(c.id, speaker.id) + c.traits.influence * 0.5 + 10) ** 2;
    default:
      return (f.liking + 10) ** 1.5;
  }
}

/** {user2}: na defesa é quem acusa o defendido; no resto, alguém próximo do falante. */
function secondWeight(matrix: RelationshipMatrix, speaker: SimPlayer, target: SimPlayer, c: SimPlayer, tone: PhraseTone): number {
  if (tone === PhraseTone.DEFENSE) return (matrix.suspicion(c.id, target.id) + 5) ** 2;
  if (tone === PhraseTone.ACCUSATION || tone === PhraseTone.SUSPICION) return (matrix.get(c.id, target.id).trust + 5) ** 1.5;
  return (matrix.get(speaker.id, c.id).liking + 10) ** 1.5;
}

/** Frase de um comportamento: quem tem o comportamento fala mais; quem não tem, bem menos. Frase comum: peso 1. */
function behaviorWeight(behaviorId: string | null | undefined, speaker: SimPlayer): number {
  if (!behaviorId) return 1;
  return speaker.behaviorIds.includes(behaviorId) ? BEHAVIOR_MATCH : BEHAVIOR_MISMATCH;
}
