import { pickOne, Rng } from '@traitors/shared';

// Primitivas de sorteio (gerador com semente, embaralhar, escolher um) vêm do kernel compartilhado:
// o navegador sorteia com o mesmo algoritmo.
export { gameRng, pickOne, seededRng, shuffle } from '@traitors/shared';
export type { Rng } from '@traitors/shared';

export const clamp = (n: number, min = 0, max = 100): number => Math.min(max, Math.max(min, n));

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function between(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Sorteio proporcional ao peso; pesos <= 0 não concorrem (se todos forem 0, sorteio uniforme). */
export function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T | undefined {
  const weights = items.map((item) => Math.max(0, weight(item)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return pickOne(rng, items);
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items.at(-1);
}

/** Probabilidades proporcionais a exp(score / temperatura): quanto menor a temperatura, mais previsível. */
export function softmax(scores: readonly number[], temperature: number): number[] {
  if (scores.length === 0) return [];
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp((s - max) / temperature));
  const total = exps.reduce((sum, e) => sum + e, 0);
  return exps.map((e) => e / total);
}

export function softmaxPick<T>(rng: Rng, items: readonly T[], score: (item: T) => number, temperature: number): T | undefined {
  const probabilities = softmax(items.map(score), temperature);
  return weightedPick(rng, items.map((item, i) => ({ item, p: probabilities[i] })), (x) => x.p)?.item;
}
