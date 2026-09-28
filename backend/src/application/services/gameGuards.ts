import { Day, Season } from '../../domain/entities';
import { GamePhase } from '../../domain/enums';
import { DomainError } from '../../domain/errors/DomainError';
import { NotFoundError } from '../../shared/errors/AppError';
import { Repositories } from '../ports/IUnitOfWork';

export async function requireSeason(repos: Repositories, seasonId: string, forUpdate = false): Promise<Season> {
  const season = await repos.seasons.findById(seasonId, { forUpdate });
  if (!season) throw new NotFoundError('Temporada', seasonId);
  return season;
}

export interface ActiveGame {
  season: Season;
  day: Day;
  phase: GamePhase;
}

/**
 * Carrega (e trava) a temporada em andamento com o dia atual.
 * Se `expected` for informado, garante que a fase atual é uma delas.
 */
export async function loadActiveGame(
  repos: Repositories,
  seasonId: string,
  expected?: GamePhase | GamePhase[],
): Promise<ActiveGame> {
  const season = await requireSeason(repos, seasonId, true);
  if (!season.isInProgress() || season.currentDay === null || season.currentPhase === null) {
    throw new DomainError(season.isInSetup() ? 'A temporada ainda não foi iniciada' : 'A temporada já terminou');
  }

  const day = await repos.days.findBySeasonAndNumber(season.id, season.currentDay);
  if (!day) throw new Error(`Inconsistência: dia ${season.currentDay} da temporada ${season.id} não existe`);

  const phase = season.currentPhase;
  if (expected) {
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(phase)) {
      throw new DomainError(`Ação disponível apenas na fase ${allowed.join(' ou ')} (fase atual: ${phase})`);
    }
  }
  return { season, day, phase };
}
