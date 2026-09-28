import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { UpdateBehaviorInput } from '../../dtos/LibraryDTOs';
import { BehaviorProps } from '../../../domain/entities';
import { requireBehavior } from '../../services/libraryGuards';

/** Os efeitos novos valem para as próximas simulações (inclusive de temporadas em andamento). */
export class UpdateBehaviorUseCase implements IUseCase<UpdateBehaviorInput, BehaviorProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UpdateBehaviorInput): Promise<BehaviorProps> {
    return this.uow.run(async (repos) => {
      const behavior = await requireBehavior(repos, input.behaviorId);
      if (input.name !== undefined) behavior.rename(input.name);
      if (input.description !== undefined) behavior.describe(input.description);
      if (input.effects !== undefined) behavior.setEffects(input.effects);
      await repos.behaviors.update(behavior);
      return behavior.toJSON();
    });
  }
}
