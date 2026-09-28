import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CastIdInput } from '../../dtos/LibraryDTOs';
import { requireCast } from '../../services/libraryGuards';

/** Apaga só o cast; os personagens continuam na biblioteca. */
export class DeleteCastUseCase implements IUseCase<CastIdInput, void> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CastIdInput): Promise<void> {
    return this.uow.run(async (repos) => {
      await requireCast(repos, input.castId);
      await repos.casts.delete(input.castId);
    });
  }
}
