import { TraitorMeeting } from '../entities';

export interface ITraitorMeetingRepository {
  findByDay(dayId: string): Promise<TraitorMeeting | null>;
  findBySeason(seasonId: string): Promise<TraitorMeeting[]>;
  /** Persiste a reunião com assassinato e recrutamentos. */
  create(meeting: TraitorMeeting): Promise<void>;
}
