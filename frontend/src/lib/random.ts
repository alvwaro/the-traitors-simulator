import { gameRng, pickOne as pickFrom, shuffle as shuffleWith, type Rng } from '@traitors/shared';

// O gerador (e o gerador com semente) é o mesmo do backend: vem do kernel compartilhado.
export { gameRng, seededRng, type Rng } from '@traitors/shared';

export function shuffle<T>(items: readonly T[], rng: Rng = gameRng): T[] {
  return shuffleWith(rng, items);
}

export function sample<T>(items: readonly T[], count: number, rng: Rng = gameRng): T[] {
  return shuffle(items, rng).slice(0, count);
}

export function pickOne<T>(items: readonly T[], rng: Rng = gameRng): T | undefined {
  return pickFrom(rng, items);
}
