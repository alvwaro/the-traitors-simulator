import { Player, RoundTable } from '../../domain/entities';
import { DomainError } from '../../domain/errors/DomainError';
import { VoteTallyService } from '../../domain/services';
import { VoteInput } from '../dtos/GameDTOs';
import { PlayerRoster } from './PlayerRoster';

/** Registra os votos validando que votantes e alvos estão ativos. */
export function recordVotes(roundTable: RoundTable, roster: PlayerRoster, votes: VoteInput[] = []): void {
  for (const vote of votes) {
    roster.requireActive(vote.voterId);
    roster.requireActive(vote.targetId);
    roundTable.castVote(vote.voterId, vote.targetId, vote.round ?? 1);
  }
}

/** Se houve votos, o banido precisa estar entre os mais votados da última rodada. */
export function ensureBanishedMatchesVotes(roundTable: RoundTable, banished: Player, voteTally: VoteTallyService): void {
  if (roundTable.votes.length === 0) return;
  const { leaders, round } = voteTally.tallyFinalRound(roundTable.votes);
  if (!leaders.includes(banished.id)) {
    throw new DomainError(`${banished.name} não foi o(a) mais votado(a) na rodada ${round}`);
  }
}
