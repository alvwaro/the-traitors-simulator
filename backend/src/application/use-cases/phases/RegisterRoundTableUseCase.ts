import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { RegisterRoundTableInput, RoundTableOutput } from '../../dtos/GameDTOs';
import { RoundTable } from '../../../domain/entities';
import { GamePhase, PlayerStatus, RoundTableKind } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { VoteTallyService } from '../../../domain/services';
import { loadActiveGame } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { ensureBanishedMatchesVotes, recordVotes } from '../../services/roundTableVotes';
import { rememberForUndo } from '../../services/undo';

/** Mesa redonda do dia (2+): votos opcionais e o banido, que tem o papel revelado. */
export class RegisterRoundTableUseCase implements IUseCase<RegisterRoundTableInput, RoundTableOutput> {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly voteTally: VoteTallyService,
  ) {}

  execute(input: RegisterRoundTableInput): Promise<RoundTableOutput> {
    return this.uow.run(async (repos) => {
      await rememberForUndo(repos, input.seasonId, 'Registro da mesa redonda');
      return this.record(repos, input);
    });
  }

  /** A mesma regra dentro de uma transação já aberta (usada também pela simulação automática). */
  async record(repos: Repositories, input: RegisterRoundTableInput): Promise<RoundTableOutput> {
    const { season, day } = await loadActiveGame(repos, input.seasonId, GamePhase.ROUND_TABLE);
    const existing = await repos.roundTables.findByDay(day.id);
    if (existing.some((t) => t.kind === RoundTableKind.REGULAR)) {
      throw new DomainError('A mesa redonda de hoje já foi registrada');
    }

    const roster = await PlayerRoster.load(repos, season.id);
    const banished = roster.requireActive(input.banishedPlayerId);

    const roundTable = RoundTable.create({
      dayId: day.id,
      kind: RoundTableKind.REGULAR,
      sequence: existing.length + 1,
      notes: input.notes,
    });
    recordVotes(roundTable, roster, input.votes);
    ensureBanishedMatchesVotes(roundTable, banished, this.voteTally);
    roundTable.banish(banished.id);
    banished.eliminate(PlayerStatus.BANISHED, day.id);

    await repos.players.update(banished);
    await repos.roundTables.create(roundTable);
    return { ...roundTable.toJSON(), revealedRole: banished.role };
  }
}
