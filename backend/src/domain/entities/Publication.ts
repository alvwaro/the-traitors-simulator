import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors/DomainError';
import { requiredText } from './values';
import { MIN_PLAYERS_TO_START } from '../rules';
import { PublishedSnapshot } from './PublishedSnapshot';
import { PublicationArea, PublicationKind, UserRole } from '@traitors/shared';

/** SEASON, CAST ou CHARACTER. OFFICIAL: Castelo · Área Oficial (só donos). FAN: Área de Fãs. */
export { PublicationArea, PublicationKind } from '@traitors/shared';

export interface PublicationProps {
  id: string;
  kind: PublicationKind;
  area: PublicationArea;
  publisherId: string | null;
  seasonId: string | null;
  castId: string | null;
  characterId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Casts e personagens: cópia congelada. Temporadas: null (são lidas ao vivo). */
  snapshot: PublishedSnapshot | null;
  publishedAt: Date;
}

export interface PublicationContent {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  snapshot: PublishedSnapshot | null;
}

/** De onde veio a publicação: a própria temporada, ou o cast/personagem da biblioteca. */
export type PublicationSource = { kind: 'SEASON'; seasonId: string } | { kind: 'CAST'; castId: string } | { kind: 'CHARACTER'; characterId: string };

/**
 * A área depende do papel de quem publica: donos escolhem (oficial, por padrão, ou fãs);
 * fãs publicam sempre na Área de Fãs.
 */
export function areaFor(role: UserRole, requested?: PublicationArea): PublicationArea {
  if (role !== UserRole.OWNER) {
    if (requested === PublicationArea.OFFICIAL) throw new DomainError('Só os donos do site publicam temporadas oficiais');
    return PublicationArea.FAN;
  }
  return requested ?? PublicationArea.OFFICIAL;
}

/**
 * Algo publicado numa das áreas públicas do site.
 * Casts e personagens são cópias congeladas (editar o original não muda até republicar);
 * temporadas são a própria temporada, somente leitura para os outros.
 */
export class Publication {
  constructor(private readonly props: PublicationProps) {}

  static publish(input: PublicationContent & { source: PublicationSource; publisherId: string; area: PublicationArea }): Publication {
    const { source } = input;
    const publication = new Publication({
      id: randomUUID(),
      kind: source.kind,
      area: input.area,
      publisherId: input.publisherId,
      seasonId: source.kind === 'SEASON' ? source.seasonId : null,
      castId: source.kind === 'CAST' ? source.castId : null,
      characterId: source.kind === 'CHARACTER' ? source.characterId : null,
      name: '',
      description: null,
      imageUrl: null,
      snapshot: null,
      publishedAt: new Date(),
    });
    publication.republish(input);
    return publication;
  }

  get id(): string { return this.props.id; }
  get kind(): PublicationKind { return this.props.kind; }
  get area(): PublicationArea { return this.props.area; }
  get publisherId(): string | null { return this.props.publisherId; }
  get seasonId(): string | null { return this.props.seasonId; }
  get name(): string { return this.props.name; }
  get snapshot(): PublishedSnapshot | null { return this.props.snapshot; }

  /** Troca o conteúdo pela versão atual da origem (mantém o mesmo id). */
  republish(input: PublicationContent): void {
    const name = requiredText(input.name, 'O nome é obrigatório');
    this.assertSnapshot(input.snapshot);
    this.props.name = name;
    this.props.description = input.description ?? null;
    this.props.imageUrl = input.imageUrl ?? null;
    this.props.snapshot = input.snapshot;
    this.props.publishedAt = new Date();
  }

  /** Muda de área (donos movem entre a oficial e a de fãs). */
  moveTo(area: PublicationArea): void {
    this.props.area = area;
  }

  /** Quem publicou pode tirar; donos do site também (moderação). */
  canBeRemovedBy(user: { id: string; role: UserRole }): boolean {
    return user.role === UserRole.OWNER || this.props.publisherId === user.id;
  }

  toJSON(): PublicationProps { return { ...this.props }; }

  private assertSnapshot(snapshot: PublishedSnapshot | null): void {
    switch (this.props.kind) {
      case PublicationKind.SEASON:
        return;
      case PublicationKind.CAST:
        if (!snapshot || snapshot.characters.length < MIN_PLAYERS_TO_START) {
          throw new DomainError(`Um cast publicado precisa de pelo menos ${MIN_PLAYERS_TO_START} personagens`);
        }
        return;
      case PublicationKind.CHARACTER:
        if (snapshot?.characters.length !== 1) throw new DomainError('A publicação de personagem precisa de exatamente um personagem');
    }
  }
}
