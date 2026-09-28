import { SimPlayer } from '../traits';

/** Os `n` melhores pela pontuação (calculada uma vez por item, mesmo que use sorteio). */
export function top<T>(items: readonly T[], score: (item: T) => number, n: number): T[] {
  const scored = items.map((item) => ({ item, score: score(item) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.item);
}

export const byInfluence = (players: readonly SimPlayer[]): SimPlayer => top(players, (p) => p.traits.influence, 1)[0];


/** Mesma pessoa em dois marcadores ({user} e {user1}) quando o roteiro cita alguém duas vezes. */
export const pair = (a: SimPlayer, b: SimPlayer): SimPlayer[] => [a, b];
