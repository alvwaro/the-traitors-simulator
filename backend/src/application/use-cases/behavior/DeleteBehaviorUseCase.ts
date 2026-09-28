import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { BehaviorIdInput } from '../../dtos/LibraryDTOs';
import { requireBehavior } from '../../services/libraryGuards';

/** Sai dos personagens e jogadores; frases ligadas a ele passam a valer para qualquer um. */
export class DeleteBehaviorUseCase implements IUseCase<BehaviorIdInput, void> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: BehaviorIdInput): Promise<void> {
    return this.uow.run(async (repos) => {
      await requireBehavior(repos, input.behaviorId);
      await repos.behaviors.delete(input.behaviorId);
    });
  }
}
