import { GetCastRelationshipsUseCase, UpdateCastRelationshipUseCase } from '../../../application/use-cases/cast/CastRelationshipsUseCases';
import { CreateCastUseCase } from '../../../application/use-cases/cast/CreateCastUseCase';
import { DeleteCastUseCase } from '../../../application/use-cases/cast/DeleteCastUseCase';
import { GetCastRankingUseCase } from '../../../application/use-cases/cast/GetCastRankingUseCase';
import { GetCastUseCase } from '../../../application/use-cases/cast/GetCastUseCase';
import { ListCastsUseCase } from '../../../application/use-cases/cast/ListCastsUseCase';
import { RandomizeCastBehaviorsUseCase } from '../../../application/use-cases/cast/RandomizeCastBehaviorsUseCase';
import { UpdateCastUseCase } from '../../../application/use-cases/cast/UpdateCastUseCase';
import { SetCastMemberPhotoUseCase } from '../../../application/use-cases/cast/SetCastMemberPhotoUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { castIdParams, castMemberParams, castMemberPhotoBody, createCastBody, updateCastBody, updateCastRelationshipBody } from '../validators/schemas';

export interface CastUseCases {
  create: CreateCastUseCase;
  list: ListCastsUseCase;
  get: GetCastUseCase;
  update: UpdateCastUseCase;
  remove: DeleteCastUseCase;
  relationships: GetCastRelationshipsUseCase;
  updateRelationship: UpdateCastRelationshipUseCase;
  ranking: GetCastRankingUseCase;
  randomizeBehaviors: RandomizeCastBehaviorsUseCase;
  memberPhoto: SetCastMemberPhotoUseCase;
}

/** Casts salvos (grupos de personagens) e o que os personagens sentem uns pelos outros. */
export function castController(c: CastUseCases): Handlers<RoutesOf<'casts'>> {
  const params = castIdParams;
  return {
    'casts.create': endpoint(c.create, { body: createCastBody, identity: 'ownerId', status: 201 }),
    'casts.list': endpoint(c.list, { identity: 'ownerId' }),
    'casts.get': endpoint(c.get, { params }),
    'casts.update': endpoint(c.update, { params, body: updateCastBody, identity: 'ownerId' }),
    'casts.remove': endpoint(c.remove, { params, status: 204 }),
    'casts.relationships': endpoint(c.relationships, { params }),
    'casts.updateRelationship': endpoint(c.updateRelationship, { params, body: updateCastRelationshipBody }),
    'casts.ranking': endpoint(c.ranking, { params }),
    'casts.randomizeBehaviors': endpoint(c.randomizeBehaviors, { params }),
    'casts.memberPhoto': endpoint(c.memberPhoto, { params: castMemberParams, body: castMemberPhotoBody }),
  };
}
