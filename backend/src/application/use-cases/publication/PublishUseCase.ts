import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { PublicationOutput, PublishInput } from '../../dtos/PublicationDTOs';
import { areaFor, Publication, PublicationContent, PublicationSource } from '../../../domain/entities';
import { ForbiddenError } from '../../../shared/errors/AppError';
import { assertOwner, requireCast, requireCharacter } from '../../services/libraryGuards';
import { requireSeason } from '../../services/gameGuards';
import { castSnapshot, characterSnapshot } from '../../services/publishedSnapshot';
import { toPublicationOutputs } from '../../services/publicationOutput';

/** O conteúdo atual da origem, conferindo que ela é de quem está publicando. */
async function contentOf(repos: Repositories, input: PublishInput): Promise<{ source: PublicationSource; content: PublicationContent }> {
  const description = input.description;
  switch (input.kind) {
    case 'SEASON': {
      const season = await requireSeason(repos, input.sourceId);
      assertOwner(season.ownerId, input.actor.id);
      return { source: { kind: 'SEASON', seasonId: season.id }, content: { name: season.name, description: description ?? null, snapshot: null } };
    }
    case 'CAST': {
      const cast = await requireCast(repos, input.sourceId);
      assertOwner(cast.ownerId, input.actor.id);
      const props = cast.toJSON();
      return {
        source: { kind: 'CAST', castId: cast.id },
        content: { name: props.name, description: description === undefined ? props.description : description, imageUrl: props.imageUrl, snapshot: await castSnapshot(repos, cast) },
      };
    }
    case 'CHARACTER': {
      const character = await requireCharacter(repos, input.sourceId);
      assertOwner(character.ownerId, input.actor.id);
      return {
        source: { kind: 'CHARACTER', characterId: character.id },
        content: { name: character.name, description: description ?? null, imageUrl: character.imageUrl, snapshot: await characterSnapshot(repos, character) },
      };
    }
  }
}

/**
 * Publica uma temporada, um cast ou um personagem da Minha Área.
 * Donos escolhem a área (oficial ou fãs); fãs publicam na Área de Fãs. Publicar de novo atualiza a mesma publicação.
 */
export class PublishUseCase implements IUseCase<PublishInput, PublicationOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: PublishInput): Promise<PublicationOutput> {
    return this.uow.run(async (repos) => {
      const { source, content } = await contentOf(repos, input);
      const existing = await repos.publications.findBySource(source);
      if (existing && existing.publisherId !== input.actor.id) throw new ForbiddenError('Isso já foi publicado por outra pessoa');

      const area = areaFor(input.actor.role, input.area ?? existing?.area);
      const publication = existing ?? Publication.publish({ ...content, source, publisherId: input.actor.id, area });
      if (existing) {
        existing.republish(content);
        existing.moveTo(area);
      }
      await repos.publications.save(publication);
      const [output] = await toPublicationOutputs(repos, [publication]);
      return output;
    });
  }
}
