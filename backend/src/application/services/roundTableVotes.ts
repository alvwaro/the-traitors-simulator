import { tally } from '@traitors/shared';
import { Player, RoundTable } from '../../domain/entities';
import { PlayerStatus } from '../../domain/enums';
import { DomainError } from '../../domain/errors/DomainError';
import { RoundTableOutput, VoteInput } from '../dtos/GameDTOs';
import { Repositories } from '../ports/IUnitOfWork';
import { PlayerRoster } from './PlayerRoster';

/** Registra os votos validando que votantes e alvos estão ativos. */
export function recordVotes(roundTable: RoundTable, roster: PlayerRoster, votes: VoteInput[] = []): void {
  for (const vote of votes) {
    roster.requireActive(vote.voterId);
    roster.requireActive(vote.targetId);
    roundTable.castVote(vote.voterId, vote.targetId, vote.round ?? 1);
  }
}

/** Se houve votos, o banido precisa estar entre os mais votados da última rodada (a mesma apuração do site). */
export function ensureBanishedMatchesVotes(roundTable: RoundTable, banished: Player): void {
  if (roundTable.votes.length === 0) return;
  const { leaders, round } = tally(roundTable.votes);
  if (!leaders.includes(banished.id)) {
    throw new DomainError(`${banished.name} não foi o(a) mais votado(a) na rodada ${round}`);
  }
}

export interface Banishment {
  roundTable: RoundTable;
  roster: PlayerRoster;
  banished: Player;
  votes?: VoteInput[];
  dayId: string;
}

/** Fecha a mesa com um banimento: confere os votos, elimina o banido e revela o papel dele. */
export async function banish(repos: Repositories, { roundTable, roster, banished, votes, dayId }: Banishment): Promise<RoundTableOutput> {
  recordVotes(roundTable, roster, votes);
  ensureBanishedMatchesVotes(roundTable, banished);
  roundTable.banish(banished.id);
  banished.eliminate(PlayerStatus.BANISHED, dayId);
  await repos.players.update(banished);
  await repos.roundTables.create(roundTable);
  return { ...roundTable.toJSON(), revealedRole: banished.role };
}
