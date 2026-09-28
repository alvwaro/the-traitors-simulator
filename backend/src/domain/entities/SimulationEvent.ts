import { randomUUID } from 'node:crypto';
import { GamePhase, PhraseTone, SimulationEventKind } from '../enums';

export interface SimulationEventProps {
  id: string;
  seasonId: string;
  dayId: string;
  phase: GamePhase;
  sequence: number;
  kind: SimulationEventKind;
  tone: PhraseTone | null;
  /** Texto com marcadores {user}, {user1}...; playerIds na ordem de aparição dos marcadores. */
  text: string;
  playerIds: string[];
  /** Conversa particular: no modo Jogador, só quem está nela (playerIds) vê. */
  isPrivate: boolean;
  createdAt: Date;
}

/** Um acontecimento narrado pela simulação automática (fala, passo da missão, voto...). */
export class SimulationEvent {
  constructor(private readonly props: SimulationEventProps) {}

  static create(input: Omit<SimulationEventProps, 'id' | 'createdAt' | 'isPrivate'> & { isPrivate?: boolean }): SimulationEvent {
    return new SimulationEvent({ ...input, isPrivate: input.isPrivate ?? false, playerIds: [...input.playerIds], id: randomUUID(), createdAt: new Date() });
  }

  get dayId(): string { return this.props.dayId; }
  get phase(): GamePhase { return this.props.phase; }

  toJSON(): SimulationEventProps { return { ...this.props, playerIds: [...this.props.playerIds] }; }
}
