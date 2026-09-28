import { SimulationEvent } from '../entities';
import { GamePhase } from '../enums';

export interface ISimulationEventRepository {
  findByDay(dayId: string): Promise<SimulationEvent[]>;
  existsFor(dayId: string, phase: GamePhase): Promise<boolean>;
  createMany(events: readonly SimulationEvent[]): Promise<void>;
}
