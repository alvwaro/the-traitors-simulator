import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { requireSeason } from '../../services/gameGuards';

/** Apaga a temporada e todo o histórico dela (personagens/casts da biblioteca ficam). */
export class DeleteSeasonUseCase implements IUseCase<SeasonIdInput, void> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: SeasonIdInput): Promise<void> {
    return this.uow.run(async (repos) => {
      await requireSeason(repos, input.seasonId, true);
      await repos.seasons.delete(input.seasonId);
    });
  }
}
