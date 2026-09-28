import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { UpdatePlayerInput } from '../../dtos/PlayerDTOs';
import { PlayerProps } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { requireSeason } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { ensureBehaviorsExist } from '../../services/libraryGuards';

export class UpdatePlayerUseCase implements IUseCase<UpdatePlayerInput, PlayerProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UpdatePlayerInput): Promise<PlayerProps> {
    return this.uow.run(async (repos) => {
      const season = await requireSeason(repos, input.seasonId, true);
      const player = (await PlayerRoster.load(repos, season.id)).require(input.playerId);

      if (input.name !== undefined) player.rename(input.name);
      if (input.imageUrl !== undefined) player.changeImage(input.imageUrl);
      if (input.behaviorIds !== undefined) {
        player.setBehaviors(input.behaviorIds);
        await ensureBehaviorsExist(repos, player.behaviorIds);
      }
      if (input.role !== undefined) {
        if (!season.isInSetup()) throw new DomainError('A função só pode ser alterada antes do início (use a seleção de traidores)');
        player.assignRole(input.role);
      }

      await repos.players.update(player);
      return player.toJSON();
    });
  }
}
