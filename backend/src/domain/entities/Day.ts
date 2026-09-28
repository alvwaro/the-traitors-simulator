import { randomUUID } from 'node:crypto';

export interface DayProps {
  id: string;
  seasonId: string;
  number: number;
  title: string | null;
  createdAt: Date;
}

/** Um dia de jogo (equivale a um episódio). */
export class Day {
  constructor(private readonly props: DayProps) {}

  static create(input: { seasonId: string; number: number; title?: string | null }): Day {
    return new Day({ id: randomUUID(), seasonId: input.seasonId, number: input.number, title: input.title ?? null, createdAt: new Date() });
  }

  get id(): string { return this.props.id; }
  get seasonId(): string { return this.props.seasonId; }
  get number(): number { return this.props.number; }

  isFirstDay(): boolean { return this.props.number === 1; }

  toJSON(): DayProps { return { ...this.props }; }
}
