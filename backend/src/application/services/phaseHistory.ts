import { Day, DayPhase } from '../../domain/entities';
import { GamePhase } from '../../domain/enums';
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

/** Onde uma fase está no histórico (-1 se ainda não foi aberta). */
export function indexOfPhase(history: readonly PhaseRecord[], dayNumber: number, phase: GamePhase): number {
  return history.findIndex((h) => h.day.number === dayNumber && h.phase.phase === phase);
}

/** Marca o fim da fase atual do dia (se ela foi aberta). */
export async function closePhase(repos: Repositories, dayId: string, phase: GamePhase): Promise<void> {
  const current = await repos.days.findPhase(dayId, phase);
  if (!current) return;
  current.end();
  await repos.days.savePhase(current);
}
