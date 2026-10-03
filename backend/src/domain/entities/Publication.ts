import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors/DomainError';
import { requiredText } from './values';
import { MIN_PLAYERS_TO_START } from '../rules';
import { PublishedSeason, PublishedSnapshot } from './PublishedSnapshot';
import { PublicationArea, PublicationCountry, PublicationKind, UserRole } from '@traitors/shared';

/** SEASON, CAST ou CHARACTER. OFFICIAL: Temporadas Oficiais (só donos, só temporadas). FAN: Área de Fãs. US/UK: versão do programa. */
export { PublicationArea, PublicationCountry, PublicationKind } from '@traitors/shared';

export interface PublicationProps {
  id: string;
  kind: PublicationKind;
  area: PublicationArea;
  /** Temporadas oficiais: dos EUA ou do Reino Unido. Null na Área de Fãs. */
  country: PublicationCountry | null;
  publisherId: string | null;
  /** De onde veio (para atualizar a publicação). A origem pode ter sido apagada depois. */
  seasonId: string | null;
  castId: string | null;
  characterId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** Cópia congelada do elenco: o cast, o personagem ou os participantes da temporada. */
  snapshot: PublishedSnapshot;
  /** Temporadas: as configurações quando foi publicada (quem copia recebe as mesmas). Null nos casts e personagens. */
  season: PublishedSeason | null;
  publishedAt: Date;
}

export interface PublicationContent {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  snapshot: PublishedSnapshot;
  season?: PublishedSeason | null;
}

/** De onde veio a publicação: a própria temporada, ou o cast/personagem da biblioteca. */
export type PublicationSource = { kind: 'SEASON'; seasonId: string } | { kind: 'CAST'; castId: string } | { kind: 'CHARACTER'; characterId: string };

/** Onde a publicação fica: a área e, nas Temporadas Oficiais, a versão do programa. */
export interface PublicationPlace {
  area: PublicationArea;
  country: PublicationCountry | null;
}

/**
 * Onde a publicação entra. As Temporadas Oficiais só recebem temporadas, publicadas pelos donos do site,
 * e cada uma é dos EUA ou do Reino Unido. O resto (e tudo o que os fãs publicam) vai para a Área de Fãs.
 * Sem área pedida, temporadas de donos entram como oficiais.
 */
export function placeFor(role: UserRole, kind: PublicationKind, requested: { area?: PublicationArea; country?: PublicationCountry | null }): PublicationPlace {
  const official = requested.area ? requested.area === PublicationArea.OFFICIAL : role === UserRole.OWNER && kind === PublicationKind.SEASON;
  if (!official) return { area: PublicationArea.FAN, country: null };
  if (role !== UserRole.OWNER) throw new DomainError('Só os donos do site publicam temporadas oficiais');
  if (kind !== PublicationKind.SEASON) throw new DomainError('Nas Temporadas Oficiais só entram temporadas');
  if (!requested.country) throw new DomainError('Diga se a temporada oficial é dos EUA ou do Reino Unido');
  return { area: PublicationArea.OFFICIAL, country: requested.country };
}

/**
 * Algo publicado numa das áreas públicas do site. É sempre uma cópia congelada da origem:
 * mexer no cast, no personagem ou jogar a temporada depois não muda a publicação até ela ser atualizada.
 */
export class Publication {
  constructor(private readonly props: PublicationProps) {}

  static publish(input: PublicationContent & { source: PublicationSource; publisherId: string; place: PublicationPlace }): Publication {
    const { source } = input;
    const publication = new Publication({
      id: randomUUID(),
      kind: source.kind,
      area: input.place.area,
      country: input.place.country,
      publisherId: input.publisherId,
      seasonId: source.kind === 'SEASON' ? source.seasonId : null,
      castId: source.kind === 'CAST' ? source.castId : null,
      characterId: source.kind === 'CHARACTER' ? source.characterId : null,
      name: '',
      description: null,
      imageUrl: null,
      snapshot: input.snapshot,
      season: null,
      publishedAt: new Date(),
    });
    publication.republish(input);
    return publication;
  }

  get id(): string { return this.props.id; }
  get kind(): PublicationKind { return this.props.kind; }
  get area(): PublicationArea { return this.props.area; }
  get country(): PublicationCountry | null { return this.props.country; }
  get publisherId(): string | null { return this.props.publisherId; }
  get seasonId(): string | null { return this.props.seasonId; }
  get name(): string { return this.props.name; }
  get snapshot(): PublishedSnapshot { return this.props.snapshot; }
  get season(): PublishedSeason | null { return this.props.season; }

  /** Troca o conteúdo por uma cópia nova da origem (mantém o mesmo id). */
  republish(input: PublicationContent): void {
    const name = requiredText(input.name, 'O nome é obrigatório');
    this.assertContent(input);
    this.props.name = name;
    this.props.description = input.description ?? null;
    this.props.imageUrl = input.imageUrl ?? null;
    this.props.snapshot = input.snapshot;
    this.props.season = input.season ?? null;
    this.props.publishedAt = new Date();
  }

  /** Muda de lugar (donos movem temporadas entre as oficiais e a Área de Fãs, ou de país). */
  moveTo(place: PublicationPlace): void {
    this.props.area = place.area;
    this.props.country = place.country;
  }

  /** Quem publicou pode tirar; donos do site também (moderação). */
  canBeRemovedBy(user: { id: string; role: UserRole }): boolean {
    return user.role === UserRole.OWNER || this.props.publisherId === user.id;
  }

  toJSON(): PublicationProps { return { ...this.props }; }

  private assertContent({ snapshot, season }: PublicationContent): void {
    switch (this.props.kind) {
      case PublicationKind.SEASON:
        if (!season) throw new DomainError('A temporada publicada precisa levar as configurações');
        return;
      case PublicationKind.CAST:
        if (snapshot.characters.length < MIN_PLAYERS_TO_START) {
          throw new DomainError(`Um cast publicado precisa de pelo menos ${MIN_PLAYERS_TO_START} personagens`);
        }
        return;
      case PublicationKind.CHARACTER:
        if (snapshot.characters.length !== 1) throw new DomainError('A publicação de personagem precisa de exatamente um personagem');
    }
  }
}
