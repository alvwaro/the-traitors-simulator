export interface SeasonWinnerProps {
  seasonId: string;
  playerId: string;
  prizeShare: number;
}

export class SeasonWinner {
  constructor(private readonly props: SeasonWinnerProps) {}

  get playerId(): string { return this.props.playerId; }
  get prizeShare(): number { return this.props.prizeShare; }

  toJSON(): SeasonWinnerProps { return { ...this.props }; }
}
