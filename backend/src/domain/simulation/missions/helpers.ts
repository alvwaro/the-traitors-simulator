import { SimPlayer } from '../traits';
import { MissionDefinition } from './MissionContext';

/** Os `n` melhores pela pontuação (calculada uma vez por item, mesmo que use sorteio). */
export function top<T>(items: readonly T[], score: (item: T) => number, n: number): T[] {
  const scored = items.map((item) => ({ item, score: score(item) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.item);
}

export const byInfluence = (players: readonly SimPlayer[]): SimPlayer => top(players, (p) => p.traits.influence, 1)[0];


/** Mesma pessoa em dois marcadores ({user} e {user1}) quando o roteiro cita alguém duas vezes. */
export const pair = (a: SimPlayer, b: SimPlayer): SimPlayer[] => [a, b];

/** Arredonda um valor em dinheiro para o passo usado pelo programa (500 nos EUA, 50 no Reino Unido). */
export function roundMoney(amount: number, step = 50): number {
  return Math.round(amount / step) * step;
}

/**
 * A mesma missão em outra versão do programa: mesmas regras, outro valor em jogo.
 * O dinheiro ganho é proporcional ao da versão original.
 */
export function variant(
  base: MissionDefinition,
  over: { origin: string; prizeAvailable: number; name?: string; description?: string; step?: number },
): MissionDefinition {
  const ratio = over.prizeAvailable / base.prizeAvailable;
  return {
    ...base,
    ...over,
    play(ctx) {
      const outcome = base.play(ctx);
      return { ...outcome, prizeEarned: Math.min(over.prizeAvailable, roundMoney(outcome.prizeEarned * ratio, over.step ?? 50)) };
    },
  };
}
