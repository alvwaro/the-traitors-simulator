import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { SelectTraitorsInput } from '../../dtos/GameDTOs';
import { PlayerProps } from '../../../domain/entities';
import { GamePhase, PlayerRole } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { loadActiveGame } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { rememberForUndo } from '../../services/undo';

/**
 * Fase TRAITOR_SELECTION do dia 1: define quem são os traidores originais.
 * Pode ser chamado de novo na mesma fase para corrigir a escolha.
 */
export class SelectTraitorsUseCase implements IUseCase<SelectTraitorsInput, PlayerProps[]> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: SelectTraitorsInput): Promise<PlayerProps[]> {
    return this.uow.run(async (repos) => {
      await rememberForUndo(repos, input.seasonId, 'Escolha dos traidores');
      return this.record(repos, input);
    });
  }

  /** A mesma regra dentro de uma transação já aberta (usada também pela simulação automática). */
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
