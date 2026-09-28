import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { ListCharactersInput } from '../../dtos/LibraryDTOs';
import { CharacterProps } from '../../../domain/entities';

export class ListCharactersUseCase implements IUseCase<ListCharactersInput, CharacterProps[]> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: ListCharactersInput): Promise<CharacterProps[]> {
    const characters = await this.repos.characters.findAll(input.ownerId, input.search);
    return characters.map((c) => c.toJSON());
  }
}
