import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { CastOutput, OwnerInput } from '../../dtos/LibraryDTOs';
import { toCastOutput } from '../../services/castOutput';

export class ListCastsUseCase implements IUseCase<OwnerInput, CastOutput[]> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: OwnerInput): Promise<CastOutput[]> {
    const casts = await this.repos.casts.findAll(input.ownerId);
    return Promise.all(casts.map((c) => toCastOutput(this.repos, c)));
  }
}
