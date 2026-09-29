import { Repositories } from '../../ports/IUnitOfWork';
import { RegisterRoundTableInput, RoundTableOutput } from '../../dtos/GameDTOs';
import { RoundTable } from '../../../domain/entities';
import { GamePhase, RoundTableKind } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { loadActiveGame } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { banish } from '../../services/roundTableVotes';
import { UndoableRecord } from '../../services/undo';

/** Mesa redonda do dia (2+): votos opcionais e o banido, que tem o papel revelado. */
export class RegisterRoundTableUseCase extends UndoableRecord<RegisterRoundTableInput, RoundTableOutput> {
  protected readonly undoLabel = 'Registro da mesa redonda';

  async record(repos: Repositories, input: RegisterRoundTableInput): Promise<RoundTableOutput> {
    const { season, day } = await loadActiveGame(repos, input.seasonId, GamePhase.ROUND_TABLE);
    const existing = await repos.roundTables.findByDay(day.id);
    if (existing.some((t) => t.kind === RoundTableKind.REGULAR)) {
      throw new DomainError('A mesa redonda de hoje já foi registrada');
    }

    const roster = await PlayerRoster.load(repos, season.id);
    const banished = roster.requireActive(input.banishedPlayerId);
    const roundTable = RoundTable.create({ dayId: day.id, kind: RoundTableKind.REGULAR, sequence: existing.length + 1, notes: input.notes });
    return banish(repos, { roundTable, roster, banished, votes: input.votes, dayId: day.id });
  }
}
