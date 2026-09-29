import { Repositories } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { GameStateOutput } from '../../dtos/GameDTOs';
import { DayPhase } from '../../../domain/entities';
import { GamePhase, PlayerStatus, RoundTableKind } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { ENDGAME_MAX_ACTIVE_PLAYERS } from '../../../domain/rules';
import { loadActiveGame } from '../../services/gameGuards';
import { readGameState } from '../../services/gameState';
import { closePhase } from '../../services/phaseHistory';
import { UndoableRecord } from '../../services/undo';

/**
 * Marca a temporada como ENDGAME quando restam 6 jogadores ou menos.
 *  - Antes da mesa redonda do dia: ela vira a Mesa Final na hora.
 *  - Depois da mesa redonda (ou durante a reunião): a noite acontece e a final começa no dia seguinte.
 */
export class StartEndgameUseCase extends UndoableRecord<SeasonIdInput, GameStateOutput> {
  protected readonly undoLabel = 'Início da reta final';

  async record(repos: Repositories, input: SeasonIdInput): Promise<GameStateOutput> {
    const { season, day, phase } = await loadActiveGame(repos, input.seasonId, [
      GamePhase.BREAKFAST,
      GamePhase.MISSION,
      GamePhase.ROUND_TABLE,
      GamePhase.TRAITORS_MEETING,
    ]);

    const active = await repos.players.findBySeason(season.id, { status: PlayerStatus.ACTIVE });
    if (active.length > ENDGAME_MAX_ACTIVE_PLAYERS) {
      throw new DomainError(`A final só pode começar com ${ENDGAME_MAX_ACTIVE_PLAYERS} jogadores ou menos (restam ${active.length})`);
    }
    if (active.length < 2) throw new DomainError('São necessários ao menos 2 jogadores ativos para a final');

    season.startEndgame();

    if (phase === GamePhase.ROUND_TABLE) {
      const tables = await repos.roundTables.findByDay(day.id);
      if (!tables.some((t) => t.kind === RoundTableKind.REGULAR)) {
        // A mesa redonda de hoje ainda não aconteceu: ela passa a ser a Mesa Final.
        await closePhase(repos, day.id, phase);
        await repos.days.savePhase(DayPhase.start(day.id, GamePhase.ENDGAME_ROUND_TABLE));
        season.moveTo(day.number, GamePhase.ENDGAME_ROUND_TABLE);
      }
    }

    await repos.seasons.update(season);
    return readGameState(repos, season.id);
  }
}
