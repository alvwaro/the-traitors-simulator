/** Fonte de aleatoriedade da simulação (0 <= n < 1). Injetável para testes. */
export type Rng = () => number;

/**
 * Gerador padrão dos sorteios do jogo (votos, missões, falas, desempates). Não protege nenhum segredo nem
 * credencial: é só a sorte do reality, então o gerador comum do JavaScript é suficiente (não é uso criptográfico).
 */
export const gameRng: Rng = Math.random; // NOSONAR: sorteio de jogo, sem finalidade de segurança


export const clamp = (n: number, min = 0, max = 100): number => Math.min(max, Math.max(min, n));

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}

export function between(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pickOne<T>(rng: Rng, items: readonly T[]): T | undefined {
  return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
  return items[items.length - 1];
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

/** Gerador com semente: o mesmo texto gera sempre a mesma sequência. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
