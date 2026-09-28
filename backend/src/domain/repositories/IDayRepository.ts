import { Day, DayPhase } from '../entities';
import { GamePhase } from '../enums';

export interface IDayRepository {
  findById(id: string): Promise<Day | null>;
  findBySeasonAndNumber(seasonId: string, number: number): Promise<Day | null>;
  findBySeason(seasonId: string): Promise<Day[]>;
  create(day: Day): Promise<void>;

  findPhase(dayId: string, phase: GamePhase): Promise<DayPhase | null>;
  findPhases(dayId: string): Promise<DayPhase[]>;
  savePhase(phase: DayPhase): Promise<void>; // insert ou update
}
