import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { UpdateSeasonInput } from '../../dtos/SeasonDTOs';
import { SeasonProps } from '../../../domain/entities';
import { requireSeason } from '../../services/gameGuards';
import { SeasonMode } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { ensureRelationships } from '../../services/simulation';

/** Nome, drama e falas podem mudar sempre; prêmio e simulação só antes do início. */
export class UpdateSeasonUseCase implements IUseCase<UpdateSeasonInput, SeasonProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UpdateSeasonInput): Promise<SeasonProps> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      if (input.name !== undefined) season.rename(input.name);

      const { currency, initialPrizePot, maxPrizePot } = input;
      if (currency !== undefined || initialPrizePot !== undefined || maxPrizePot !== undefined) {
        season.configurePrize({ currency, initialPrizePot, maxPrizePot });
      }

      if (input.mode !== undefined && input.mode !== season.mode && (input.mode === SeasonMode.PLAYER || season.isPlayerMode())) {
        throw new DomainError('O modo Jogador só pode ser escolhido ao criar a temporada');
      }
      if (input.mode !== undefined) season.changeMode(input.mode);
      season.configureSimulation({ chaos: input.chaos, missionPool: input.missionPool, interactionLimit: input.interactionLimit, withdrawals: input.withdrawals, hiddenShieldChance: input.hiddenShieldChance });
      season.configureDisplay({ drama: input.drama, showPhrases: input.showPhrases });

      await repos.seasons.update(season);
      if (season.isAutomatic()) await ensureRelationships(repos, season.id);
      return season.toJSON();
    });
  }
}
