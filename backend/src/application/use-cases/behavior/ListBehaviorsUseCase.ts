import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { BehaviorProps } from '../../../domain/entities';

export class ListBehaviorsUseCase implements IUseCase<void, BehaviorProps[]> {
  constructor(private readonly repos: Repositories) {}

  async execute(): Promise<BehaviorProps[]> {
    return (await this.repos.behaviors.findAll()).map((b) => b.toJSON());
  }
}
