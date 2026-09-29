import { Day, Season } from '../../domain/entities';
import { GamePhase } from '../../domain/enums';
import { DomainError } from '../../domain/errors/DomainError';
import { AllianceBook, HumanMemory, NarratedEvent, SimPlayer, SimulationFlags } from '../../domain/simulation';
import { GameStateOutput, PlayerView } from '../dtos/GameDTOs';
import { Repositories } from '../ports/IUnitOfWork';
import { loadActiveGame } from './gameGuards';
import { readGameState } from './gameState';
import { buildPlayerView } from './playerView';
import { activeSim, appendPhaseEvents, ensureRelationships, SimulationState } from './simulation';

/** A vez do jogador humano (modo Jogador): o momento do jogo e o que ele pode fazer agora. */
export interface HumanTurn {
  season: Season;
  day: Day;
  phase: GamePhase;
  state: SimulationState;
  view: PlayerView;
  /** Quem está no castelo, com o perfil da simulação. */
  active: SimPlayer[];
  human: SimPlayer;
  /** Cópias da memória da simulação: só são gravadas em saveHumanTurn. */
  flags: SimulationFlags;
  memory: HumanMemory;
  alliances: AllianceBook;
}

/** Carrega a vez do jogador. Só existe no modo Jogador e enquanto ele ainda está no jogo. */
export async function loadHumanTurn(repos: Repositories, seasonId: string, notPlayerMode: string): Promise<HumanTurn> {
  const { season, day, phase } = await loadActiveGame(repos, seasonId);
  if (!season.isPlayerMode()) throw new DomainError(notPlayerMode);

  const state = await ensureRelationships(repos, season.id);
  const view = await buildPlayerView(repos, season, state.players, day);
  if (!view?.isActive) throw new DomainError('Você não está mais no jogo');

  const active = activeSim(state);
  const human = active.find((p) => p.id === view.playerId)!;
  const flags = { ...(season.simState as SimulationFlags) };
  const memory: HumanMemory = { ...(flags.human ?? {}) };
  const alliances = new AllianceBook(state.matrix, flags, active.map((p) => p.id));
  return { season, day, phase, state, view, active, human, flags, memory, alliances };
}

/** Grava o que a ação do jogador mudou (sentimentos, memória e a narrativa do momento) e devolve a tela atualizada. */
export async function saveHumanTurn(repos: Repositories, turn: HumanTurn, events: readonly NarratedEvent[]): Promise<GameStateOutput> {
  const { season, day, phase, state, flags, memory } = turn;
  await repos.relationships.saveMany(season.id, state.matrix.changed());
  season.recordSimState({ ...flags, human: memory });
  await repos.seasons.update(season);
  await appendPhaseEvents(repos, { seasonId: season.id, dayId: day.id, phase }, events);
  return readGameState(repos, season.id);
}
