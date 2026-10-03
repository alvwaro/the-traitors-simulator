import { BehaviorEffects } from '../entities/Behavior';
import { PlayerRole } from '../enums';
import { clamp } from './random';

/** Atributos de jogo: base 50 + soma das tags, de 0 a 100. */
export interface Attributes {
  loyalty: number;
  paranoia: number;
  aggression: number;
  influence: number;
  deception: number;
  skill: number;
  volatility: number;
  sociability: number;
  grudge: number;
  insight: number;
  unpredictability: number;
  conformity: number;
}

/** Modificadores de relacionamento: soma das tags (0 = neutro). */
export interface RelationshipBias {
  trustGiven: number;
  likeGiven: number;
  hateGiven: number;
  trustReceived: number;
  likeReceived: number;
  hateReceived: number;
  envy: number;
}

export type Traits = Attributes & RelationshipBias;

const ATTRIBUTES: (keyof Attributes)[] = [
  'loyalty',
  'paranoia',
  'aggression',
  'influence',
  'deception',
  'skill',
  'volatility',
  'sociability',
  'grudge',
  'insight',
  'unpredictability',
  'conformity',
];
const BIASES: (keyof RelationshipBias)[] = ['trustGiven', 'likeGiven', 'hateGiven', 'trustReceived', 'likeReceived', 'hateReceived', 'envy'];

/** Combina as tags de um personagem num único perfil. */
export function traitsOf(effects: readonly BehaviorEffects[]): Traits {
  const sum = (key: keyof BehaviorEffects) => effects.reduce((total, e) => total + (e[key] ?? 0), 0);
  const traits = {} as Traits;
  for (const key of ATTRIBUTES) traits[key] = clamp(50 + sum(key));
  for (const key of BIASES) traits[key] = clamp(sum(key), -60, 60);
  return traits;
}

/** Jogador como a simulação o enxerga. */
export interface SimPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  traits: Traits;
  behaviorIds: readonly string[];
}

export const isTraitor = (p: SimPlayer): boolean => p.role === PlayerRole.TRAITOR;

/**
 * Gosto por gente brava (de -1 a 1,5): quem é agressivo(a) ou do contra admira quem fala o que pensa,
 * acusa e provoca (até com maldade); os calmos e conformistas torcem o nariz para quem compra briga.
 * Perto de zero, tanto faz.
 */
export function boldTaste(p: SimPlayer): number {
  return clamp((p.traits.aggression - 50) / 50 + (50 - p.traits.conformity) / 100, -1, 1.5);
}

/** Desconfiança natural (0,4 a 1,4): intuitivos e paranoicos estranham quem é bonzinho(a) demais. */
export function wariness(p: SimPlayer): number {
  return 0.4 + (p.traits.insight + p.traits.paranoia) / 200;
}
