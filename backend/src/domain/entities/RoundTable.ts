import { randomUUID } from 'node:crypto';
import { EndgameChoice, RoundTableKind } from '../enums';
import { DomainError } from '../errors/DomainError';

export interface RoundTableVoteProps {
  id: string;
  round: number;
  voterId: string;
  targetId: string;
}

export interface EndgameVoteProps {
  id: string;
  voterId: string;
  choice: EndgameChoice;
}

export interface RoundTableProps {
  id: string;
  dayId: string;
  kind: RoundTableKind;
  sequence: number;
  banishedPlayerId: string | null;
  votes: RoundTableVoteProps[];
  endgameVotes: EndgameVoteProps[];
  notes: string | null;
  createdAt: Date;
}

/** Mesa redonda: votos de banimento (e, na final, votos de encerrar/banir de novo). */
export class RoundTable {
  constructor(private readonly props: RoundTableProps) {}

  static create(input: { dayId: string; kind: RoundTableKind; sequence: number; notes?: string | null }): RoundTable {
    return new RoundTable({
      id: randomUUID(),
      dayId: input.dayId,
      kind: input.kind,
      sequence: input.sequence,
      banishedPlayerId: null,
      votes: [],
      endgameVotes: [],
      notes: input.notes ?? null,
      createdAt: new Date(),
    });
  }

  get id(): string { return this.props.id; }
  get dayId(): string { return this.props.dayId; }
  get kind(): RoundTableKind { return this.props.kind; }
  get sequence(): number { return this.props.sequence; }
  get notes(): string | null { return this.props.notes; }
  get banishedPlayerId(): string | null { return this.props.banishedPlayerId; }
  get votes(): readonly RoundTableVoteProps[] { return this.props.votes; }
  get endgameVotes(): readonly EndgameVoteProps[] { return this.props.endgameVotes; }

  castVote(voterId: string, targetId: string, round = 1): void {
    if (round < 1) throw new DomainError('Rodada de votação inválida');
    if (voterId === targetId) throw new DomainError('Um jogador não pode votar em si mesmo');
    if (this.props.votes.some((v) => v.voterId === voterId && v.round === round)) {
      throw new DomainError('Jogador votou mais de uma vez na mesma rodada');
    }
    this.props.votes.push({ id: randomUUID(), round, voterId, targetId });
  }

  castEndgameVote(voterId: string, choice: EndgameChoice): void {
    if (this.kind !== RoundTableKind.ENDGAME) throw new DomainError('Votos de encerramento só existem na mesa final');
    if (this.props.endgameVotes.some((v) => v.voterId === voterId)) {
      throw new DomainError('Jogador votou mais de uma vez no encerramento');
    }
    this.props.endgameVotes.push({ id: randomUUID(), voterId, choice });
  }

  banish(playerId: string): void {
    if (this.props.banishedPlayerId) throw new DomainError('Esta mesa redonda já baniu alguém');
    this.props.banishedPlayerId = playerId;
  }

  /** A final termina quando todos votam END_GAME. */
  isEndgameUnanimous(): boolean {
    return this.props.endgameVotes.length > 0 && this.props.endgameVotes.every((v) => v.choice === EndgameChoice.END_GAME);
  }

  toJSON(): RoundTableProps {
    return { ...this.props, votes: [...this.props.votes], endgameVotes: [...this.props.endgameVotes] };
  }
}

/** Só as rodadas da mesa final (na ordem em que aconteceram). */
export function endgameRounds(tables: readonly RoundTable[]): RoundTable[] {
  return tables.filter((t) => t.kind === RoundTableKind.ENDGAME);
}

/** A mesa final do dia já terminou: a última rodada foi unânime por encerrar o jogo. */
export function isEndgameDecided(tables: readonly RoundTable[]): boolean {
  return !!endgameRounds(tables).at(-1)?.isEndgameUnanimous();
}
