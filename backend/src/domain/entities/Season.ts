import { randomUUID } from 'node:crypto';
import { GamePhase, SeasonMode, SeasonStatus } from '../enums';
import { DomainError } from '../errors/DomainError';

/** De qual temporada do programa (país + número) vêm as missões e reviravoltas simuladas (MIX = todas, embaralhadas). */
export const MISSION_POOLS = ['US_S1', 'UK_S1', 'US_S2', 'UK_S2', 'US_S3', 'UK_S3', 'MIX'] as const;
export type MissionPool = (typeof MISSION_POOLS)[number];

/** Temporadas criadas antes da separação EUA/Reino Unido guardavam só o número (S1, S2, S3). */
export function normalizeMissionPool(value: string): MissionPool {
  if (value === 'S1' || value === 'S2' || value === 'S3') return `US_${value}`;
  return (MISSION_POOLS as readonly string[]).includes(value) ? (value as MissionPool) : 'US_S3';
}

export interface SimulationSettings {
  /** Loucura, de 0 a 100: chance de cada decisão fugir do comportamento esperado. */
  chaos?: number;
  missionPool?: MissionPool;
  /** Modo Jogador: quantas conversas o usuário pode ter em cada momento. */
  interactionLimit?: number;
}

export interface SeasonProps {
  id: string;
  name: string;
  castId: string | null;
  mode: SeasonMode;
  chaos: number;
  missionPool: MissionPool;
  interactionLimit: number;
  /** Memória da simulação automática entre fases (reviravoltas já usadas etc.). */
  simState: Record<string, unknown>;
  status: SeasonStatus;
  currentDay: number | null;
  currentPhase: GamePhase | null;
  currency: string;
  initialPrizePot: number;
  maxPrizePot: number | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  /** Quem criou a temporada (Minha Área). Null só em registros anteriores às contas. */
  ownerId: string | null;
}

export interface PrizeSettings {
  currency?: string;
  initialPrizePot?: number;
  maxPrizePot?: number | null;
}

/** Aggregate root: guarda o "ponteiro" de onde a simulação está (dia + fase). */
export class Season {
  constructor(private readonly props: SeasonProps) {}

