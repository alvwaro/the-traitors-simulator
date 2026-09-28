import { SeasonWinner } from '../entities';

export interface ISeasonWinnerRepository {
  findBySeason(seasonId: string): Promise<SeasonWinner[]>;
  saveAll(winners: SeasonWinner[]): Promise<void>;
}
