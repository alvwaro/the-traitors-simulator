import { CharacterStats } from '@traitors/shared';

/** Desempenho de um personagem somando todas as temporadas iniciadas em que jogou (o contrato é o mesmo do site). */
export type { CharacterStats } from '@traitors/shared';

export interface IStatsRepository {
  characterStats(characterIds: readonly string[]): Promise<CharacterStats[]>;
}
