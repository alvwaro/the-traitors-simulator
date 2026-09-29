import { describe, expect, it } from 'vitest';
import { API_ROUTES, looksLikeUuid, RouteMatcher } from '../src';

const ID = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';

describe('manifesto da API', () => {
  it('não repete método + caminho e só usa ids como parâmetro', () => {
    const keys = Object.values(API_ROUTES).map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of Object.values(API_ROUTES)) {
      for (const param of r.path.split('/').filter((s) => s.startsWith(':'))) expect(param).toMatch(/Id$/);
    }
  });

  it('exige dono do recurso só em rotas de quem está logado', () => {
    for (const r of Object.values(API_ROUTES)) {
      if ('guard' in r) expect(r.access).toBe('user');
    }
  });
});

describe('RouteMatcher', () => {
  const matcher = new RouteMatcher();

  it('acha a rota e os parâmetros', () => {
    expect(matcher.match('GET', `/seasons/${ID}/state`)).toMatchObject({ kind: 'found', id: 'game.state', params: { seasonId: ID } });
    expect(matcher.match('POST', '/auth/login')).toMatchObject({ kind: 'found', id: 'auth.login' });
    expect(matcher.match('PATCH', `/seasons/${ID}/players/${ID}/`)).toMatchObject({ kind: 'found', id: 'players.update' });
  });

  it('diferencia rota inexistente, método errado e id malformado', () => {
    expect(matcher.match('GET', '/nada')).toEqual({ kind: 'not-found' });
    expect(matcher.match('GET', '/seasons/%E0%A4%A')).toEqual({ kind: 'not-found' });
    expect(matcher.match('DELETE', `/seasons/${ID}/state`)).toEqual({ kind: 'method-not-allowed', allowed: ['GET'] });
    expect(matcher.match('PUT', '/seasons')).toEqual({ kind: 'method-not-allowed', allowed: ['POST', 'GET'] });
    expect(matcher.match('GET', '/seasons/abc')).toMatchObject({ kind: 'invalid-param', id: 'seasons.get', param: 'seasonId' });
  });

  it('reconhece o formato de um id', () => {
    expect(looksLikeUuid(ID)).toBe(true);
    expect(looksLikeUuid(ID.toUpperCase())).toBe(true);
    expect(looksLikeUuid(`${ID}0`)).toBe(false);
    expect(looksLikeUuid('1 OR 1=1')).toBe(false);
  });
});
