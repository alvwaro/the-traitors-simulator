import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { CreateBehaviorInput } from '../../dtos/LibraryDTOs';
import { Behavior, BehaviorProps } from '../../../domain/entities';

export class CreateBehaviorUseCase implements IUseCase<CreateBehaviorInput, BehaviorProps> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: CreateBehaviorInput): Promise<BehaviorProps> {
    const behavior = Behavior.create(input);
    await this.repos.behaviors.create(behavior);
    return behavior.toJSON();
  }
}
