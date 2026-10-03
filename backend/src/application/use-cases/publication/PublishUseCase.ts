import { countryOfSeason } from '@traitors/shared';
import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { PublicationOutput, PublishInput } from '../../dtos/PublicationDTOs';
import { placeFor, Publication, PublicationContent, PublicationCountry, PublicationKind, PublicationSource } from '../../../domain/entities';
import { ForbiddenError } from '../../../shared/errors/AppError';
import { assertOwner, requireCast, requireCharacter } from '../../services/libraryGuards';
import { requireSeason } from '../../services/gameGuards';
import { castSnapshot, characterSnapshot, seasonSettings, seasonSnapshot } from '../../services/publishedSnapshot';
import { toPublicationOutputs } from '../../services/publicationOutput';

/** O que vai para a vitrine: a cópia da origem e, nas temporadas, a versão do programa sugerida. */
interface PublishedCopy {
  source: PublicationSource;
  content: PublicationContent;
  country?: PublicationCountry;
}

/** Copia a origem, conferindo que ela é de quem está publicando. */
async function copyOf(repos: Repositories, input: PublishInput): Promise<PublishedCopy> {
  const description = input.description;
  switch (input.kind) {
    case 'SEASON': {
      const season = await requireSeason(repos, input.sourceId);
      assertOwner(season.ownerId, input.actor.id);
      // A capa é a do cast de onde a temporada saiu (se tiver).
      const cast = season.castId ? await repos.casts.findById(season.castId) : null;
      return {
        source: { kind: 'SEASON', seasonId: season.id },
        content: {
          name: season.name,
          description: description ?? null,
          imageUrl: cast?.toJSON().imageUrl,
          snapshot: await seasonSnapshot(repos, season),
          season: seasonSettings(season),
        },
        country: countryOfSeason(season.missionPool, season.currency),
      };
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
 * Publica uma temporada, um cast ou um personagem da Minha Área: vai uma cópia do momento, e mexer na origem
 * depois não muda o que está na vitrine. Donos põem temporadas nas Temporadas Oficiais (EUA ou Reino Unido)
 * ou na Área de Fãs; o resto vai para a Área de Fãs. Publicar de novo atualiza a mesma publicação.
 */
export class PublishUseCase implements IUseCase<PublishInput, PublicationOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: PublishInput): Promise<PublicationOutput> {
    return this.uow.run(async (repos) => {
      const { source, content, country } = await copyOf(repos, input);
      const existing = await repos.publications.findBySource(source);
      if (existing && existing.publisherId !== input.actor.id) throw new ForbiddenError('Isso já foi publicado por outra pessoa');

      // Atualizar uma temporada mantém o lugar dela, a não ser que outro seja pedido.
      const place = placeFor(input.actor.role, input.kind, {
        area: input.area ?? (input.kind === PublicationKind.SEASON ? existing?.area : undefined),
        country: input.country ?? existing?.country ?? country,
      });
      const publication = existing ?? Publication.publish({ ...content, source, publisherId: input.actor.id, place });
      if (existing) {
        existing.republish(content);
        existing.moveTo(place);
      }
      await repos.publications.save(publication);
      const [output] = await toPublicationOutputs(repos, [publication]);
      return output;
    });
  }
}
