import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork, Repositories } from '../../ports/IUnitOfWork';
import { IWikiClient, WikiSeason } from '../../ports/IWikiClient';
import { CharacterProps, MISSION_POOLS, ParticipantProfile, ParticipantSeason, PublicationArea, PublicationKind } from '../../../domain/entities';
import { UserRole } from '@traitors/shared';
import { NotFoundError } from '../../../shared/errors/AppError';
import { ParticipantInput, ParticipantOutput, WikiImportInput } from '../../dtos/LibraryDTOs';
import { requireCharacter } from '../../services/libraryGuards';

/**
 * Página de informações do participante. Personagens de donos do site (os participantes reais das
 * temporadas oficiais) abrem para todos; os de fãs, só para quem os criou.
 */
export class GetParticipantUseCase implements IUseCase<ParticipantInput, ParticipantOutput> {
  constructor(private readonly repos: Repositories) {}

  async execute(input: ParticipantInput): Promise<ParticipantOutput> {
    const character = await requireCharacter(this.repos, input.characterId);
    const mine = character.ownerId === input.ownerId;
    if (!mine) {
      const owner = character.ownerId ? await this.repos.users.findById(character.ownerId) : null;
      if (owner?.role !== UserRole.OWNER) throw new NotFoundError('Personagem', input.characterId);
    }
    const c = character.toJSON();
    return { id: c.id, name: c.name, imageUrl: c.imageUrl, photos: c.photos, profile: c.profile, canEdit: mine };
  }
}

/** "US4" → "US_S4", quando o site tem as missões daquela temporada. */
function poolOf(code: string | null): string | null {
  const match = code ? /^([A-Z]{2})(\d+)$/.exec(code) : null;
  const pool = match ? `${match[1]}_S${match[2]}` : null;
  return pool && (MISSION_POOLS as readonly string[]).includes(pool) ? pool : null;
}

/** Temporadas oficiais publicadas (a mais recente de cada), por conjunto de missões: a temporada do programa que reproduzem. */
async function officialSeasonsByPool(repos: Repositories): Promise<Map<string, string>> {
  const published = await repos.publications.findAll({ area: PublicationArea.OFFICIAL, kind: PublicationKind.SEASON });
  const byPool = new Map<string, string>();
  for (const p of published) {
    const pool = p.season?.missionPool;
    if (pool && !byPool.has(pool)) byPool.set(pool, p.id);
  }
  return byPool;
}

/**
 * Junta o que veio da wiki com o que já estava salvo: a temporada ligada à mão continua ligada;
 * senão, liga à temporada oficial publicada que reproduz a mesma temporada do programa.
 */
function merge(current: ParticipantProfile | null, wikiUrl: string, seasons: WikiSeason[], otherShows: string[], byPool: Map<string, string>): ParticipantProfile {
  const linked = new Map((current?.seasons ?? []).map((s) => [s.label, s.publicationId]));
  const fromWiki: ParticipantSeason[] = seasons.map(({ code, ...s }) => {
    const pool = poolOf(code);
    return { ...s, publicationId: linked.get(s.label) ?? (pool ? (byPool.get(pool) ?? null) : null) };
  });
  // Temporadas cadastradas à mão que a wiki não conhece continuam no fim.
  const manual = (current?.seasons ?? []).filter((s) => !fromWiki.some((w) => w.label === s.label));
  return {
    wikiUrl,
    seasons: [...fromWiki, ...manual],
    otherShows: [...new Set([...otherShows, ...(current?.otherShows ?? [])])],
  };
}

/** Preenche a página do participante com a wiki: temporadas, papel, destino, outros realities e as fotos. */
export class ImportWikiUseCase implements IUseCase<WikiImportInput, CharacterProps> {
  constructor(
    private readonly uow: IUnitOfWork,
    private readonly wiki: IWikiClient,
  ) {}

  async execute(input: WikiImportInput): Promise<CharacterProps> {
    const data = await this.wiki.participant(input.url);
    return this.uow.run(async (repos) => {
      const character = await requireCharacter(repos, input.characterId);
      character.setProfile(merge(character.profile, data.wikiUrl, data.seasons, data.otherShows, await officialSeasonsByPool(repos)));
      character.addPhotos(data.photos);
      if (!character.imageUrl && data.photos[0]) character.changeImage(data.photos[0].url);
      await repos.characters.update(character);
      return character.toJSON();
    });
  }
}
