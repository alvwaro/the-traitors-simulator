import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { GameStateOutput } from '../../dtos/GameDTOs';
import { Day, DayPhase } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { MIN_PLAYERS_TO_START } from '../../../domain/rules';
import { PhaseFlowPolicy } from '../../../domain/services';
import { requireSeason } from '../../services/gameGuards';
import { readGameState } from '../../services/gameState';
import { ensureRelationships } from '../../services/simulation';

export class StartSeasonUseCase implements IUseCase<SeasonIdInput, GameStateOutput> {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly phaseFlow: PhaseFlowPolicy,
  ) {}

  execute(input: SeasonIdInput): Promise<GameStateOutput> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      if (!season.isInSetup()) throw new DomainError('A temporada já foi iniciada');

      const players = await repos.players.findBySeason(season.id);
      if (players.length < MIN_PLAYERS_TO_START) {
        throw new DomainError(`São necessários ao menos ${MIN_PLAYERS_TO_START} jogadores`);
      }

      const start = this.phaseFlow.initial();
      const day = Day.create({ seasonId: season.id, number: start.day });
      await repos.days.create(day);
      await repos.days.savePhase(DayPhase.start(day.id, start.phase));

      if (season.isAutomatic()) await ensureRelationships(repos, season.id);
      season.start(start.day, start.phase);
      await repos.seasons.update(season);
      return readGameState(repos, season.id);
    });
  }
}
