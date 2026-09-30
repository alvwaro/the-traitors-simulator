import type { Cast, Character } from '../../../domain/models';

/** Nome do grupo dos personagens que não estão em nenhum cast. */
export const NO_CAST_NAME = 'Personagens sem cast';

/** Id de rota do grupo "Personagens sem cast". */
export const NO_CAST_ID = 'sem-cast';

/** Página de um cast na biblioteca (`null` = personagens sem cast). */
export function castPath(castId: string | null): string {
  return `/biblioteca/casts/${castId ?? NO_CAST_ID}`;
}

/** Personagens que não estão em nenhum cast. */
export function uncast(characters: readonly Character[], casts: readonly Cast[]): Character[] {
  const inCast = new Set(casts.flatMap((c) => c.characterIds));
  return characters.filter((c) => !inCast.has(c.id));
}
