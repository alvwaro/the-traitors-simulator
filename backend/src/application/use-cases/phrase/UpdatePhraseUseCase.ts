import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { UpdatePhraseInput } from '../../dtos/LibraryDTOs';
import { PhraseProps } from '../../../domain/entities';
import { requireBehavior, requirePhrase } from '../../services/libraryGuards';

export class UpdatePhraseUseCase implements IUseCase<UpdatePhraseInput, PhraseProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UpdatePhraseInput): Promise<PhraseProps> {
    return this.uow.run(async (repos) => {
      const phrase = await requirePhrase(repos, input.phraseId);
      if (input.text !== undefined) phrase.rewrite(input.text);
      if (input.phase !== undefined) phrase.moveTo(input.phase);
      if (input.tone !== undefined) phrase.retone(input.tone);
      if (input.behaviorId !== undefined) {
        if (input.behaviorId) await requireBehavior(repos, input.behaviorId);
        phrase.linkBehavior(input.behaviorId);
      }
      await repos.phrases.update(phrase);
      return phrase.toJSON();
    });
  }
}
