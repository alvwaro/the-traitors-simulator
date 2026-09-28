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
