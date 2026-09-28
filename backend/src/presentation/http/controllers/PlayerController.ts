import { Request, Response } from 'express';
import { AddPlayerUseCase } from '../../../application/use-cases/player/AddPlayerUseCase';
import { ListPlayersUseCase } from '../../../application/use-cases/player/ListPlayersUseCase';
import { RemovePlayerUseCase } from '../../../application/use-cases/player/RemovePlayerUseCase';
import { UpdatePlayerUseCase } from '../../../application/use-cases/player/UpdatePlayerUseCase';
import { WithdrawPlayerUseCase } from '../../../application/use-cases/player/WithdrawPlayerUseCase';
import { addPlayerBody, playerParams, seasonIdParams, updatePlayerBody } from '../validators/schemas';
import { actorOf } from '../middlewares/session';

export class PlayerController {
  constructor(
    private readonly addPlayer: AddPlayerUseCase,
    private readonly listPlayers: ListPlayersUseCase,
    private readonly updatePlayer: UpdatePlayerUseCase,
    private readonly removePlayer: RemovePlayerUseCase,
    private readonly withdrawPlayer: WithdrawPlayerUseCase,
  ) {}

  add = async (req: Request, res: Response) => {
    const input = { ...seasonIdParams.parse(req.params), ...addPlayerBody.parse(req.body), ownerId: actorOf(res).id };
    res.status(201).json(await this.addPlayer.execute(input));
  };

  list = async (req: Request, res: Response) => {
    res.json(await this.listPlayers.execute(seasonIdParams.parse(req.params)));
  };

  update = async (req: Request, res: Response) => {
    const input = { ...playerParams.parse(req.params), ...updatePlayerBody.parse(req.body) };
    res.json(await this.updatePlayer.execute(input));
  };

  remove = async (req: Request, res: Response) => {
    await this.removePlayer.execute(playerParams.parse(req.params));
    res.status(204).end();
  };

  withdraw = async (req: Request, res: Response) => {
    res.json(await this.withdrawPlayer.execute(playerParams.parse(req.params)));
  };
}
