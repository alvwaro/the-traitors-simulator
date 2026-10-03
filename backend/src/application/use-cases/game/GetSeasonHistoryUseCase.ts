import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { SeasonIdInput } from '../../dtos/SeasonDTOs';
import { DayHistory, SeasonHistoryOutput } from '../../dtos/GameDTOs';
import { PrizeTransactionType } from '../../../domain/enums';
import { requireSeason } from '../../services/gameGuards';
import { maskPlayer, viewerOf, visibleEvents, visibleMeeting, withoutPhrases } from '../../services/playerView';
import { GamePhase } from '../../../domain/enums';
import { SimulationEventProps } from '../../../domain/entities';

/** Linha do tempo completa da temporada, dia a dia (estilo resumo de episódio). */
export class GetSeasonHistoryUseCase implements IUseCase<SeasonIdInput, SeasonHistoryOutput> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: SeasonIdInput): Promise<SeasonHistoryOutput> {
    const season = await requireSeason(this.repos, input.seasonId);
    const players = await this.repos.players.findBySeason(season.id);
    const transactions = await this.repos.prizes.findBySeason(season.id);
    const days = await this.repos.days.findBySeason(season.id);

    const prizeByMission = new Map(
      transactions
        .filter((t) => t.type === PrizeTransactionType.MISSION && t.missionId)
        .map((t) => [t.missionId as string, t.amount]),
    );
    const roleById = new Map(players.map((p) => [p.id, p.role]));
    const today = season.currentDay !== null ? days.find((d) => d.number === season.currentDay) : undefined;
    const viewer = viewerOf(season, players, today?.id ?? null);
    // Falas desligadas: só as que envolvem o jogador humano (no modo Jogador) continuam na narrativa.
    const phrased = (list: SimulationEventProps[]) => (season.showPhrases ? list : withoutPhrases(list, viewer.human?.id));

    const history: DayHistory[] = [];
    for (const day of days) {
      const phases = await this.repos.days.findPhases(day.id);
      const missions = await this.repos.missions.findByDay(day.id);
      const roundTables = await this.repos.roundTables.findByDay(day.id);
      const meeting = await this.repos.traitorMeetings.findByDay(day.id);
      const events = await this.repos.simulationEvents.findByDay(day.id);

      history.push({
        day: day.toJSON(),
        phases: phases.map((p) => p.toJSON()),
        missions: missions.map((m) => ({ ...m.toJSON(), prizeEarned: prizeByMission.get(m.id) ?? 0 })),
        roundTables: roundTables.map((rt) => ({
          ...rt.toJSON(),
          revealedRole: rt.banishedPlayerId && !viewer.hiddenRoles.includes(rt.banishedPlayerId) ? roleById.get(rt.banishedPlayerId) ?? null : null,
        })),
        traitorsMeeting: visibleMeeting(
          meeting?.toJSON() ?? null,
          day.number === season.currentDay && season.currentPhase === GamePhase.TRAITORS_MEETING,
          viewer,
        ),
        events: phrased(visibleEvents(events.map((e) => e.toJSON()), viewer)),
      });
    }

    return {
      season: season.toJSON(),
      prizePot: await this.repos.prizes.getPrizePot(season.id),
      players: players.map((p) => maskPlayer(p.toJSON(), viewer)),
      prizeTransactions: transactions.map((t) => t.toJSON()),
      winners: (await this.repos.winners.findBySeason(season.id)).map((w) => w.toJSON()),
      days: history,
    };
  }
}
