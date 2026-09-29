/** Fonte de aleatoriedade (0 <= n < 1). Injetável para testes. */
export type Rng = () => number;

/**
 * Gerador padrão dos sorteios do jogo (votos, missões, falas, desempates). Não protege nenhum segredo nem
 * credencial: é só a sorte do reality, então o gerador comum do JavaScript é suficiente (não é uso criptográfico).
 */
export const gameRng: Rng = Math.random; // NOSONAR: sorteio de jogo, sem finalidade de segurança

/** 2^32: normaliza o inteiro de 32 bits do gerador para o intervalo [0, 1). */
const UINT32_RANGE = 4294967296;

/**
 * Gerador com semente (mulberry32 com a semente espalhada por um hash do texto):
 * o mesmo texto gera sempre a mesma sequência, no navegador e no servidor.
 */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    // Unidade UTF-16 (não o code point): mantém as sequências já sorteadas com as mesmas sementes.
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    // Soma em 32 bits sem sinal: o estado dá a volta como um inteiro de máquina.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/** Um item qualquer da lista (undefined se estiver vazia). */
export function pickOne<T>(rng: Rng, items: readonly T[]): T | undefined {
  return items.length ? items[Math.floor(rng() * items.length)] : undefined;
}

/** Cópia embaralhada (Fisher-Yates). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
