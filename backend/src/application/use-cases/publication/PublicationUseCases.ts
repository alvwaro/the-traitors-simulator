import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { CopyPublicationInput, CopyPublicationOutput, ListPublicationsInput, PublicationActionInput, PublicationOutput } from '../../dtos/PublicationDTOs';
import { ForbiddenError } from '../../../shared/errors/AppError';
import { requirePublication } from '../../services/libraryGuards';
import { requireSeason } from '../../services/gameGuards';
import { toPublicationOutputs } from '../../services/publicationOutput';
import { importCast, importCharacters } from '../../services/importSnapshot';
import { seasonSnapshot } from '../../services/publishedSnapshot';
import { toCastOutput } from '../../services/castOutput';

/** Vitrines públicas (não precisa estar logado para ver). */
export class ListPublicationsUseCase implements IUseCase<ListPublicationsInput, PublicationOutput[]> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: ListPublicationsInput): Promise<PublicationOutput[]> {
    return toPublicationOutputs(this.repos, await this.repos.publications.findAll(input));
  }
}

/** Tira da vitrine. Quem já copiou continua com a cópia; a temporada volta a ser só de quem criou. */
export class UnpublishUseCase implements IUseCase<PublicationActionInput, void> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: PublicationActionInput): Promise<void> {
    return this.uow.run(async (repos) => {
      const publication = await requirePublication(repos, input.publicationId);
      if (!publication.canBeRemovedBy(input.actor)) throw new ForbiddenError('Só quem publicou (ou um dono do site) pode tirar da vitrine');
      await repos.publications.delete(publication.id);
    });
  }
}

/**
 * Copia para a Minha Área de quem está logado:
 *  - cast: vira um cast com o mesmo elenco e relacionamentos;
 *  - temporada: o elenco atual dela vira um cast, pronto para jogar a própria versão;
 *  - personagem: entra na biblioteca de personagens.
 */
export class CopyPublicationUseCase implements IUseCase<CopyPublicationInput, CopyPublicationOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CopyPublicationInput): Promise<CopyPublicationOutput> {
    return this.uow.run(async (repos) => {
      const publication = await requirePublication(repos, input.publicationId);
      const props = publication.toJSON();
      const ownerId = input.actor.id;

      if (props.kind === 'CHARACTER') {
        const [character] = [...(await importCharacters(repos, ownerId, props.snapshot!)).values()];
        return { kind: props.kind, cast: null, character: character.toJSON() };
      }

      const season = props.seasonId ? await requireSeason(repos, props.seasonId) : null;
      const snapshot = season ? await seasonSnapshot(repos, season) : props.snapshot!;
      const cast = await importCast(repos, ownerId, snapshot, {
        name: input.name ?? season?.name ?? props.name,
        description: props.description,
        imageUrl: props.imageUrl,
      });
      return { kind: props.kind, cast: await toCastOutput(repos, cast), character: null };
    });
  }
}
