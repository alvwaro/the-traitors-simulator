import {
  ICastRepository,
  ICharacterRepository,
  IDayRepository,
  IMissionRepository,
  IPhraseRepository,
  IBehaviorRepository,
  IRelationshipRepository,
  ISimulationEventRepository,
  IStatsRepository,
  IPlayerRepository,
  IPrizeRepository,
  IRoundTableRepository,
  ISeasonRepository,
  ISeasonWinnerRepository,
  ITraitorMeetingRepository,
  IPublicationRepository,
  IUserRepository,
  ISessionRepository,
  IAccessRepository,
  ISeasonSnapshotRepository,
} from '../../domain/repositories';

export interface Repositories {
  seasons: ISeasonRepository;
  players: IPlayerRepository;
  days: IDayRepository;
  missions: IMissionRepository;
  prizes: IPrizeRepository;
  roundTables: IRoundTableRepository;
  traitorMeetings: ITraitorMeetingRepository;
  winners: ISeasonWinnerRepository;
  characters: ICharacterRepository;
  casts: ICastRepository;
  phrases: IPhraseRepository;
  behaviors: IBehaviorRepository;
  relationships: IRelationshipRepository;
  simulationEvents: ISimulationEventRepository;
  stats: IStatsRepository;
  publications: IPublicationRepository;
  users: IUserRepository;
  sessions: ISessionRepository;
  access: IAccessRepository;
  snapshots: ISeasonSnapshotRepository;
}

/**
 * Executa o trabalho numa transação: tudo que uma fase grava
 * (ex.: mesa redonda + banimento) é atômico.
 */
export interface IUnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
