import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { PhraseIdInput } from '../../dtos/LibraryDTOs';
import { requirePhrase } from '../../services/libraryGuards';

export class DeletePhraseUseCase implements IUseCase<PhraseIdInput, void> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: PhraseIdInput): Promise<void> {
    return this.uow.run(async (repos) => {
      await requirePhrase(repos, input.phraseId);
      await repos.phrases.delete(input.phraseId);
    });
  }
}
