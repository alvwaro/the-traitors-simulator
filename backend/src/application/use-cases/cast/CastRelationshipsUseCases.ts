import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { CastIdInput, CastRelationshipsOutput, UpdateCastRelationshipInput } from '../../dtos/LibraryDTOs';
import { DomainError } from '../../../domain/errors/DomainError';
import { RelationshipMatrix } from '../../../domain/simulation';
import { requireCast } from '../../services/libraryGuards';

/**
 * O que um personagem sente por outro dentro do cast. Vira o relacionamento inicial
 * das temporadas automáticas criadas com este cast; pares não definidos são sorteados.
 */
export class GetCastRelationshipsUseCase implements IUseCase<CastIdInput, CastRelationshipsOutput> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: CastIdInput): Promise<CastRelationshipsOutput> {
    await requireCast(this.repos, input.castId);
    return { relationships: await this.repos.casts.findRelationships(input.castId) };
  }
}

export class UpdateCastRelationshipUseCase implements IUseCase<UpdateCastRelationshipInput, CastRelationshipsOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: UpdateCastRelationshipInput): Promise<CastRelationshipsOutput> {
    return this.uow.run(async (repos) => {
      const cast = await requireCast(repos, input.castId);
      if (input.fromId === input.toId) throw new DomainError('Escolha dois personagens diferentes');
      for (const id of [input.fromId, input.toId]) {
        if (!cast.characterIds.includes(id)) throw new DomainError('O personagem não faz parte deste cast');
      }

      if (input.clear) {
        await repos.casts.deleteRelationship(cast.id, input.fromId, input.toId);
      } else {
        const matrix = new RelationshipMatrix(await repos.casts.findRelationships(cast.id));
        matrix.set(input.fromId, input.toId, { trust: input.trust, liking: input.liking, hatred: input.hatred });
        // Aliança vale nos dois sentidos: o outro lado passa a existir, se ainda não existia.
        if (input.allied !== undefined) matrix.setAllied(input.fromId, input.toId, input.allied);
        for (const r of matrix.changed()) await repos.casts.saveRelationship(cast.id, r);
      }
      return { relationships: await repos.casts.findRelationships(cast.id) };
    });
  }
}
