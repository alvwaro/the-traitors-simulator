import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CreateCharacterInput } from '../../dtos/LibraryDTOs';
import { Character, CharacterProps } from '../../../domain/entities';
import { ensureBehaviorsExist, requireOwnedCast } from '../../services/libraryGuards';

/** Cria o personagem; com `castId`, ele já entra no fim do elenco desse cast. */
export class CreateCharacterUseCase implements IUseCase<CreateCharacterInput, CharacterProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CreateCharacterInput): Promise<CharacterProps> {
    return this.uow.run(async (repos) => {
      const cast = input.castId ? await requireOwnedCast(repos, input.ownerId, input.castId) : null;
      const character = Character.create(input);
      await ensureBehaviorsExist(repos, character.behaviorIds);
      await repos.characters.create(character);
      if (cast) {
        cast.setMembers([...cast.characterIds, character.id]);
        await repos.casts.update(cast);
      }
      return character.toJSON();
    });
  }
}
