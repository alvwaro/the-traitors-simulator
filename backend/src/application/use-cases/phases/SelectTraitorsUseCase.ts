import { Repositories } from '../../ports/IUnitOfWork';
import { SelectTraitorsInput } from '../../dtos/GameDTOs';
import { PlayerProps } from '../../../domain/entities';
import { GamePhase, PlayerRole } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { loadActiveGame } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { UndoableRecord } from '../../services/undo';

/**
 * Fase TRAITOR_SELECTION do dia 1: define quem são os traidores originais.
 * Pode ser chamado de novo na mesma fase para corrigir a escolha.
 */
export class SelectTraitorsUseCase extends UndoableRecord<SelectTraitorsInput, PlayerProps[]> {
  protected readonly undoLabel = 'Escolha dos traidores';

  async record(repos: Repositories, input: SelectTraitorsInput): Promise<PlayerProps[]> {
    const { season } = await loadActiveGame(repos, input.seasonId, GamePhase.TRAITOR_SELECTION);
    const roster = await PlayerRoster.load(repos, season.id);

    const traitorIds = new Set(input.traitorIds);
    traitorIds.forEach((id) => roster.requireActive(id));

    const active = roster.active();
    if (traitorIds.size === 0) throw new DomainError('Selecione ao menos um traidor');
    if (traitorIds.size >= active.length) throw new DomainError('É preciso ter ao menos um fiel');

    for (const player of active) {
      player.assignRole(traitorIds.has(player.id) ? PlayerRole.TRAITOR : PlayerRole.FAITHFUL);
    }
    await repos.players.updateMany(active);
    return roster.all().map((p) => p.toJSON());
  }
}
