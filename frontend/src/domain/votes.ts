import { gameRng } from '../lib/random';
export interface VoteLike {
  voterId: string;
  targetId: string;
  round: number;
}

export interface Tally {
  round: number;
  /** [targetId, votos] do mais votado para o menos votado. */
  counts: [string, number][];
  leaders: string[];
}

export function lastRound(votes: readonly VoteLike[]): number {
  return Math.max(1, ...votes.map((v) => v.round));
}

/**
 * Sorteia um voto para cada votante. Numa revotação (round > 1) só os empatados
 * da rodada anterior podem receber votos, como no programa.
 */
export function drawVotes(
  voterIds: readonly string[],
  votes: readonly VoteLike[],
  round: number,
  random: () => number = gameRng,
): VoteLike[] {
  const tied = round > 1 ? tally(votes, round - 1).leaders : [];
  const candidates = tied.length > 1 ? tied : voterIds;
  return voterIds.flatMap((voterId) => {
    const options = candidates.filter((id) => id !== voterId);
    const pool = options.length ? options : voterIds.filter((id) => id !== voterId);
    if (!pool.length) return [];
    return [{ voterId, targetId: pool[Math.floor(random() * pool.length)], round }];
  });
}

/** Mesma regra do backend: o banido precisa estar entre os mais votados da última rodada. */
export function tally(votes: readonly VoteLike[], round = lastRound(votes)): Tally {
  const map = new Map<string, number>();
  votes.filter((v) => v.round === round).forEach((v) => map.set(v.targetId, (map.get(v.targetId) ?? 0) + 1));
  const counts = [...map].sort((a, b) => b[1] - a[1]);
  const max = counts[0]?.[1] ?? 0;
  return { round, counts, leaders: counts.filter(([, n]) => n === max && max > 0).map(([id]) => id) };
}
