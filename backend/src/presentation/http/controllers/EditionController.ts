import { ListEditionsUseCase } from '../../../application/use-cases/edition/ListEditionsUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';

/** Guia das temporadas do programa (EUA e Reino Unido). */
export function editionController(list: ListEditionsUseCase): Handlers<RoutesOf<'editions'>> {
  return { 'editions.list': endpoint(list, {}) };
}
