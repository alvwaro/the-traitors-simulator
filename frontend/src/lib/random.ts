export type Rng = () => number;

/**
 * Gerador padrão dos sorteios do jogo (votos, missões, falas, desempates). Não protege nenhum segredo nem
 * credencial: é só a sorte do reality, então o gerador comum do JavaScript é suficiente (não é uso criptográfico).
 */
export const gameRng: Rng = Math.random; // NOSONAR: sorteio de jogo, sem finalidade de segurança


/** Gerador pseudoaleatório com semente: o mesmo texto de semente gera sempre a mesma sequência. */
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

export function shuffle<T>(items: readonly T[], rng: Rng = gameRng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sample<T>(items: readonly T[], count: number, rng: Rng = gameRng): T[] {
  return shuffle(items, rng).slice(0, count);
}

export function pickOne<T>(items: readonly T[], rng: Rng = gameRng): T | undefined {
  return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}
