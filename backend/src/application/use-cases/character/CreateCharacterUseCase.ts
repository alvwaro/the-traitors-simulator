import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CreateCharacterInput } from '../../dtos/LibraryDTOs';
import { Character, CharacterProps } from '../../../domain/entities';
import { ensureBehaviorsExist } from '../../services/libraryGuards';

export class CreateCharacterUseCase implements IUseCase<CreateCharacterInput, CharacterProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CreateCharacterInput): Promise<CharacterProps> {
    return this.uow.run(async (repos) => {
      const character = Character.create(input);
      await ensureBehaviorsExist(repos, character.behaviorIds);
      await repos.characters.create(character);
      return character.toJSON();
    });
  }
}
