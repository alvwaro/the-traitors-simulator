import type { IHttpClient } from '../services/http/HttpClient';
import { ApiError } from '../services/http/HttpClient';
import data from './fixtures/api.json';

/** Respostas gravadas da API de verdade (ver backend/test/fixtures/record-fixtures.test.ts). */
export const fixtures = data as unknown as Fixtures;

export interface Snapshot {
  label: string;
  details: { id: string; [key: string]: unknown };
  state: { phase: string | null; day: number | null; season: { id: string; name: string; mode: string; status: string }; player: { need: string | null } | null; [key: string]: unknown };
  history: unknown;
}

interface Fixtures {
  me: { user: unknown };
  owner: { user: unknown };
  behaviors: { id: string }[];
  phrases: unknown[];
  editions: unknown;
  characters: { id: string }[];
  casts: { id: string }[];
  cast: { id: string };
  castRelationships: unknown;
  castRanking: unknown;
  publications: { official: Listed[]; fan: Listed[]; mine: Listed[] };
  castPublicationId: string;
  seasons: { id: string; name: string; mode: string; status: string }[];
  games: { manual: Snapshot[]; automatic: Snapshot[]; player: Snapshot[] };
  relationships: unknown;
  fullHistory: unknown;
}

/** O que os testes leem de uma publicação gravada. */
interface Listed {
  id: string;
  kind: string;
  [key: string]: unknown;
}

export interface Call {
  method: string;
  path: string;
  body?: unknown;
}

/**
 * Cliente HTTP falso: responde com as gravações e anota cada chamada.
 * `snapshot` é a temporada que a tela está vendo; `fail` faz as escritas darem erro (para testar as mensagens).
 */
export class FakeApi implements IHttpClient {
  calls: Call[] = [];
  snapshot: Snapshot = fixtures.games.manual[0];
  user: unknown = fixtures.me.user;
  fail = false;
  history: unknown = null;
  /** As temporadas da biblioteca (dá para trocar o estado de cada uma). */
  seasons: unknown[] = fixtures.seasons;

  get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    this.calls.push({ method: 'GET', path, body: query });
    return this.answer<T>(() => this.read(path, query));
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.write<T>('POST', path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.write<T>('PATCH', path, body);
  }

  async delete(path: string): Promise<void> {
    await this.write('DELETE', path);
  }

  private async write<T>(method: string, path: string, body?: unknown): Promise<T> {
    this.calls.push({ method, path, body });
    if (this.fail) throw new ApiError('Falhou de propósito', 422);
    return this.answer<T>(() => this.written(path, body));
  }

  private answer<T>(fn: () => unknown): Promise<T> {
    return Promise.resolve().then(() => {
      const value = fn();
      if (value instanceof ApiError) throw value;
      return structuredClone(value) as T;
    });
  }

  private read(path: string, query?: Record<string, string | undefined>): unknown {
    const s = this.snapshot;
    if (path === '/auth/me') return { user: this.user };
    if (path === '/publications') return publicationList(query);
    if (/^\/publications\/[^/]+$/.test(path)) return publicationList().find((p) => path.endsWith(p.id)) ?? new ApiError('Publicação não encontrada', 404);
    if (path === '/behaviors') return fixtures.behaviors;
    if (path === '/phrases') return fixtures.phrases;
    if (path === '/editions') return fixtures.editions;
    if (path === '/characters') return fixtures.characters;
    if (/^\/participants\/[^/]+$/.test(path)) return participantFixture(this.user === fixtures.owner.user);
    if (/^\/characters\/[^/]+$/.test(path)) return fixtures.characters[0];
    if (path === '/casts') return fixtures.casts;
    if (/^\/casts\/[^/]+\/relationships$/.test(path)) return fixtures.castRelationships;
    if (/^\/casts\/[^/]+\/ranking$/.test(path)) return fixtures.castRanking;
    if (/^\/casts\/[^/]+$/.test(path)) return fixtures.cast;
    if (path === '/seasons') return this.seasons;
    if (/^\/seasons\/[^/]+\/state$/.test(path)) return s.state;
    if (/^\/seasons\/[^/]+\/history$/.test(path)) return this.history ?? s.history;
    if (/^\/seasons\/[^/]+\/relationships$/.test(path)) return fixtures.relationships;
    if (/^\/seasons\/[^/]+\/players$/.test(path)) return (s.details as { players?: unknown[] }).players ?? [];
    if (/^\/seasons\/[^/]+$/.test(path)) return s.details;
    if (path.startsWith('/image-proxy')) return new Blob();
    return new ApiError(`Rota não gravada: GET ${path}`, 404);
  }

