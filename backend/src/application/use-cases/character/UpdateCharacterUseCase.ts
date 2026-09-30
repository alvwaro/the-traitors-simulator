import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { UpdateCharacterInput } from '../../dtos/LibraryDTOs';
import { CharacterProps } from '../../../domain/entities';
import { ensureBehaviorsExist, requireCharacter } from '../../services/libraryGuards';

/** Não altera jogadores de temporadas já criadas (eles guardam uma cópia). */
export class UpdateCharacterUseCase implements IUseCase<UpdateCharacterInput, CharacterProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UpdateCharacterInput): Promise<CharacterProps> {
    return this.uow.run(async (repos) => {
      const character = await requireCharacter(repos, input.characterId);
      if (input.name !== undefined) character.rename(input.name);
      if (input.imageUrl !== undefined) character.changeImage(input.imageUrl);
      if (input.photos !== undefined) character.setPhotos(input.photos);
      if (input.profile !== undefined) character.setProfile(input.profile);
      if (input.behaviorIds !== undefined) {
        character.setBehaviors(input.behaviorIds);
        await ensureBehaviorsExist(repos, character.behaviorIds);
      }
      await repos.characters.update(character);
      return character.toJSON();
    });
  }
}
