import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors/DomainError';
import { optionalText, requiredText, uniqueIds } from './values';

/** Uma foto a mais do personagem (ex.: a de cada temporada em que participou). */
export interface CharacterPhoto {
  url: string;
  /** Legenda curta, como "EUA · 4ª temporada". */
  label: string | null;
}

/** Foto como chega de fora (legenda opcional). */
export type CharacterPhotoInput = Pick<CharacterPhoto, 'url'> & { label?: string | null };

/** Papel do participante numa temporada do programa (spoiler). */
export type ParticipantRole = 'FAITHFUL' | 'TRAITOR' | 'RECRUITED';

/** Uma temporada de The Traitors em que o participante esteve. */
export interface ParticipantSeason {
  /** Ex.: "EUA · 4ª temporada". */
  label: string;
  /** Publicação (temporada oficial do site) que corresponde a esta: a página mostra o cartão dela. */
  publicationId: string | null;
  role: ParticipantRole | null;
  /** Ex.: "Recrutado(a) no episódio 9". */
  roleDetail: string | null;
  /** Ex.: "Assassinado(a) no episódio 9", "Venceu". */
  fate: string | null;
  /** Ex.: "10º de 23". */
  placement: string | null;
  shieldWins: number | null;
  episodes: number | null;
}

/** Página de informações do participante real (temporadas oficiais). */
export interface ParticipantProfile {
  /** Página do participante na wiki (Fandom), de onde as informações podem ser importadas. */
  wikiUrl: string | null;
  seasons: ParticipantSeason[];
  /** Outros realities de que participou. */
  otherShows: string[];
}

export interface CharacterProps {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Fotos extras; cada cast pode usar uma delas no lugar da principal. */
  photos: CharacterPhoto[];
  /** Comportamentos (tags de personalidade) usados na simulação automática. */
  behaviorIds: string[];
  /** Informações do participante real (só faz sentido nos elencos oficiais). */
  profile: ParticipantProfile | null;
  createdAt: Date;
  /** Quem criou o personagem (Minha Área). Null só em registros anteriores às contas. */
  ownerId: string | null;
}

const MAX_PHOTOS = 20;
const MAX_SEASONS = 20;
const MAX_SHOWS = 30;
const URL = /^https?:\/\//i;
const ROLES: readonly ParticipantRole[] = ['FAITHFUL', 'TRAITOR', 'RECRUITED'];

function httpUrl(value: string, message: string): string {
  const url = value.trim();
  if (!URL.test(url)) throw new DomainError(message);
  return url;
}

function count(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.max(0, Math.round(value));
}

/** Perfil como chega de fora (campos opcionais). */
export interface ParticipantProfileInput {
  wikiUrl?: string | null;
  seasons?: (Partial<ParticipantSeason> & { label: string })[];
  otherShows?: string[];
}

/** Confere e limpa o perfil (textos aparados, listas sem vazios). */
export function normalizeProfile(input: ParticipantProfileInput | null): ParticipantProfile | null {
  if (!input) return null;
  const profile = { wikiUrl: input.wikiUrl ?? null, seasons: input.seasons ?? [], otherShows: input.otherShows ?? [] };
  if (profile.seasons.length > MAX_SEASONS) throw new DomainError(`No máximo ${MAX_SEASONS} temporadas`);
  if (profile.otherShows.length > MAX_SHOWS) throw new DomainError(`No máximo ${MAX_SHOWS} outros realities`);
  return {
    wikiUrl: profile.wikiUrl?.trim() ? httpUrl(profile.wikiUrl, 'O link da wiki precisa começar com http(s)://') : null,
    seasons: profile.seasons.map((s) => {
      if (s.role && !ROLES.includes(s.role)) throw new DomainError('Papel inválido');
      return {
        label: requiredText(s.label, 'Cada temporada precisa de um nome'),
        publicationId: s.publicationId ?? null,
        role: s.role ?? null,
        roleDetail: optionalText(s.roleDetail),
        fate: optionalText(s.fate),
        placement: optionalText(s.placement),
        shieldWins: count(s.shieldWins),
        episodes: count(s.episodes),
      };
    }),
    otherShows: [...new Set(profile.otherShows.map((s) => s.trim()).filter(Boolean))],
  };
}

/** Personagem salvo na biblioteca, reutilizável em várias temporadas. */
export class Character {
  constructor(private readonly props: CharacterProps) {}

  static create(input: { name: string; ownerId: string; imageUrl?: string | null; behaviorIds?: string[]; photos?: CharacterPhotoInput[] }): Character {
    const character = new Character({
      id: randomUUID(),
      name: '',
      imageUrl: input.imageUrl ?? null,
      photos: [],
      behaviorIds: [],
      profile: null,
      createdAt: new Date(),
      ownerId: input.ownerId,
    });
    character.rename(input.name);
    character.setBehaviors(input.behaviorIds ?? []);
    character.setPhotos(input.photos ?? []);
    return character;
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get ownerId(): string | null { return this.props.ownerId; }
  get imageUrl(): string | null { return this.props.imageUrl; }
  get photos(): readonly CharacterPhoto[] { return this.props.photos; }
  get profile(): ParticipantProfile | null { return this.props.profile; }
  get behaviorIds(): readonly string[] { return this.props.behaviorIds; }

  rename(name: string): void {
    this.props.name = requiredText(name, 'O nome do personagem é obrigatório');
  }

  changeImage(imageUrl: string | null): void {
    this.props.imageUrl = imageUrl;
  }

  /** Troca a galeria de fotos extras (sem repetir a mesma url). */
  setPhotos(photos: readonly CharacterPhotoInput[]): void {
    const seen = new Set<string>();
    const clean: CharacterPhoto[] = [];
    for (const photo of photos) {
      const url = httpUrl(photo.url, 'Cada foto precisa de um link http(s)://');
      if (seen.has(url)) continue;
      seen.add(url);
      clean.push({ url, label: optionalText(photo.label) });
    }
    if (clean.length > MAX_PHOTOS) throw new DomainError(`No máximo ${MAX_PHOTOS} fotos por personagem`);
    this.props.photos = clean;
  }

  /** Acrescenta fotos novas à galeria (as que já existem ficam como estão). */
  addPhotos(photos: readonly CharacterPhoto[]): void {
    const known = new Set([this.props.imageUrl, ...this.props.photos.map((p) => p.url)]);
    this.setPhotos([...this.props.photos, ...photos.filter((p) => !known.has(p.url))].slice(0, MAX_PHOTOS));
  }

  setProfile(profile: ParticipantProfileInput | null): void {
    this.props.profile = normalizeProfile(profile);
  }

  setBehaviors(behaviorIds: readonly string[]): void {
    this.props.behaviorIds = uniqueIds(behaviorIds);
  }

  toJSON(): CharacterProps {
    return { ...this.props, behaviorIds: [...this.props.behaviorIds], photos: this.props.photos.map((p) => ({ ...p })) };
  }
}
