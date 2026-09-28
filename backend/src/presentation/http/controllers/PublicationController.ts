import { Request, Response } from 'express';
import { PublishUseCase } from '../../../application/use-cases/publication/PublishUseCase';
import { CopyPublicationUseCase, ListPublicationsUseCase, UnpublishUseCase } from '../../../application/use-cases/publication/PublicationUseCases';
import { copyPublicationBody, publicationIdParams, publicationsQuery, publishBody } from '../validators/schemas';
import { actorOf } from '../middlewares/session';

/** Área Oficial e Área de Fãs: publicar, ver, tirar e copiar para a Minha Área. */
export class PublicationController {
  constructor(
    private readonly listPublications: ListPublicationsUseCase,
    private readonly publishUseCase: PublishUseCase,
    private readonly unpublishUseCase: UnpublishUseCase,
    private readonly copyUseCase: CopyPublicationUseCase,
  ) {}

  list = async (req: Request, res: Response) => {
    const { area, kind, mine } = publicationsQuery.parse(req.query);
    const publisherId = mine === 'true' ? actorOf(res).id : undefined;
    res.json(await this.listPublications.execute({ area, kind, publisherId }));
  };

  publish = async (req: Request, res: Response) => {
    res.status(201).json(await this.publishUseCase.execute({ actor: actorOf(res), ...publishBody.parse(req.body) }));
  };

  remove = async (req: Request, res: Response) => {
    await this.unpublishUseCase.execute({ actor: actorOf(res), ...publicationIdParams.parse(req.params) });
    res.status(204).end();
  };

  copy = async (req: Request, res: Response) => {
    const input = { actor: actorOf(res), ...publicationIdParams.parse(req.params), ...copyPublicationBody.parse(req.body ?? {}) };
    res.status(201).json(await this.copyUseCase.execute(input));
  };
}
