import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors/DomainError';

/**
 * Chaves dos efeitos de um comportamento. Todo efeito é um modificador de -50 a +50.
 *
 * Relacionamentos iniciais (somados à base de cada par):
 *   trustGiven / likeGiven / hateGiven          o que o personagem sente pelos outros
 *   trustReceived / likeReceived / hateReceived o que os outros sentem por ele
 *   envy                                         ódio extra pelos personagens mais queridos
 *
 * Atributos de jogo (base 50, de 0 a 100 depois de somar as tags):
 *   loyalty      lealdade: chance de transformar confiança em aliança e de não trair aliados
 *   paranoia     desconfiança: a confiança cai com o tempo e o voto segue a suspeita
 *   aggression   agressividade: vota por ódio, acusa e briga mais
 *   influence    influência: o quanto acusações e defesas mudam a opinião dos outros
 *   deception    dissimulação: como traidor(a), levanta menos suspeita
 *   skill        habilidade nas missões
 *   volatility   intensidade: o quanto os relacionamentos mudam depois de cada acontecimento
 *   sociability  sociabilidade: o quanto fala nas conversas
 *   grudge       rancor: o ódio demora a passar e pesa mais no voto
 *   insight      intuição: percebe os traidores mais rápido
 *   unpredictability  imprevisibilidade: soma-se à loucura da temporada nas decisões dele(a)
 *   conformity   conformismo: vota com a maioria (negativo = do contra)
 */
export const BEHAVIOR_EFFECT_KEYS = [
  'trustGiven',
  'likeGiven',
  'hateGiven',
  'trustReceived',
  'likeReceived',
  'hateReceived',
  'envy',
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
] as const;

export type BehaviorEffectKey = (typeof BEHAVIOR_EFFECT_KEYS)[number];
export type BehaviorEffects = Partial<Record<BehaviorEffectKey, number>>;

export const BEHAVIOR_EFFECT_LIMIT = 50;

export interface BehaviorProps {
  id: string;
  name: string;
  description: string | null;
  effects: BehaviorEffects;
  createdAt: Date;
}

/** Tag de personalidade ("Fiel", "Invejoso"...) que muda relacionamentos e decisões na simulação. */
export class Behavior {
  constructor(private readonly props: BehaviorProps) {}

  static create(input: { name: string; description?: string | null; effects?: BehaviorEffects }): Behavior {
    const behavior = new Behavior({ id: randomUUID(), name: '', description: null, effects: {}, createdAt: new Date() });
    behavior.rename(input.name);
    behavior.describe(input.description ?? null);
    behavior.setEffects(input.effects ?? {});
    return behavior;
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get effects(): BehaviorEffects { return this.props.effects; }

  rename(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new DomainError('O nome do comportamento é obrigatório');
    if (trimmed.length > 40) throw new DomainError('O nome do comportamento pode ter no máximo 40 caracteres');
    this.props.name = trimmed;
  }

  describe(description: string | null): void {
    this.props.description = description?.trim() || null;
  }

  /** Guarda só as chaves conhecidas e diferentes de zero. */
  setEffects(effects: BehaviorEffects): void {
    const clean: BehaviorEffects = {};
    for (const [key, raw] of Object.entries(effects)) {
      if (!(BEHAVIOR_EFFECT_KEYS as readonly string[]).includes(key)) throw new DomainError(`Efeito desconhecido: ${key}`);
      const value = Math.round(Number(raw));
      if (!Number.isFinite(value) || Math.abs(value) > BEHAVIOR_EFFECT_LIMIT) {
        throw new DomainError(`O efeito ${key} precisa estar entre -${BEHAVIOR_EFFECT_LIMIT} e ${BEHAVIOR_EFFECT_LIMIT}`);
      }
      if (value !== 0) clean[key as BehaviorEffectKey] = value;
    }
    this.props.effects = clean;
  }

  toJSON(): BehaviorProps { return { ...this.props, effects: { ...this.props.effects } }; }
}
