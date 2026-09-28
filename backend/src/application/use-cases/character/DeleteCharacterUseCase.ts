import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CharacterIdInput } from '../../dtos/LibraryDTOs';
import { requireCharacter } from '../../services/libraryGuards';

/** Remove da biblioteca e dos casts; jogadores em temporadas continuam existindo. */
export class DeleteCharacterUseCase implements IUseCase<CharacterIdInput, void> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CharacterIdInput): Promise<void> {
    return this.uow.run(async (repos) => {
      await requireCharacter(repos, input.characterId);
      await repos.characters.delete(input.characterId);
    });
  }
}
