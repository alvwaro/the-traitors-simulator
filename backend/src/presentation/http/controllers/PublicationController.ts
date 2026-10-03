import {
  CopyPublicationUseCase,
  CopySeasonUseCase,
  GetPublicationUseCase,
  ListPublicationsUseCase,
  UnpublishUseCase,
} from '../../../application/use-cases/publication/PublicationUseCases';
import { PublishUseCase } from '../../../application/use-cases/publication/PublishUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { actorOf } from '../middlewares/session';
import { copyPublicationBody, copySeasonBody, publicationIdParams, publicationsQuery, publishBody } from '../validators/schemas';

export interface PublicationUseCases {
  list: ListPublicationsUseCase;
  get: GetPublicationUseCase;
  publish: PublishUseCase;
  unpublish: UnpublishUseCase;
  copy: CopyPublicationUseCase;
  copySeason: CopySeasonUseCase;
}

/** Temporadas Oficiais e Área de Fãs: publicar, ver, tirar e copiar para a biblioteca. */
export function publicationController(p: PublicationUseCases): Handlers<RoutesOf<'publications'>> {
  return {
    'publications.list': async (req, res) => {
      const { area, kind, mine } = publicationsQuery.parse(req.query);
      // "mine": só as publicações de quem está logado.
      const publisherId = mine === 'true' ? actorOf(res).id : undefined;
      res.json(await p.list.execute({ area, kind, publisherId }));
    },
    'publications.get': endpoint(p.get, { params: publicationIdParams }),
    'publications.publish': endpoint(p.publish, { body: publishBody, identity: 'actor', status: 201 }),
    'publications.remove': endpoint(p.unpublish, { params: publicationIdParams, identity: 'actor', status: 204 }),
    'publications.copy': endpoint(p.copy, { params: publicationIdParams, body: copyPublicationBody, identity: 'actor', status: 201 }),
    'publications.copySeason': endpoint(p.copySeason, { params: publicationIdParams, body: copySeasonBody, identity: 'actor', status: 201 }),
  };
}
