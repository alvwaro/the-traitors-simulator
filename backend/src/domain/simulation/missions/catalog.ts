import { MissionPool } from '../../entities/Season';
import { seededRng, shuffle } from '../random';
import { MissionDefinition } from './MissionContext';
import { SEASON_1_MISSIONS } from './season1';
import { SEASON_2_MISSIONS } from './season2';
import { SEASON_3_MISSIONS } from './season3';

const POOLS: Record<Exclude<MissionPool, 'MIX'>, readonly MissionDefinition[]> = {
  S1: SEASON_1_MISSIONS,
  S2: SEASON_2_MISSIONS,
  S3: SEASON_3_MISSIONS,
};

/**
 * Sequência de missões da temporada. Nas temporadas do programa, a ordem é a da exibição;
 * MIX junta as três e embaralha com a semente da temporada (a ordem não muda entre simulações).
 */
export function missionSequence(pool: MissionPool, seed: string): readonly MissionDefinition[] {
  if (pool !== 'MIX') return POOLS[pool];
  return shuffle(seededRng(seed), [...SEASON_1_MISSIONS, ...SEASON_2_MISSIONS, ...SEASON_3_MISSIONS]);
}

/** Missão de número `index` (0 = primeira da temporada); depois da última, recomeça como "revanche". */
export function missionFor(index: number, pool: MissionPool = 'S3', seed = ''): MissionDefinition {
  const sequence = missionSequence(pool, seed);
  const def = sequence[index % sequence.length];
  const lap = Math.floor(index / sequence.length);
  if (lap === 0) return def;
  const round = lap > 1 ? ` ${lap}` : '';
  return { ...def, name: `${def.name} (revanche${round})` };
}
