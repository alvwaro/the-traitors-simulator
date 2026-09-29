import { Repositories } from '../../ports/IUnitOfWork';
import { RegisterEndgameRoundTableInput, RoundTableOutput } from '../../dtos/GameDTOs';
import { isEndgameDecided, RoundTable } from '../../../domain/entities';
import { GamePhase, RoundTableKind } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { loadActiveGame } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { banish } from '../../services/roundTableVotes';
import { UndoableRecord } from '../../services/undo';

/**
 * Uma rodada da mesa final. Pode ser chamado várias vezes na mesma fase
 * (sequence 1, 2, 3...) até todos votarem END_GAME.
 */
export class RegisterEndgameRoundTableUseCase extends UndoableRecord<RegisterEndgameRoundTableInput, RoundTableOutput> {
  protected readonly undoLabel = 'Registro da mesa final';

  async record(repos: Repositories, input: RegisterEndgameRoundTableInput): Promise<RoundTableOutput> {
    const { season, day } = await loadActiveGame(repos, input.seasonId, GamePhase.ENDGAME_ROUND_TABLE);
    const existing = await repos.roundTables.findByDay(day.id);
    if (isEndgameDecided(existing)) {
      throw new DomainError('O jogo já foi encerrado por unanimidade; avance para a revelação final');
    }

    const roster = await PlayerRoster.load(repos, season.id);
    const active = roster.active();
    const roundTable = RoundTable.create({ dayId: day.id, kind: RoundTableKind.ENDGAME, sequence: existing.length + 1, notes: input.notes });

    for (const vote of input.endgameVotes) {
      roster.requireActive(vote.voterId);
      roundTable.castEndgameVote(vote.voterId, vote.choice);
    }
    if (roundTable.endgameVotes.length !== active.length) {
      throw new DomainError(`Todos os jogadores ativos precisam votar (${roundTable.endgameVotes.length} de ${active.length})`);
    }

    if (roundTable.isEndgameUnanimous()) {
      if (input.banishedPlayerId) throw new DomainError('Votação unânime por encerrar: ninguém é banido');
      await repos.roundTables.create(roundTable);
      return { ...roundTable.toJSON(), revealedRole: null };
    }

    if (!input.banishedPlayerId) throw new DomainError('Sem unanimidade: informe quem foi banido(a)');
    const banished = roster.requireActive(input.banishedPlayerId);
    return banish(repos, { roundTable, roster, banished, votes: input.votes, dayId: day.id });
  }
}
