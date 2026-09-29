import { Player, Season, SimulationEvent } from '../../domain/entities';
import { GamePhase } from '../../domain/enums';
import {
  gameRng,
  computeStandings,
  fillMissingRelationships,
  NarratedEvent,
  RelationshipMatrix,
  Rng,
  seededRng,
  SimPlayer,
  traitsOf,
} from '../../domain/simulation';
import { RelationshipsOutput } from '../dtos/GameDTOs';
import { Repositories } from '../ports/IUnitOfWork';

export interface SimulationState {
  players: Player[];
  /** Todos os jogadores da temporada com o perfil calculado pelas tags. */
  sim: SimPlayer[];
  matrix: RelationshipMatrix;
}

/** Carrega jogadores, comportamentos e relacionamentos da temporada. */
export async function loadSimulationState(repos: Repositories, seasonId: string): Promise<SimulationState> {
  const players = await repos.players.findBySeason(seasonId);
  const behaviors = await repos.behaviors.findByIds([...new Set(players.flatMap((p) => p.behaviorIds))]);
  const effects = new Map(behaviors.map((b) => [b.id, b.effects]));
  const sim = players.map<SimPlayer>((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    behaviorIds: [...p.behaviorIds],
    traits: traitsOf(p.behaviorIds.flatMap((id) => effects.get(id) ?? [])),
  }));
  const matrix = new RelationshipMatrix(await repos.relationships.findBySeason(seasonId));
  return { players, sim, matrix };
}

export function activeSim(state: SimulationState): SimPlayer[] {
  const active = new Set(state.players.filter((p) => p.isActive()).map((p) => p.id));
  return state.sim.filter((p) => active.has(p.id));
}

/**
 * Cria o que falta entre os jogadores ativos: primeiro o que foi definido no cast de origem
 * (entre personagens), depois a primeira impressão sorteada pelos comportamentos (com a loucura da temporada).
 */
export async function ensureRelationships(repos: Repositories, seasonId: string, rng: Rng = gameRng): Promise<SimulationState> {
  const state = await loadSimulationState(repos, seasonId);
  const season = await repos.seasons.findById(seasonId);
  const active = activeSim(state);

  if (season?.castId) {
    const byCharacter = new Map(state.players.filter((p) => p.isActive() && p.characterId).map((p) => [p.characterId!, p.id]));
    for (const r of await repos.casts.findRelationships(season.castId)) {
      const from = byCharacter.get(r.fromId);
      const to = byCharacter.get(r.toId);
      if (from && to && !state.matrix.has(from, to)) state.matrix.set(from, to, r);
    }
  }
  fillMissingRelationships(state.matrix, active, rng, (season?.chaos ?? 0) / 100);
  const changed = state.matrix.changed();
  if (changed.length) await repos.relationships.saveMany(seasonId, changed);
  return state;
}

/** Relacionamentos + como o castelo enxerga cada jogador ativo (confiança, chance de banimento...). */
export async function buildRelationshipsOutput(repos: Repositories, season: Season): Promise<RelationshipsOutput> {
  const state = await loadSimulationState(repos, season.id);
  const active = activeSim(state);
  // Semente fixa por fase: recarregar a página não muda as chances.
  const rng = seededRng(`${season.id}:${season.currentDay ?? 0}:${season.currentPhase ?? 'SETUP'}`);
  const ids = new Set(state.players.map((p) => p.id));
  return {
    relationships: state.matrix.entries().filter((r) => ids.has(r.fromId) && ids.has(r.toId)),
    standings: computeStandings(rng, state.matrix, active, season.chaos / 100),
  };
}

/** Acrescenta a narrativa depois do que já foi contado neste momento do dia (a sequência continua de onde parou). */
export async function appendPhaseEvents(
  repos: Repositories,
  moment: { seasonId: string; dayId: string; phase: GamePhase },
  events: readonly NarratedEvent[],
): Promise<void> {
  const told = (await repos.simulationEvents.findByDay(moment.dayId)).filter((e) => e.phase === moment.phase).length;
  await repos.simulationEvents.createMany(events.map((e, i) => SimulationEvent.create({ ...moment, sequence: told + i + 1, ...e })));
}

/** Formata dinheiro na moeda da temporada, para a narração. */
export function moneyFormatter(currency: string): (amount: number) => string {
  try {
    const format = new Intl.NumberFormat('pt-BR', { style: 'currency', currency, maximumFractionDigits: 0 });
    return (amount) => format.format(amount);
  } catch {
    return (amount) => `${currency} ${amount.toLocaleString('pt-BR')}`;
  }
}
