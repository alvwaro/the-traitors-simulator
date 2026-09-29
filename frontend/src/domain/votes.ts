import { tally, type VoteLike } from '@traitors/shared';
import { gameRng } from '../lib/random';

// A apuração é a mesma do backend: o banido precisa estar entre os mais votados da última rodada.
export { lastRound, tally, type Tally, type VoteLike } from '@traitors/shared';

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
