import { randomUUID } from 'node:crypto';
import { BEHAVIOR_EFFECT_LIMIT, BEHAVIOR_NAME_MAX_LENGTH, BehaviorEffects, isBehaviorEffectKey } from '@traitors/shared';
import { DomainError } from '../errors/DomainError';
import { optionalText, requiredText } from './values';

// As chaves e os limites dos efeitos são os mesmos no formulário do site: vêm do kernel compartilhado.
export { BEHAVIOR_EFFECT_KEYS, BEHAVIOR_EFFECT_LIMIT } from '@traitors/shared';
export type { BehaviorEffectKey, BehaviorEffects } from '@traitors/shared';

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
    const trimmed = requiredText(name, 'O nome do comportamento é obrigatório');
    if (trimmed.length > BEHAVIOR_NAME_MAX_LENGTH) {
      throw new DomainError(`O nome do comportamento pode ter no máximo ${BEHAVIOR_NAME_MAX_LENGTH} caracteres`);
    }
    this.props.name = trimmed;
  }

  describe(description: string | null): void {
    this.props.description = optionalText(description);
  }

  /** Guarda só as chaves conhecidas e diferentes de zero. */
  setEffects(effects: BehaviorEffects): void {
    const clean: BehaviorEffects = {};
    for (const [key, raw] of Object.entries(effects)) {
      if (!isBehaviorEffectKey(key)) throw new DomainError(`Efeito desconhecido: ${key}`);
      const value = Math.round(Number(raw));
      if (!Number.isFinite(value) || Math.abs(value) > BEHAVIOR_EFFECT_LIMIT) {
        throw new DomainError(`O efeito ${key} precisa estar entre -${BEHAVIOR_EFFECT_LIMIT} e ${BEHAVIOR_EFFECT_LIMIT}`);
      }
      if (value !== 0) clean[key] = value;
    }
    this.props.effects = clean;
  }

  toJSON(): BehaviorProps { return { ...this.props, effects: { ...this.props.effects } }; }
}
