import { clamp, Rng } from './random';
import { SimPlayer } from './traits';

/**
 * Loucura: chance (0 a 1) de uma decisão ignorar o comportamento esperado e sair no acaso.
 * Soma a loucura da temporada com a imprevisibilidade pessoal (tag "Caótico" etc.).
 * Loucura 1 (100%) = tudo aleatório.
 */
export function surpriseChance(chaos: number, player?: SimPlayer): number {
  const personal = player ? (player.traits.unpredictability - 50) / 100 : 0;
  return clamp(chaos + personal, 0, 1);
}

/** Sorteia se esta decisão vai surpreender. */
export function surprises(rng: Rng, chaos: number, player?: SimPlayer): boolean {
  const p = surpriseChance(chaos, player);
  return p > 0 && rng() < p;
}

/** Mistura uma distribuição "esperada" com a uniforme, na proporção da loucura. */
export function blendWithUniform(probabilities: readonly number[], surprise: number): number[] {
  const uniform = probabilities.length ? 1 / probabilities.length : 0;
  return probabilities.map((p) => (1 - surprise) * p + surprise * uniform);
}
