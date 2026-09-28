import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { CharacterIdInput } from '../../dtos/LibraryDTOs';
import { CharacterProps } from '../../../domain/entities';
import { requireCharacter } from '../../services/libraryGuards';

export class GetCharacterUseCase implements IUseCase<CharacterIdInput, CharacterProps> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: CharacterIdInput): Promise<CharacterProps> {
    return (await requireCharacter(this.repos, input.characterId)).toJSON();
  }
}