  static create(input: { name: string; ownerId: string; castId?: string | null; mode?: SeasonMode } & PrizeSettings & SimulationSettings): Season {
    const season = new Season({
      id: randomUUID(),
      name: '',
      castId: input.castId ?? null,
      mode: input.mode ?? SeasonMode.MANUAL,
      chaos: 0,
      missionPool: 'US_S3',
      interactionLimit: 3,
      simState: {},
      status: SeasonStatus.SETUP,
      currentDay: null,
      currentPhase: null,
      currency: 'BRL',
      initialPrizePot: 0,
      maxPrizePot: null,
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
      ownerId: input.ownerId,
    });
    season.rename(input.name);
    season.configurePrize(input);
    season.configureSimulation(input);
    return season;
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get castId(): string | null { return this.props.castId; }
  get ownerId(): string | null { return this.props.ownerId; }
  get mode(): SeasonMode { return this.props.mode; }
  get chaos(): number { return this.props.chaos; }
  get missionPool(): MissionPool { return this.props.missionPool; }
  get interactionLimit(): number { return this.props.interactionLimit; }
  get simState(): Record<string, unknown> { return this.props.simState; }
  get status(): SeasonStatus { return this.props.status; }
  get currentDay(): number | null { return this.props.currentDay; }
  get currentPhase(): GamePhase | null { return this.props.currentPhase; }
  get currency(): string { return this.props.currency; }
  get initialPrizePot(): number { return this.props.initialPrizePot; }
  get maxPrizePot(): number | null { return this.props.maxPrizePot; }

  /** A simulação decide as fases (automática ou com o usuário jogando). */
  isAutomatic(): boolean { return this.props.mode !== SeasonMode.MANUAL; }
  isPlayerMode(): boolean { return this.props.mode === SeasonMode.PLAYER; }
  isInSetup(): boolean { return this.props.status === SeasonStatus.SETUP; }
  isEndgame(): boolean { return this.props.status === SeasonStatus.ENDGAME; }
  isFinished(): boolean { return this.props.status === SeasonStatus.FINISHED; }
  isInProgress(): boolean {
    return this.props.status === SeasonStatus.IN_PROGRESS || this.props.status === SeasonStatus.ENDGAME;
  }

  rename(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new DomainError('O nome da temporada é obrigatório');
    this.props.name = trimmed;
  }

  /** O modo (manual ou automático) só pode mudar antes do início. */
  changeMode(mode: SeasonMode): void {
    if (mode === this.props.mode) return;
    if (!this.isInSetup()) throw new DomainError('O modo da temporada só pode mudar antes do início');
    this.props.mode = mode;
  }

  /** Loucura e missões: só antes do início. */
  configureSimulation(settings: SimulationSettings): void {
    const changing =
      (settings.chaos !== undefined && settings.chaos !== this.props.chaos) ||
      (settings.missionPool !== undefined && settings.missionPool !== this.props.missionPool) ||
      (settings.interactionLimit !== undefined && settings.interactionLimit !== this.props.interactionLimit);
    if (!changing) return;
    if (!this.isInSetup()) throw new DomainError('Loucura e missões só podem mudar antes do início');
    if (settings.chaos !== undefined) {
      if (!Number.isInteger(settings.chaos) || settings.chaos < 0 || settings.chaos > 100) {
        throw new DomainError('A loucura vai de 0% a 100%');
      }
      this.props.chaos = settings.chaos;
    }
    if (settings.interactionLimit !== undefined) {
      if (!Number.isInteger(settings.interactionLimit) || settings.interactionLimit < 0 || settings.interactionLimit > 20) {
        throw new DomainError('O limite de conversas vai de 0 a 20 por momento');
      }
      this.props.interactionLimit = settings.interactionLimit;
    }
    if (settings.missionPool !== undefined) {
      if (!MISSION_POOLS.includes(settings.missionPool)) throw new DomainError('Conjunto de missões inválido');
      this.props.missionPool = settings.missionPool;
    }
  }

  recordSimState(state: Record<string, unknown>): void {
    this.props.simState = { ...state };
  }

  configurePrize(settings: PrizeSettings): void {
    if (!this.isInSetup()) throw new DomainError('O prêmio só pode ser configurado antes do início da temporada');
    const initial = settings.initialPrizePot ?? this.props.initialPrizePot;
    const max = settings.maxPrizePot !== undefined ? settings.maxPrizePot : this.props.maxPrizePot;
    if (initial < 0) throw new DomainError('O prêmio inicial não pode ser negativo');
    if (max !== null && max < initial) throw new DomainError('O prêmio máximo não pode ser menor que o inicial');
    this.props.currency = (settings.currency ?? this.props.currency).toUpperCase();
    this.props.initialPrizePot = initial;
    this.props.maxPrizePot = max;
  }

  start(day: number, phase: GamePhase): void {
    if (!this.isInSetup()) throw new DomainError('A temporada já foi iniciada');
    this.props.status = SeasonStatus.IN_PROGRESS;
    this.props.currentDay = day;
    this.props.currentPhase = phase;
    this.props.startedAt = new Date();
  }

  moveTo(day: number, phase: GamePhase): void {
    if (!this.isInProgress()) throw new DomainError('A temporada não está em andamento');
    this.props.currentDay = day;
    this.props.currentPhase = phase;
  }

  startEndgame(): void {
    if (this.props.status !== SeasonStatus.IN_PROGRESS) {
      throw new DomainError('A final só pode começar com a temporada em andamento');
    }
    this.props.status = SeasonStatus.ENDGAME;
  }

  finish(): void {
    if (!this.isInProgress()) throw new DomainError('A temporada não está em andamento');
    this.props.status = SeasonStatus.FINISHED;
    this.props.currentPhase = GamePhase.FINALE;
    this.props.finishedAt = new Date();
  }

  toJSON(): SeasonProps { return { ...this.props, simState: { ...this.props.simState } }; }
}
