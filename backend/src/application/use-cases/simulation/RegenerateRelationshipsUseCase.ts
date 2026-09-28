import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { RelationshipsOutput } from '../../dtos/GameDTOs';
import { DomainError } from '../../../domain/errors/DomainError';
import { requireSeason } from '../../services/gameGuards';
import { buildRelationshipsOutput, ensureRelationships } from '../../services/simulation';

/** Sorteia de novo as primeiras impressões de todo o elenco (só antes do início). */
export class RegenerateRelationshipsUseCase implements IUseCase<SeasonIdInput, RelationshipsOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: SeasonIdInput): Promise<RelationshipsOutput> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      if (!season.isInSetup()) throw new DomainError('Os relacionamentos só podem ser sorteados de novo antes do início');
      await repos.relationships.deleteBySeason(season.id);
      await ensureRelationships(repos, season.id);
      return buildRelationshipsOutput(repos, season);
    });
  }
}
