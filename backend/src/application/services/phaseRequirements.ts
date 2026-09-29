import { Day, isEndgameDecided, Season } from '../../domain/entities';
import { GamePhase, PlayerRole, PlayerStatus, RoundTableKind } from '../../domain/enums';
import { Repositories } from '../ports/IUnitOfWork';
import { pendingOffer } from './playerView';

/**
 * O que ainda falta registrar na fase atual antes de avançar.
 * Retorna null quando a fase pode ser encerrada.
 */
export async function pendingRequirement(
  repos: Repositories,
  season: Season,
  day: Day,
  phase: GamePhase,
): Promise<string | null> {
  if (season.isPlayerMode() && pendingOffer(season, day.number)) return 'Responda ao convite dos Traidores';
  if (season.isAutomatic() && phase !== GamePhase.FINALE && !(await repos.simulationEvents.existsFor(day.id, phase))) {
    return 'Simule esta fase para ver o que acontece';
  }
  switch (phase) {
    case GamePhase.TRAITOR_SELECTION: {
      const active = await repos.players.findBySeason(season.id, { status: PlayerStatus.ACTIVE });
      const traitors = active.filter((p) => p.isTraitor()).length;
      if (traitors === 0) return 'Selecione ao menos um traidor';
      if (traitors === active.length) return 'É preciso ter ao menos um fiel';
      return null;
    }
    case GamePhase.MISSION: {
      const missions = await repos.missions.findByDay(day.id);
      return missions.length > 0 ? null : 'Registre a missão do dia';
    }
    case GamePhase.ROUND_TABLE: {
      const tables = await repos.roundTables.findByDay(day.id);
      return tables.some((t) => t.kind === RoundTableKind.REGULAR) ? null : 'Registre a mesa redonda do dia';
    }
    case GamePhase.TRAITORS_MEETING: {
      if (await repos.traitorMeetings.findByDay(day.id)) return null;
      const traitors = await repos.players.findBySeason(season.id, { status: PlayerStatus.ACTIVE, role: PlayerRole.TRAITOR });
      // Sem traidores ativos não há reunião a registrar.
      return traitors.length > 0 ? 'Registre a reunião dos traidores' : null;
    }
    case GamePhase.ENDGAME_ROUND_TABLE: {
      return isEndgameDecided(await repos.roundTables.findByDay(day.id)) ? null : 'A final só termina quando todos votarem para encerrar o jogo';
    }
    case GamePhase.FINALE:
      return 'A temporada já terminou';
    default:
      return null;
  }
}
