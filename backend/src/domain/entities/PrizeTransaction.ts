import { randomUUID } from 'node:crypto';
import { PrizeTransactionType } from '../enums';
import { DomainError } from '../errors/DomainError';

export interface PrizeTransactionProps {
  id: string;
  seasonId: string;
  dayId: string | null;
  missionId: string | null;
  type: PrizeTransactionType;
  amount: number;
  description: string | null;
  createdAt: Date;
}

export class PrizeTransaction {
  constructor(private readonly props: PrizeTransactionProps) {}

  static create(input: Omit<PrizeTransactionProps, 'id' | 'createdAt'>): PrizeTransaction {
    if (input.amount === 0) throw new DomainError('O valor da transação não pode ser zero');
    if ((input.type === PrizeTransactionType.MISSION) !== (input.missionId !== null)) {
      throw new DomainError('Transações de missão precisam estar ligadas a uma missão');
    }
    return new PrizeTransaction({ ...input, id: randomUUID(), createdAt: new Date() });
  }

  get id(): string { return this.props.id; }
  get missionId(): string | null { return this.props.missionId; }
  get amount(): number { return this.props.amount; }
  get type(): PrizeTransactionType { return this.props.type; }

  toJSON(): PrizeTransactionProps { return { ...this.props }; }
}
