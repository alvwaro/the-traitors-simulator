import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { ListPhrasesInput } from '../../dtos/LibraryDTOs';
import { PhraseProps } from '../../../domain/entities';

export class ListPhrasesUseCase implements IUseCase<ListPhrasesInput, PhraseProps[]> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: ListPhrasesInput): Promise<PhraseProps[]> {
    const phrases = await this.repos.phrases.findAll(input.phase);
    return phrases.map((p) => p.toJSON());
  }
}
