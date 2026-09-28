import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { PlayerRefInput } from '../../dtos/PlayerDTOs';
import { PlayerProps } from '../../../domain/entities';
import { PlayerStatus } from '../../../domain/enums';
import { loadActiveGame } from '../../services/gameGuards';
import { rememberForUndo } from '../../services/undo';
import { PlayerRoster } from '../../services/PlayerRoster';

/** Jogador desistiu / saiu por motivo externo durante a temporada. */
export class WithdrawPlayerUseCase implements IUseCase<PlayerRefInput, PlayerProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: PlayerRefInput): Promise<PlayerProps> {
    return this.uow.run(async (repos) => {
      await rememberForUndo(repos, input.seasonId, 'Desistência de jogador');
      const { season, day } = await loadActiveGame(repos, input.seasonId);
      const player = (await PlayerRoster.load(repos, season.id)).requireActive(input.playerId);
      player.eliminate(PlayerStatus.WITHDRAWN, day.id);
      await repos.players.update(player);
      return player.toJSON();
    });
  }
}
