import { Request, RequestHandler } from 'express';
import { IAccessRepository } from '../../../domain/repositories';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/AppError';
import { actorOf } from './session';

type Mode = 'read' | 'write';

/**
 * Política de acesso por rota: temporadas, casts e personagens são de quem criou.
 * Uma temporada publicada pode ser vista por qualquer pessoa logada, mas só alterada por quem criou.
 * Quem não pode ver recebe 404 (não revela que o item existe).
 */
export class AccessGuards {
  constructor(private readonly access: IAccessRepository) {}

  season(mode: Mode): RequestHandler {
    return async (req, res, next) => {
      const actor = actorOf(res);
      const seasonId = String(req.params.seasonId);
      const found = await this.access.season(seasonId);
      const isOwner = !!found && found.ownerId === actor.id;
      if (!found || (!isOwner && !found.published)) throw new NotFoundError('Temporada', seasonId);
      if (mode === 'write' && !isOwner) throw new ForbiddenError('Só quem criou a temporada pode alterá-la');
      next();
    };
  }

  cast(): RequestHandler {
    return this.owned('Cast', 'castId', (id) => this.access.castOwner(id));
  }

  character(): RequestHandler {
    return this.owned('Personagem', 'characterId', (id) => this.access.characterOwner(id));
  }

  private owned(entity: string, param: string, ownerOf: (id: string) => Promise<string | null | undefined>): RequestHandler {
    return async (req: Request, res, next) => {
      const actor = actorOf(res);
      const id = String(req.params[param]);
      if ((await ownerOf(id)) !== actor.id) throw new NotFoundError(entity, id);
      next();
    };
  }
}
