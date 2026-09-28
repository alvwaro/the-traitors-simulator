import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { CastIdInput, CastOutput } from '../../dtos/LibraryDTOs';
import { toCastOutput } from '../../services/castOutput';
import { requireCast } from '../../services/libraryGuards';

export class GetCastUseCase implements IUseCase<CastIdInput, CastOutput> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: CastIdInput): Promise<CastOutput> {
    return toCastOutput(this.repos, await requireCast(this.repos, input.castId));
  }
}
