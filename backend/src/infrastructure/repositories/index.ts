import { Repositories } from '../../application/ports/IUnitOfWork';
import { Queryable } from '../database/connection';
import { PgSeasonRepository } from './PgSeasonRepository';
import { PgPlayerRepository } from './PgPlayerRepository';
import { PgDayRepository } from './PgDayRepository';
import { PgMissionRepository } from './PgMissionRepository';
import { PgPrizeRepository } from './PgPrizeRepository';
import { PgRoundTableRepository } from './PgRoundTableRepository';
import { PgTraitorMeetingRepository } from './PgTraitorMeetingRepository';
import { PgSeasonWinnerRepository } from './PgSeasonWinnerRepository';
import { PgCharacterRepository } from './PgCharacterRepository';
import { PgCastRepository } from './PgCastRepository';
import { PgPhraseRepository } from './PgPhraseRepository';
import { PgBehaviorRepository } from './PgBehaviorRepository';
import { PgRelationshipRepository } from './PgRelationshipRepository';
import { PgSimulationEventRepository } from './PgSimulationEventRepository';
import { PgStatsRepository } from './PgStatsRepository';
import { PgPublicationRepository } from './PgPublicationRepository';
import { PgSessionRepository, PgUserRepository } from './PgUserRepository';
import { PgAccessRepository } from './PgAccessRepository';
import { PgSeasonSnapshotRepository } from './PgSeasonSnapshotRepository';
import { PgJobQueue } from '../queue/PgJobQueue';

export function createRepositories(db: Queryable): Repositories {
  return {
    seasons: new PgSeasonRepository(db),
    players: new PgPlayerRepository(db),
    days: new PgDayRepository(db),
    missions: new PgMissionRepository(db),
    prizes: new PgPrizeRepository(db),
    roundTables: new PgRoundTableRepository(db),
    traitorMeetings: new PgTraitorMeetingRepository(db),
    winners: new PgSeasonWinnerRepository(db),
    characters: new PgCharacterRepository(db),
    casts: new PgCastRepository(db),
    phrases: new PgPhraseRepository(db),
    behaviors: new PgBehaviorRepository(db),
    relationships: new PgRelationshipRepository(db),
    simulationEvents: new PgSimulationEventRepository(db),
    stats: new PgStatsRepository(db),
    publications: new PgPublicationRepository(db),
    users: new PgUserRepository(db),
    sessions: new PgSessionRepository(db),
    access: new PgAccessRepository(db),
    snapshots: new PgSeasonSnapshotRepository(db),
    jobs: new PgJobQueue(db),
  };
}
