import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CreatePhraseInput } from '../../dtos/LibraryDTOs';
import { Phrase, PhraseProps } from '../../../domain/entities';
import { requireBehavior } from '../../services/libraryGuards';

export class CreatePhraseUseCase implements IUseCase<CreatePhraseInput, PhraseProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CreatePhraseInput): Promise<PhraseProps> {
    return this.uow.run(async (repos) => {
      const phrase = Phrase.create(input);
      if (phrase.behaviorId) await requireBehavior(repos, phrase.behaviorId);
      await repos.phrases.create(phrase);
      return phrase.toJSON();
    });
  }
}
