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
import { IJobQueue } from './IJobQueue';

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
  /** Fila de trabalhos: enfileirar dentro da transação só publica o trabalho se tudo der certo. */
  jobs: IJobQueue;
}

/**
 * Executa o trabalho numa transação: tudo que uma fase grava
 * (ex.: mesa redonda + banimento) é atômico.
 */
export interface IUnitOfWork {
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
