import { randomUUID } from 'node:crypto';
import { MurderOutcome, RecruitmentOutcome } from '../enums';
import { DomainError } from '../errors/DomainError';

export interface MurderProps {
  id: string;
  targetId: string;
  outcome: MurderOutcome;
}

export interface RecruitmentProps {
  id: string;
  targetId: string;
  isUltimatum: boolean;
  outcome: RecruitmentOutcome;
}

export interface TraitorMeetingProps {
  id: string;
  dayId: string;
  murder: MurderProps | null;
  recruitments: RecruitmentProps[];
  notes: string | null;
  createdAt: Date;
}

/** Reunião noturna dos traidores. */
export class TraitorMeeting {
  constructor(private readonly props: TraitorMeetingProps) {}

  static create(input: { dayId: string; notes?: string | null }): TraitorMeeting {
    return new TraitorMeeting({
      id: randomUUID(),
      dayId: input.dayId,
      murder: null,
      recruitments: [],
      notes: input.notes ?? null,
      createdAt: new Date(),
    });
  }

  get id(): string { return this.props.id; }
  get dayId(): string { return this.props.dayId; }
  get notes(): string | null { return this.props.notes; }
  get murder(): MurderProps | null { return this.props.murder; }
  get recruitments(): readonly RecruitmentProps[] { return this.props.recruitments; }

  /** Se o alvo tem escudo, o assassinato é bloqueado. */
  murderPlayer(targetId: string, targetIsShielded: boolean): MurderProps {
    if (this.props.murder) throw new DomainError('Os traidores só podem assassinar uma pessoa por noite');
    this.props.murder = {
      id: randomUUID(),
      targetId,
      outcome: targetIsShielded ? MurderOutcome.BLOCKED_BY_SHIELD : MurderOutcome.SUCCESS,
    };
    return this.props.murder;
  }

  /** Ultimato recusado conta como o assassinato da noite. */
  recruitPlayer(targetId: string, accepted: boolean, isUltimatum = false): RecruitmentProps {
    if (this.props.recruitments.some((r) => r.targetId === targetId)) {
      throw new DomainError('Este jogador já recebeu proposta de recrutamento nesta reunião');
    }
    const recruitment: RecruitmentProps = {
      id: randomUUID(),
      targetId,
      isUltimatum,
      outcome: accepted ? RecruitmentOutcome.ACCEPTED : RecruitmentOutcome.DECLINED,
    };
    if (!accepted && isUltimatum) this.murderPlayer(targetId, false);
    this.props.recruitments.push(recruitment);
    return recruitment;
  }

  toJSON(): TraitorMeetingProps {
    return { ...this.props, recruitments: [...this.props.recruitments] };
  }
}
