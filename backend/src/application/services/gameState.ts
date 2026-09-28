import { MIN_PLAYERS_TO_START } from '../../domain/rules';
import { Season } from '../../domain/entities';
import { GamePhase, PlayerStatus } from '../../domain/enums';
import { GameStateOutput } from '../dtos/GameDTOs';
import { Repositories } from '../ports/IUnitOfWork';
import { requireSeason } from './gameGuards';
import { pendingRequirement } from './phaseRequirements';
import { buildPlayerView, maskPlayer, viewerOf } from './playerView';

/** Monta a "foto" atual da temporada que o front usa para renderizar a tela. */
export async function readGameState(repos: Repositories, seasonId: string): Promise<GameStateOutput> {
  const season = await requireSeason(repos, seasonId);
  const players = await repos.players.findBySeason(season.id);
  const prizePot = await repos.prizes.getPrizePot(season.id);
  const winners = await repos.winners.findBySeason(season.id);

  let pending: string | null = null;
  const day = season.currentDay !== null ? await repos.days.findBySeasonAndNumber(season.id, season.currentDay) : null;
  if (season.isInSetup()) {
    pending = players.length < MIN_PLAYERS_TO_START ? `Adicione ao menos ${MIN_PLAYERS_TO_START} jogadores` : null;
  } else if (season.isInProgress() && season.currentDay !== null && season.currentPhase !== null) {
    if (day) pending = await pendingRequirement(repos, season, day, season.currentPhase);
  }

  const viewer = viewerOf(season, players, day?.id ?? null);
  const shown = players.map((p) => maskPlayer(p.toJSON(), viewer));
  const seasonJson = season.toJSON();
  return {
    // A memória da simulação pode revelar reviravoltas (ex.: veneno armado); o participante não vê.
    season: viewer.hide ? { ...seasonJson, simState: {} } : seasonJson,
    day: season.currentDay,
    phase: season.currentPhase,
    pendingRequirement: pending,
    phaseSimulated: !!day && !!season.currentPhase && (await repos.simulationEvents.existsFor(day.id, season.currentPhase)),
    prizePot,
    activePlayers: shown.filter((p) => p.status === PlayerStatus.ACTIVE),
    eliminatedPlayers: shown.filter((p) => p.status !== PlayerStatus.ACTIVE),
    winners: winners.map((w) => w.toJSON()),
    player: await buildPlayerView(repos, season, players, day),
    canGoBack: await canGoBack(repos, season),
  };
}

/** Temporada manual: dá para desfazer um registro guardado ou, sem nenhum, voltar para a fase anterior. */
async function canGoBack(repos: Repositories, season: Season): Promise<boolean> {
  if (season.isAutomatic() || season.isInSetup()) return false;
  if ((await repos.snapshots.count(season.id)) > 0) return true;
  return season.isInProgress() && !(season.currentDay === 1 && season.currentPhase === GamePhase.ARRIVAL);
}
