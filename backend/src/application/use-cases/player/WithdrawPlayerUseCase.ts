import { Repositories } from '../../ports/IUnitOfWork';
import { PlayerRefInput } from '../../dtos/PlayerDTOs';
import { PlayerProps } from '../../../domain/entities';
import { PlayerStatus } from '../../../domain/enums';
import { loadActiveGame } from '../../services/gameGuards';
import { UndoableRecord } from '../../services/undo';
import { PlayerRoster } from '../../services/PlayerRoster';

/** Jogador desistiu / saiu por motivo externo durante a temporada. */
export class WithdrawPlayerUseCase extends UndoableRecord<PlayerRefInput, PlayerProps> {
  protected readonly undoLabel = 'Desistência de jogador';

  async record(repos: Repositories, input: PlayerRefInput): Promise<PlayerProps> {
    const { season, day } = await loadActiveGame(repos, input.seasonId);
    const player = (await PlayerRoster.load(repos, season.id)).requireActive(input.playerId);
    player.eliminate(PlayerStatus.WITHDRAWN, day.id);
    await repos.players.update(player);
    return player.toJSON();
  }
}
