import { Day, DayPhase } from '../../domain/entities';
import { Repositories } from '../ports/IUnitOfWork';

export interface PhaseRecord {
  day: Day;
  phase: DayPhase;
}

/** Todas as fases já abertas na temporada, em ordem: dia a dia e, dentro do dia, na ordem em que começaram. */
export async function phaseHistory(repos: Repositories, seasonId: string): Promise<PhaseRecord[]> {
  const days = (await repos.days.findBySeason(seasonId)).sort((a, b) => a.number - b.number);
  const history: PhaseRecord[] = [];
  for (const day of days) for (const phase of await repos.days.findPhases(day.id)) history.push({ day, phase });
  return history;
}
