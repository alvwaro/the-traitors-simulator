import type { IHttpClient } from '../services/http/HttpClient';
import { ApiError } from '../services/http/HttpClient';
import data from './fixtures/api.json';

/** Respostas gravadas da API de verdade (ver backend/test/fixtures/record-fixtures.test.ts). */
export const fixtures = data as unknown as Fixtures;

export interface Snapshot {
  label: string;
  details: { id: string; [key: string]: unknown };
  state: { phase: string | null; day: number | null; season: { id: string; mode: string; status: string }; player: { need: string | null } | null; [key: string]: unknown };
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
  publications: { official: unknown[]; fan: unknown[]; mine: unknown[] };
  castPublicationId: string;
  seasons: { id: string }[];
  games: { manual: Snapshot[]; automatic: Snapshot[]; player: Snapshot[] };
  relationships: unknown;
  fullHistory: unknown;
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
    if (path === '/publications') {
      if (query?.mine === 'true') return fixtures.publications.mine;
      return query?.area === 'OFFICIAL' ? fixtures.publications.official : fixtures.publications.fan;
    }
    if (path === '/behaviors') return fixtures.behaviors;
    if (path === '/phrases') return fixtures.phrases;
    if (path === '/editions') return fixtures.editions;
    if (path === '/characters') return fixtures.characters;
    if (/^\/characters\/[^/]+$/.test(path)) return fixtures.characters[0];
    if (path === '/casts') return fixtures.casts;
    if (/^\/casts\/[^/]+\/relationships$/.test(path)) return fixtures.castRelationships;
    if (/^\/casts\/[^/]+\/ranking$/.test(path)) return fixtures.castRanking;
    if (/^\/casts\/[^/]+$/.test(path)) return fixtures.cast;
    if (path === '/seasons') return fixtures.seasons;
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
    if (path.startsWith('/publications')) return fixtures.publications.fan[0] ?? {};
    if (path.startsWith('/characters')) return fixtures.characters[0];
    if (path.startsWith('/casts')) return fixtures.cast;
    if (path.startsWith('/behaviors')) return fixtures.behaviors[0];
    if (path.startsWith('/phrases')) return fixtures.phrases[0];
    return {};
  }
}

/** A primeira foto gravada que satisfaz a condição. */
export function findSnapshot(list: Snapshot[], test: (s: Snapshot) => boolean): Snapshot {
  const found = list.find(test);
  if (!found) throw new Error('foto não encontrada nas fixtures');
  return found;
}
