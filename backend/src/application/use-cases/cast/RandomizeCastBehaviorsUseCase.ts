import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { CastIdInput, CastOutput } from '../../dtos/LibraryDTOs';
import { Behavior } from '../../../domain/entities';
import { DomainError } from '../../../domain/errors/DomainError';
import { toCastOutput } from '../../services/castOutput';
import { requireCast } from '../../services/libraryGuards';
import { gameRng } from '../../../domain/simulation';

/** Dois comportamentos se contradizem quando puxam o mesmo atributo com força para lados opostos (ex.: Tímido e Carismático). */
export function behaviorsConflict(a: Behavior, b: Behavior): boolean {
  return Object.entries(a.effects).some(([key, value]) => {
    const other = b.effects[key as keyof typeof b.effects];
    return other !== undefined && Math.sign(other) !== Math.sign(value) && Math.abs(other) + Math.abs(value) >= 40;
  });
}

/** Sorteia de 1 a 3 comportamentos que combinam entre si. */
export function drawBehaviors(rng: () => number, all: readonly Behavior[]): string[] {
  const roll = rng();
  let count = 3;
  if (roll < 0.3) count = 1;
  else if (roll < 0.75) count = 2;
  const pool = [...all].sort(() => rng() - 0.5);
  const chosen: Behavior[] = [];
  for (const behavior of pool) {
    if (chosen.length >= count) break;
    if (chosen.some((c) => behaviorsConflict(c, behavior))) continue;
    chosen.push(behavior);
  }
  return chosen.map((b) => b.id);
}

/** Sorteia novos comportamentos para todos os personagens do cast (substitui os atuais). */
export class RandomizeCastBehaviorsUseCase implements IUseCase<CastIdInput, CastOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CastIdInput): Promise<CastOutput> {
    return this.uow.run(async (repos) => {
      const cast = await requireCast(repos, input.castId);
      const behaviors = await repos.behaviors.findAll();
      if (!behaviors.length) throw new DomainError('Cadastre algum comportamento antes de sortear');
      for (const character of await repos.characters.findByIds(cast.characterIds)) {
        character.setBehaviors(drawBehaviors(gameRng, behaviors));
        await repos.characters.update(character);
      }
      return toCastOutput(repos, cast);
    });
  }
}