  /** Escritas devolvem algo com o formato certo (a tela recarrega os dados depois). */
  private written(path: string, body: unknown): unknown {
    const s = this.snapshot;
    if (path.startsWith('/auth/')) return path === '/auth/logout' ? undefined : { user: this.user };
    if (/^\/seasons\/[^/]+\/(state|advance|back|start|endgame|simulate|interactions|invites)$/.test(path)) return s.state;
    if (/^\/seasons\/[^/]+\/phase\/round-table$/.test(path) || /endgame-round-table$/.test(path)) {
      return { id: 'rt', banishedPlayerId: (body as { banishedPlayerId?: string })?.banishedPlayerId ?? null, revealedRole: 'FAITHFUL', votes: [], endgameVotes: [] };
    }
    if (/^\/seasons\/[^/]+\/phase\//.test(path)) return { id: 'ok' };
    if (/relationships/.test(path)) return fixtures.relationships ?? fixtures.castRelationships;
    if (/^\/seasons\/[^/]+\/save-as-cast$/.test(path)) return fixtures.cast;
    if (/^\/seasons(\/[^/]+)?$/.test(path)) return s.details;
    if (/^\/seasons\/[^/]+\/players/.test(path)) return (s.details as { players?: unknown[] }).players?.[0] ?? {};
    if (/^\/seasons\/[^/]+\/prize-adjustments$/.test(path)) return { transaction: {}, prizePot: 0 };
    if (/^\/publications\/[^/]+\/copy$/.test(path)) return { kind: 'CAST', cast: fixtures.cast, character: null };
    if (/^\/publications\/[^/]+\/copy-season$/.test(path)) return fixtures.games.manual[0].details;
    if (path.startsWith('/publications')) return fixtures.publications.fan[0] ?? {};
    if (path.startsWith('/characters')) return fixtures.characters[0];
    if (path.startsWith('/casts')) return fixtures.cast;
    if (path.startsWith('/behaviors')) return fixtures.behaviors[0];
    if (path.startsWith('/phrases')) return fixtures.phrases[0];
    return {};
  }
}

/** A temporada oficial gravada de um país (EUA ou Reino Unido). */
export function officialSeason(country: 'US' | 'UK'): Listed {
  const found = fixtures.publications.official.find((p) => p.kind === 'SEASON' && p.country === country);
  if (!found) throw new Error(`nenhuma temporada oficial (${country}) nas fixtures`);
  return found;
}

/** A temporada publicada por um fã nas fixtures (a simulação inteira). */
export function fanSeason(): Listed {
  const found = fixtures.publications.fan.find((p) => p.kind === 'SEASON');
  if (!found) throw new Error('nenhuma temporada de fã nas fixtures');
  return found;
}

/** As publicações gravadas, filtradas como a API filtra (área, tipo ou só as de quem está logado). */
function publicationList(query?: Record<string, string | undefined>): Listed[] {
  const { official, fan, mine } = fixtures.publications;
  let list = [...official, ...fan];
  if (query?.mine === 'true') list = mine;
  else if (query?.area) list = query.area === 'OFFICIAL' ? official : fan;
  return list.filter((p) => !query?.kind || p.kind === query.kind);
}

/** Página de participante de exemplo: duas temporadas (uma com recrutamento), fotos e outro reality. */
function participantFixture(canEdit: boolean): unknown {
  const character = fixtures.characters[0] as { id: string; name?: string; imageUrl?: string | null };
  const publicationId = officialSeason('US').id;
  return {
    id: character.id,
    name: character.name ?? 'Participante',
    imageUrl: character.imageUrl ?? null,
    photos: [{ url: 'https://example.com/t4.png', label: 'EUA · 4ª temporada' }],
    profile: {
      wikiUrl: 'https://thetraitors.fandom.com/wiki/Dorinda_Medley',
      seasons: [
        { label: 'EUA · 3ª temporada', publicationId: null, role: 'FAITHFUL', roleDetail: null, fate: 'Assassinado(a) no episódio 2', placement: '23º de 23', shieldWins: 0, episodes: 2 },
        { label: 'EUA · 4ª temporada', publicationId, role: 'RECRUITED', roleDetail: 'Recrutado(a) no episódio 9', fate: 'Banido(a) no episódio 11', placement: '3º de 23', shieldWins: 2, episodes: 11 },
      ],
      otherShows: ['The Real Housewives of New York City'],
    },
    canEdit,
  };
}

/** A primeira foto gravada que satisfaz a condição. */
export function findSnapshot(list: Snapshot[], test: (s: Snapshot) => boolean): Snapshot {
  const found = list.find(test);
  if (!found) throw new Error('foto não encontrada nas fixtures');
  return found;
}
