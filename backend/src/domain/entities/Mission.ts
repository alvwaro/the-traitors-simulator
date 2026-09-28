import { randomUUID } from 'node:crypto';
import { RewardType } from '../enums';
import { DomainError } from '../errors/DomainError';

export interface MissionRewardProps {
  id: string;
  missionId: string;
  playerId: string;
  rewardType: RewardType;
}

export interface MissionProps {
  id: string;
  dayId: string;
  name: string;
  description: string | null;
  prizeAvailable: number | null;
  rewards: MissionRewardProps[];
  createdAt: Date;
}

/** Desafio do dia. O valor ganho fica em PrizeTransaction (tipo MISSION). */
export class Mission {
  constructor(private readonly props: MissionProps) {}

  static create(input: { dayId: string; name: string; description?: string | null; prizeAvailable?: number | null }): Mission {
    const name = input.name.trim();
    if (!name) throw new DomainError('O nome da missão é obrigatório');
    return new Mission({
      id: randomUUID(),
      dayId: input.dayId,
      name,
      description: input.description ?? null,
      prizeAvailable: input.prizeAvailable ?? null,
      rewards: [],
      createdAt: new Date(),
    });
  }

  get id(): string { return this.props.id; }
  get dayId(): string { return this.props.dayId; }
  get name(): string { return this.props.name; }
  get prizeAvailable(): number | null { return this.props.prizeAvailable; }
  get rewards(): readonly MissionRewardProps[] { return this.props.rewards; }

  grantShield(playerId: string): void {
    const already = this.props.rewards.some((r) => r.playerId === playerId && r.rewardType === RewardType.SHIELD);
    if (already) throw new DomainError('Jogador já recebeu escudo nesta missão');
    this.props.rewards.push({ id: randomUUID(), missionId: this.id, playerId, rewardType: RewardType.SHIELD });
  }

  shieldedPlayerIds(): string[] {
    return this.props.rewards.filter((r) => r.rewardType === RewardType.SHIELD).map((r) => r.playerId);
  }

  toJSON(): MissionProps { return { ...this.props, rewards: [...this.props.rewards] }; }
}
