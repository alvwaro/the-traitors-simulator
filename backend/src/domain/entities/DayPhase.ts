import { randomUUID } from 'node:crypto';
import { GamePhase } from '../enums';

export interface DayPhaseProps {
  id: string;
  dayId: string;
  phase: GamePhase;
  notes: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

/** Registro de uma fase dentro de um dia, com as interações anotadas. */
export class DayPhase {
  constructor(private readonly props: DayPhaseProps) {}

  static start(dayId: string, phase: GamePhase): DayPhase {
    return new DayPhase({ id: randomUUID(), dayId, phase, notes: null, startedAt: new Date(), endedAt: null });
  }

  get id(): string { return this.props.id; }
  get dayId(): string { return this.props.dayId; }
  get phase(): GamePhase { return this.props.phase; }
  get notes(): string | null { return this.props.notes; }

  writeNotes(notes: string | null): void {
    this.props.notes = notes?.trim() || null;
  }

  end(): void {
    this.props.endedAt ??= new Date();
  }

  /** A fase volta a ser a atual (o usuário retornou a ela). */
  reopen(): void {
    this.props.endedAt = null;
  }

  toJSON(): DayPhaseProps { return { ...this.props }; }
}
