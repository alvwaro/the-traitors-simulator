import { AddPlayerUseCase } from '../../../application/use-cases/player/AddPlayerUseCase';
import { ListPlayersUseCase } from '../../../application/use-cases/player/ListPlayersUseCase';
import { RemovePlayerUseCase } from '../../../application/use-cases/player/RemovePlayerUseCase';
import { UpdatePlayerUseCase } from '../../../application/use-cases/player/UpdatePlayerUseCase';
import { WithdrawPlayerUseCase } from '../../../application/use-cases/player/WithdrawPlayerUseCase';
import { endpoint, Handlers, RoutesOf } from '../endpoint';
import { addPlayerBody, playerParams, seasonIdParams, updatePlayerBody } from '../validators/schemas';

export interface PlayerUseCases {
  add: AddPlayerUseCase;
  list: ListPlayersUseCase;
  update: UpdatePlayerUseCase;
  remove: RemovePlayerUseCase;
  withdraw: WithdrawPlayerUseCase;
}

/** Elenco da temporada. */
export function playerController(p: PlayerUseCases): Handlers<RoutesOf<'players'>> {
  return {
    'players.add': endpoint(p.add, { params: seasonIdParams, body: addPlayerBody, identity: 'ownerId', status: 201 }),
    'players.list': endpoint(p.list, { params: seasonIdParams }),
    'players.update': endpoint(p.update, { params: playerParams, body: updatePlayerBody }),
    'players.remove': endpoint(p.remove, { params: playerParams, status: 204 }),
    'players.withdraw': endpoint(p.withdraw, { params: playerParams }),
  };
}
