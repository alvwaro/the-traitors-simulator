/** O mínimo de um voto da mesa redonda para apurar (rodada 1 = votação; 2+ = revotação dos empatados). */
export interface VoteLike {
  voterId: string;
  targetId: string;
  round: number;
}

export interface Tally {
  round: number;
  /** [alvo, votos], do mais votado para o menos votado. */
  counts: [string, number][];
  /** Os mais votados (mais de um = empate). */
  leaders: string[];
}

/** Os mais votados: quem tem a maior contagem positiva (vazio quando ninguém recebeu voto). */
export function leadersOf(counts: ReadonlyMap<string, number>): string[] {
  const max = Math.max(0, ...counts.values());
  return max > 0 ? [...counts].filter(([, count]) => count === max).map(([id]) => id) : [];
}

/** Soma os votos de cada alvo. */
export function countVotes(targetIds: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of targetIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** A última rodada registrada (revotação, se houve empate). */
export function lastRound(votes: readonly VoteLike[]): number {
  return Math.max(1, ...votes.map((v) => v.round));
}

/** Apura uma rodada (por padrão, a última): o banido precisa estar entre os mais votados. */
export function tally(votes: readonly VoteLike[], round = lastRound(votes)): Tally {
  const counts = countVotes(votes.filter((v) => v.round === round).map((v) => v.targetId));
  return { round, counts: [...counts].sort((a, b) => b[1] - a[1]), leaders: leadersOf(counts) };
}
