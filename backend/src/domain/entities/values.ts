import { DomainError } from '../errors/DomainError';

/** Regras de valor comuns às entidades (nomes, textos livres e listas de ids). */

/** Texto aparado e obrigatório; `missing` é a mensagem quando vem vazio. */
export function requiredText(value: string, missing: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new DomainError(missing);
  return trimmed;
}

/** Texto opcional aparado (vazio vira null). */
export function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/** Ids sem repetição, na ordem em que vieram. */
export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}
