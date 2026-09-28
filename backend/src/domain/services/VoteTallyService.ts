import { RoundTableVoteProps } from '../entities';

export interface VoteTally {
  round: number;
  counts: Map<string, number>; // targetId → votos
  leaders: string[];           // mais votados (>1 = empate)
}

/** Apuração de votos da mesa redonda, usada para validar o banido informado. */
export class VoteTallyService {
  tally(votes: readonly RoundTableVoteProps[], round: number): VoteTally {
    const counts = new Map<string, number>();
    for (const vote of votes) {
      if (vote.round === round) counts.set(vote.targetId, (counts.get(vote.targetId) ?? 0) + 1);
    }
    const max = Math.max(0, ...counts.values());
    const leaders = [...counts].filter(([, count]) => count === max && max > 0).map(([id]) => id);
    return { round, counts, leaders };
  }

  /** Apura a última rodada (revotação, se houve empate). */
  tallyFinalRound(votes: readonly RoundTableVoteProps[]): VoteTally {
    const lastRound = Math.max(1, ...votes.map((v) => v.round));
    return this.tally(votes, lastRound);
  }
}
