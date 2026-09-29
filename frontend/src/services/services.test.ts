import { describe, expect, it } from 'vitest';
import { BehaviorService } from './api/BehaviorService';
import { CastService } from './api/CastService';
import { CharacterService } from './api/CharacterService';
import { PhraseService } from './api/PhraseService';
import type { IHttpClient } from './http/HttpClient';

/** Cliente HTTP que só anota o que foi pedido. */
function recorder() {
  const calls: string[] = [];
  const http: IHttpClient = {
    get: async (path, query) => {
      calls.push(`GET ${path}${query ? ` ${JSON.stringify(query)}` : ''}`);
      return [] as never;
    },
    post: async (path, body) => {
      calls.push(`POST ${path} ${JSON.stringify(body)}`);
      return {} as never;
    },
    patch: async (path, body) => {
      calls.push(`PATCH ${path} ${JSON.stringify(body)}`);
      return {} as never;
    },
    delete: async (path) => {
      calls.push(`DELETE ${path}`);
    },
  };
  return { calls, http };
}

describe('serviços REST da biblioteca', () => {
  it('casts: operações comuns e as próprias do cast', async () => {
    const { calls, http } = recorder();
    const casts = new CastService(http);
    await casts.list();
    await casts.get('c1');
    await casts.create({ name: 'Quarteto', characterIds: [] });
    await casts.update('c1', { name: 'Trio' });
    await casts.remove('c1');
    await casts.relationships('c1');
    await casts.updateRelationship('c1', { fromId: 'a', toId: 'b', trust: 80 });
    await casts.ranking('c1');
    await casts.randomizeBehaviors('c1');
    expect(calls).toEqual([
      'GET /casts',
      'GET /casts/c1',
      'POST /casts {"name":"Quarteto","characterIds":[]}',
      'PATCH /casts/c1 {"name":"Trio"}',
      'DELETE /casts/c1',
      'GET /casts/c1/relationships',
      'PATCH /casts/c1/relationships {"fromId":"a","toId":"b","trust":80}',
      'GET /casts/c1/ranking',
      'POST /casts/c1/randomize-behaviors {}',
    ]);
  });

  it('personagens, frases e comportamentos listam com os filtros certos', async () => {
    const { calls, http } = recorder();
    await new CharacterService(http).list('Ana');
    await new PhraseService(http).list('ARRIVAL');
    await new BehaviorService(http).list();
    await new PhraseService(http).remove('p1');
    expect(calls).toEqual(['GET /characters {"search":"Ana"}', 'GET /phrases {"phase":"ARRIVAL"}', 'GET /behaviors', 'DELETE /phrases/p1']);
  });
});
