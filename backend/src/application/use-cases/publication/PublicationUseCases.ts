import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import {
  CopyPublicationInput,
  CopyPublicationOutput,
  CopySeasonInput,
  ListPublicationsInput,
  PublicationActionInput,
  PublicationIdInput,
  PublicationOutput,
} from '../../dtos/PublicationDTOs';
import { SeasonDetailsOutput } from '../../dtos/SeasonDTOs';
import { DomainError } from '../../../domain/errors/DomainError';
import { ForbiddenError } from '../../../shared/errors/AppError';
import { requirePublication } from '../../services/libraryGuards';
import { toPublicationOutputs } from '../../services/publicationOutput';
import { importCast, importCharacters, importMembers } from '../../services/importSnapshot';
import { setUpSeason } from '../../services/seasonSetup';
import { toCastOutput } from '../../services/castOutput';

/** Vitrines públicas (não precisa estar logado para ver). */
export class ListPublicationsUseCase implements IUseCase<ListPublicationsInput, PublicationOutput[]> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: ListPublicationsInput): Promise<PublicationOutput[]> {
    return toPublicationOutputs(this.repos, await this.repos.publications.findAll(input));
  }
}

/** Uma publicação (a página de uma temporada publicada). */
export class GetPublicationUseCase implements IUseCase<PublicationIdInput, PublicationOutput> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: PublicationIdInput): Promise<PublicationOutput> {
    const [output] = await toPublicationOutputs(this.repos, [await requirePublication(this.repos, input.publicationId)]);
    return output;
  }
}

/** Tira da vitrine. Quem já copiou continua com a cópia; a origem continua com quem criou. */
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
 * Copia para a biblioteca de quem está logado:
 *  - cast: vira um cast com o mesmo elenco e relacionamentos;
 *  - temporada: o elenco publicado vira um cast, pronto para jogar a própria versão;
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
        const [character] = [...(await importCharacters(repos, ownerId, props.snapshot)).values()];
        return { kind: props.kind, cast: null, character: character.toJSON() };
      }

      const cast = await importCast(repos, ownerId, props.snapshot, {
        name: input.name ?? props.name,
        description: props.description,
        imageUrl: props.imageUrl,
      });
      return { kind: props.kind, cast: await toCastOutput(repos, cast), character: null };
    });
  }
}

/**
 * Copia uma temporada publicada inteira para a biblioteca: uma temporada nova, em preparação, com as mesmas
 * configurações (modo, missões, prêmio, moeda...) e o elenco publicado. Os personagens entram na biblioteca.
 */
export class CopySeasonUseCase implements IUseCase<CopySeasonInput, SeasonDetailsOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: CopySeasonInput): Promise<SeasonDetailsOutput> {
    return this.uow.run(async (repos) => {
      const publication = await requirePublication(repos, input.publicationId);
      const settings = publication.season;
      if (!settings) throw new DomainError('Só uma temporada publicada pode ser copiada como temporada');
      const ownerId = input.actor.id;
      const members = await importMembers(repos, ownerId, publication.snapshot);
      return setUpSeason(repos, { ...settings, name: input.name ?? publication.name, ownerId, human: input.human }, members);
    });
  }
}
