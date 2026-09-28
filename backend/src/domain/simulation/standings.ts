import { banishChances, murderChances } from './decisions';
import { RelationshipMatrix } from './RelationshipMatrix';
import { Rng } from './random';
import { isTraitor, SimPlayer } from './traits';

/** Como o castelo enxerga um jogador (médias do que todos os outros sentem por ele). */
export interface Standing {
  playerId: string;
  trust: number;
  suspicion: number;
  liking: number;
  hatred: number;
  /** Chance (0 a 1) de sair na próxima mesa redonda. */
  banishChance: number;
  /** Chance (0 a 1) de ser o alvo dos traidores; null para traidores ou sem traidores. */
  murderChance: number | null;
  allies: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeStandings(rng: Rng, matrix: RelationshipMatrix, players: readonly SimPlayer[], chaos = 0): Standing[] {
  const ids = players.map((p) => p.id);
  const traitors = players.filter(isTraitor);
  const banish = banishChances(rng, matrix, players, chaos);
  const murder = traitors.length ? murderChances(matrix, traitors, players, chaos) : new Map<string, number>();

  return players.map((p) => {
    const avg = matrix.toward(p.id, ids);
    return {
      playerId: p.id,
      trust: round1(avg.trust),
      suspicion: round1(100 - avg.trust),
      liking: round1(avg.liking),
      hatred: round1(avg.hatred),
      banishChance: banish.get(p.id) ?? 0,
      murderChance: isTraitor(p) || !traitors.length ? null : murder.get(p.id) ?? 0,
      allies: matrix.alliesOf(p.id, ids),
    };
  });
}
