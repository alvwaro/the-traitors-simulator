import { Request, RequestHandler } from 'express';
import { IAccessRepository } from '../../../domain/repositories';
import { NotFoundError } from '../../../shared/errors/AppError';
import { actorOf } from './session';

/**
 * Política de acesso por rota: temporadas, casts e personagens são de quem criou.
 * O que vai para uma vitrine é uma cópia (lida pelas rotas de publicações), nunca o original.
 * Quem não é dono recebe 404 (não revela que o item existe).
 */
export class AccessGuards {
  constructor(private readonly access: IAccessRepository) {}

  season(): RequestHandler {
    return this.owned('Temporada', 'seasonId', (id) => this.access.seasonOwner(id));
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
