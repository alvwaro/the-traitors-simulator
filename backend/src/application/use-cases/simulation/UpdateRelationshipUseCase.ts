import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { RelationshipsOutput, UpdateRelationshipInput } from '../../dtos/GameDTOs';
import { DomainError } from '../../../domain/errors/DomainError';
import { requireSeason } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { buildRelationshipsOutput, loadSimulationState } from '../../services/simulation';

/** Ajuste manual do que um jogador sente por outro (vale a qualquer momento). */
export class UpdateRelationshipUseCase implements IUseCase<UpdateRelationshipInput, RelationshipsOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UpdateRelationshipInput): Promise<RelationshipsOutput> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      const roster = await PlayerRoster.load(repos, season.id);
      roster.require(input.fromId);
      roster.require(input.toId);
      if (input.fromId === input.toId) throw new DomainError('Escolha dois jogadores diferentes');

      const { matrix } = await loadSimulationState(repos, season.id);
      matrix.set(input.fromId, input.toId, { trust: input.trust, liking: input.liking, hatred: input.hatred });
      if (input.allied !== undefined) matrix.setAllied(input.fromId, input.toId, input.allied);
      await repos.relationships.saveMany(season.id, matrix.changed());
      return buildRelationshipsOutput(repos, season);
    });
  }
}
