import { Repositories } from '../../ports/IUnitOfWork';
import { MissionOutput, RegisterMissionInput } from '../../dtos/GameDTOs';
import { Mission, PrizeTransaction } from '../../../domain/entities';
import { GamePhase, PrizeTransactionType } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { loadActiveGame } from '../../services/gameGuards';
import { PlayerRoster } from '../../services/PlayerRoster';
import { UndoableRecord } from '../../services/undo';

/** Registra a missão do dia: quem ganhou escudo e quanto entrou no prêmio. */
export class RegisterMissionUseCase extends UndoableRecord<RegisterMissionInput, MissionOutput> {
  protected readonly undoLabel = 'Registro da missão';

  /** "Missão 01", "Missão 02"... na ordem em que foram registradas na temporada. */
  private async defaultName(repos: Repositories, seasonId: string): Promise<string> {
    const next = (await repos.missions.countBySeason(seasonId)) + 1;
    return `Missão ${String(next).padStart(2, '0')}`;
  }

  async record(repos: Repositories, input: RegisterMissionInput): Promise<MissionOutput> {
    const { season, day } = await loadActiveGame(repos, input.seasonId, GamePhase.MISSION);
    const roster = await PlayerRoster.load(repos, season.id);

    if (input.prizeEarned < 0) throw new DomainError('O valor ganho não pode ser negativo');
    if (input.prizeAvailable != null && input.prizeEarned > input.prizeAvailable) {
      throw new DomainError('O valor ganho não pode ser maior que o disponível na missão');
    }
    const pot = await repos.prizes.getPrizePot(season.id);
    if (season.maxPrizePot !== null && pot + input.prizeEarned > season.maxPrizePot) {
      throw new DomainError(`O prêmio não pode passar de ${season.maxPrizePot}`);
    }

    const name = input.name?.trim() || (await this.defaultName(repos, season.id));
    const mission = Mission.create({
      dayId: day.id,
      name,
      description: input.description,
      prizeAvailable: input.prizeAvailable,
      shieldsHidden: input.shieldsHidden,
    });
    const hidden = new Set(input.hiddenShieldPlayerIds ?? []);
    for (const playerId of new Set(input.shieldedPlayerIds)) {
      roster.requireActive(playerId);
      mission.grantShield(playerId, hidden.has(playerId));
    }
    await repos.missions.create(mission);

    if (input.prizeEarned > 0) {
      await repos.prizes.addTransaction(
        PrizeTransaction.create({
          seasonId: season.id,
          dayId: day.id,
          missionId: mission.id,
          type: PrizeTransactionType.MISSION,
          amount: input.prizeEarned,
          description: `Missão: ${mission.name}`,
        }),
      );
    }
    return { ...mission.toJSON(), prizeEarned: input.prizeEarned };
  }
}
