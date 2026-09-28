import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCharacters, ok, signUp } from '../helpers';

describe('biblioteca: personagens, casts, comportamentos e frases', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cria, busca, edita e apaga personagens', async () => {
    const { agent } = await signUp('lib');
    const behaviors = ok<{ id: string; name: string }[]>(await agent.get('/api/behaviors'));
    expect(behaviors.length).toBeGreaterThan(0);

    const created = ok(await agent.post('/api/characters').send({ name: 'Ana Paula', imageUrl: 'https://example.com/ana.png', behaviorIds: [behaviors[0].id] }), 201);
    expect(created.behaviorIds).toEqual([behaviors[0].id]);
    expect(ok<unknown[]>(await agent.get('/api/characters').query({ search: 'ana' })).length).toBe(1);
    expect(ok(await agent.get(`/api/characters/${created.id}`)).name).toBe('Ana Paula');

    const updated = ok(await agent.patch(`/api/characters/${created.id}`).send({ name: 'Ana P.', imageUrl: null, behaviorIds: [] }));
    expect(updated.name).toBe('Ana P.');
    expect((await agent.post('/api/characters').send({ name: 'Ana P.' })).status).toBe(409);
    expect((await agent.get('/api/characters/não-é-id')).status).toBe(400);

    ok(await agent.delete(`/api/characters/${created.id}`), 204);
    expect((await agent.get(`/api/characters/${created.id}`)).status).toBe(404);
  });

  it('não deixa ver nem mexer no personagem de outra pessoa', async () => {
    const { agent } = await signUp('dono');
    const [id] = await createCharacters(agent, ['Secreto']);
    const { agent: other } = await signUp('intruso');
    expect([403, 404]).toContain((await other.get(`/api/characters/${id}`)).status);
    expect([403, 404]).toContain((await other.delete(`/api/characters/${id}`)).status);
  });

  it('monta casts com relacionamentos, ranking e comportamentos sorteados', async () => {
    const { agent } = await signUp('cast');
    const ids = await createCharacters(agent, ['Bia', 'Caio', 'Duda', 'Enzo']);
    const cast = ok(await agent.post('/api/casts').send({ name: 'Elenco dos sonhos', description: 'teste', characterIds: ids }), 201);
    expect(ok<unknown[]>(await agent.get('/api/casts')).length).toBe(1);
    expect(ok(await agent.get(`/api/casts/${cast.id}`)).characters.length).toBe(4);

    const renamed = ok(await agent.patch(`/api/casts/${cast.id}`).send({ name: 'Elenco final', characterIds: ids.slice(0, 3) }));
    expect(renamed.name).toBe('Elenco final');

    const relationships = ok(await agent.patch(`/api/casts/${cast.id}/relationships`).send({ fromId: ids[0], toId: ids[1], trust: 90, liking: 80, hatred: 5, allied: true }));
    expect(relationships).toBeTruthy();
    ok(await agent.patch(`/api/casts/${cast.id}/relationships`).send({ fromId: ids[0], toId: ids[1], clear: true }));
    expect(ok(await agent.get(`/api/casts/${cast.id}/relationships`))).toBeTruthy();
    expect(ok(await agent.get(`/api/casts/${cast.id}/ranking`))).toBeTruthy();
    expect(ok(await agent.post(`/api/casts/${cast.id}/randomize-behaviors`))).toBeTruthy();

    ok(await agent.delete(`/api/casts/${cast.id}`), 204);
    expect((await agent.get(`/api/casts/${cast.id}`)).status).toBe(404);
  });

  it('só o dono do site cria, edita e apaga comportamentos e frases', async () => {
    const { agent } = await signUp('owner', true);
    const behavior = ok(await agent.post('/api/behaviors').send({ name: 'Teimoso', description: 'Não muda de ideia', effects: { loyalty: 20, paranoia: 10 } }), 201);
    ok(await agent.patch(`/api/behaviors/${behavior.id}`).send({ description: 'Nunca muda de ideia' }));
    expect((await agent.post('/api/behaviors').send({ name: 'Teimoso' })).status).toBe(409);

    const phrase = ok(await agent.post('/api/phrases').send({ phase: 'ARRIVAL', tone: 'FRIENDLY', behaviorId: behavior.id, text: '{user} abraçou {user1} na porta do castelo.' }), 201);
    expect(ok<unknown[]>(await agent.get('/api/phrases').query({ phase: 'ARRIVAL' })).length).toBeGreaterThan(0);
    ok(await agent.patch(`/api/phrases/${phrase.id}`).send({ text: '{user} cumprimentou {user1} na porta.' }));
    expect((await agent.post('/api/phrases').send({ phase: 'ARRIVAL', text: '' })).status).toBe(400);

    ok(await agent.delete(`/api/phrases/${phrase.id}`), 204);
    ok(await agent.delete(`/api/behaviors/${behavior.id}`), 204);
  });

  it('mostra o guia das temporadas', async () => {
    const { agent } = await signUp('guia');
    const guide = ok(await agent.get('/api/editions'));
    expect(guide.editions.map((e: { pool: string }) => e.pool)).toEqual(['US_S1', 'UK_S1', 'US_S2', 'UK_S2', 'US_S3', 'UK_S3', 'MIX']);
    expect(guide.commonEvents.length).toBeGreaterThan(5);
  });

  it('repassa imagens externas pelo proxy e recusa o que não é imagem', async () => {
    const { agent } = await signUp('proxy');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { 'content-type': 'image/png' } })),
    );
    const image = await agent.get('/api/image-proxy').query({ url: 'https://example.com/foto.png' });
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toContain('image/png');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })));
    expect((await agent.get('/api/image-proxy').query({ url: 'https://example.com/pagina' })).status).toBeGreaterThanOrEqual(400);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await agent.get('/api/image-proxy').query({ url: 'https://example.com/foto.png' })).status).toBeGreaterThanOrEqual(400);
    expect((await agent.get('/api/image-proxy').query({ url: 'http://localhost/foto.png' })).status).toBeGreaterThanOrEqual(400);
  });
});
