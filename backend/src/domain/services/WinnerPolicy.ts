import { Player, SeasonWinner } from '../entities';

/**
 * Quem leva o prêmio:
 *  - sobrou algum traidor entre os finalistas → traidores dividem tudo;
 *  - só fiéis → fiéis dividem igualmente.
 */
export class WinnerPolicy {
  determine(seasonId: string, finalists: Player[], prizePot: number): SeasonWinner[] {
    const active = finalists.filter((p) => p.isActive());
    const traitors = active.filter((p) => p.isTraitor());
    const winners = traitors.length > 0 ? traitors : active;
    if (winners.length === 0) return [];

    // Divide em centavos; os centavos que sobram vão para os primeiros.
    const totalCents = Math.max(0, Math.round(prizePot * 100));
    const base = Math.floor(totalCents / winners.length);
    const remainder = totalCents % winners.length;

    return winners.map(
      (player, i) => new SeasonWinner({ seasonId, playerId: player.id, prizeShare: (base + (i < remainder ? 1 : 0)) / 100 }),
    );
  }
}
