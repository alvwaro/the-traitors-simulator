import { CreateBehaviorUseCase } from '../../../application/use-cases/behavior/CreateBehaviorUseCase';
import { DeleteBehaviorUseCase } from '../../../application/use-cases/behavior/DeleteBehaviorUseCase';
import { ListBehaviorsUseCase } from '../../../application/use-cases/behavior/ListBehaviorsUseCase';
import { UpdateBehaviorUseCase } from '../../../application/use-cases/behavior/UpdateBehaviorUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { behaviorIdParams, createBehaviorBody, updateBehaviorBody } from '../validators/schemas';

export interface BehaviorUseCases {
  create: CreateBehaviorUseCase;
  list: ListBehaviorsUseCase;
  update: UpdateBehaviorUseCase;
  remove: DeleteBehaviorUseCase;
}

/** Comportamentos (tags de personalidade) da simulação automática. */
export function behaviorController(b: BehaviorUseCases): Handlers<RoutesOf<'behaviors'>> {
  return {
    'behaviors.list': endpoint(b.list, {}),
    'behaviors.create': endpoint(b.create, { body: createBehaviorBody, status: 201 }),
    'behaviors.update': endpoint(b.update, { params: behaviorIdParams, body: updateBehaviorBody }),
    'behaviors.remove': endpoint(b.remove, { params: behaviorIdParams, status: 204 }),
  };
}
