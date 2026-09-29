import { CreateSeasonUseCase } from '../../../application/use-cases/season/CreateSeasonUseCase';
import { DeleteSeasonUseCase } from '../../../application/use-cases/season/DeleteSeasonUseCase';
import { GetSeasonUseCase } from '../../../application/use-cases/season/GetSeasonUseCase';
import { ListSeasonsUseCase } from '../../../application/use-cases/season/ListSeasonsUseCase';
import { RegisterPrizeAdjustmentUseCase } from '../../../application/use-cases/season/RegisterPrizeAdjustmentUseCase';
import { SaveSeasonAsCastUseCase } from '../../../application/use-cases/season/SaveSeasonAsCastUseCase';
import { UpdateSeasonUseCase } from '../../../application/use-cases/season/UpdateSeasonUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { createSeasonBody, prizeAdjustmentBody, saveAsCastBody, seasonIdParams, updateSeasonBody } from '../validators/schemas';

export interface SeasonUseCases {
  create: CreateSeasonUseCase;
  list: ListSeasonsUseCase;
  get: GetSeasonUseCase;
  update: UpdateSeasonUseCase;
  remove: DeleteSeasonUseCase;
  saveAsCast: SaveSeasonAsCastUseCase;
  prizeAdjustment: RegisterPrizeAdjustmentUseCase;
}

/** Temporadas da Minha Área (as publicadas podem ser lidas por qualquer pessoa logada). */
export function seasonController(s: SeasonUseCases): Handlers<RoutesOf<'seasons'>> {
  return {
    'seasons.create': endpoint(s.create, { body: createSeasonBody, identity: 'ownerId', status: 201 }),
    'seasons.list': endpoint(s.list, { identity: 'ownerId' }),
    'seasons.get': endpoint(s.get, { params: seasonIdParams }),
    'seasons.update': endpoint(s.update, { params: seasonIdParams, body: updateSeasonBody }),
    'seasons.remove': endpoint(s.remove, { params: seasonIdParams, status: 204 }),
    'seasons.saveAsCast': endpoint(s.saveAsCast, { params: seasonIdParams, body: saveAsCastBody, identity: 'ownerId', status: 201 }),
    'seasons.prizeAdjustment': endpoint(s.prizeAdjustment, { params: seasonIdParams, body: prizeAdjustmentBody, status: 201 }),
  };
}
