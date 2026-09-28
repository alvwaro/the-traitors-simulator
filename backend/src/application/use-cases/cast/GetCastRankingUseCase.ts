import { IUseCase } from '../../contracts/IUseCase';
import { Repositories } from '../../ports/IUnitOfWork';
import { CastIdInput, CastRankingOutput } from '../../dtos/LibraryDTOs';
import { CharacterStats } from '../../../domain/repositories';
import { requireCast } from '../../services/libraryGuards';

const EMPTY = (characterId: string): CharacterStats => ({
  characterId,
  seasons: 0,
  finished: 0,
  wins: 0,
  winsAsTraitor: 0,
  winsAsFaithful: 0,
  prizeWon: 0,
  timesTraitor: 0,
  timesRecruited: 0,
  banished: 0,
  murdered: 0,
  withdrawn: 0,
  finals: 0,
  votesReceived: 0,
  votesCast: 0,
  votesOnTraitors: 0,
  shields: 0,
  avgDays: 0,
});

/**
 * Pontuação do ranking: vitória vale muito, chegar à final vale bastante,
 * sobreviver, acertar traidores e ganhar escudos somam; ser banido tira pontos.
 */
function score(s: CharacterStats): number {
  return Math.round(
    s.wins * 100 + s.finals * 30 + s.avgDays * 3 + s.votesOnTraitors * 4 + s.shields * 5 + s.timesTraitor * 5 - s.banished * 8 - s.murdered * 3,
  );
}

/** Ranking de desempenho dos personagens do cast em todas as temporadas que jogaram. */
export class GetCastRankingUseCase implements IUseCase<CastIdInput, CastRankingOutput> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: CastIdInput): Promise<CastRankingOutput> {
    const cast = await requireCast(this.repos, input.castId);
    const characters = await this.repos.characters.findByIds(cast.characterIds);
    const stats = new Map((await this.repos.stats.characterStats(cast.characterIds)).map((s) => [s.characterId, s]));

    const rows = characters
      .map((c) => {
        const s = stats.get(c.id) ?? EMPTY(c.id);
        return { character: c.toJSON(), stats: s, score: score(s) };
      })
      .sort((a, b) => b.score - a.score || b.stats.wins - a.stats.wins || a.character.name.localeCompare(b.character.name));

    return { rows: rows.map((r, i) => ({ ...r, position: i + 1 })) };
  }
}
