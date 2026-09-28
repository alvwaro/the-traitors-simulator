import { COMMON_EVENTS, EDITIONS } from '../../../domain/simulation';
import { EditionsOutput } from '../../dtos/EditionDTOs';
import { IUseCase } from '../../contracts/IUseCase';

/** Guia das temporadas: missões, valores e reviravoltas de cada versão do programa. */
export class ListEditionsUseCase implements IUseCase<void, EditionsOutput> {
  execute(): Promise<EditionsOutput> {
    const mission = (kind: 'REGULAR' | 'SEER' | 'FINALE') => (m: { key: string; origin: string; name: string; description: string; prizeAvailable: number }) => ({
      key: m.key,
      origin: m.origin,
      name: m.name,
      description: m.description,
      prizeAvailable: m.prizeAvailable,
      kind,
    });
    return Promise.resolve({
      commonEvents: COMMON_EVENTS.map((e) => ({ ...e })),
      editions: EDITIONS.map((e) => ({
        pool: e.pool,
        country: e.country,
        season: e.season,
        label: e.label,
        summary: e.summary,
        currency: e.country === 'UK' ? 'GBP' : 'USD',
        twists: e.twists.map((t) => ({ ...t })),
        missions: [...e.missions.map(mission('REGULAR')), ...(e.seer ? [mission('SEER')(e.seer)] : []), ...e.finale.map(mission('FINALE'))],
      })),
    });
  }
}
