import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { RemoteImageFetcher } from '../../src/infrastructure/http/RemoteImageFetcher';
import { buildApp } from '../../src/main/app';
import { createCharacters, ok, signUp } from '../helpers';

describe('biblioteca: personagens, casts, comportamentos e frases', () => {

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

  it('cria o personagem direto no fim de um cast (só num cast seu)', async () => {
    const { agent } = await signUp('nocast');
    const ids = await createCharacters(agent, ['Primeira', 'Segunda']);
    const cast = ok(await agent.post('/api/casts').send({ name: 'Elenco', characterIds: ids }), 201);
    const created = ok(await agent.post('/api/characters').send({ name: 'Recém-chegada', castId: cast.id }), 201);
    expect(ok(await agent.get(`/api/casts/${cast.id}`)).characterIds).toEqual([...ids, created.id]);

    const { agent: other } = await signUp('nocast2');
    expect((await other.post('/api/characters').send({ name: 'Intrusa', castId: cast.id })).status).toBe(404);
    expect(ok<{ name: string }[]>(await other.get('/api/characters')).some((c) => c.name === 'Intrusa')).toBe(false);
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
    expect(guide.editions.map((e: { pool: string }) => e.pool)).toEqual(['US_S1', 'UK_S1', 'US_S2', 'UK_S2', 'US_S3', 'UK_S3', 'US_S4', 'MIX']);
    expect(guide.commonEvents.length).toBeGreaterThan(5);
  });

  it('repassa imagens externas pelo proxy e recusa o que não é imagem', async () => {
    // O "site externo" é um servidor local; só este app de teste pode acessar a própria máquina.
    const site = createServer((req, res) => {
      if (req.url === '/foto.png') res.writeHead(200, { 'content-type': 'image/png' }).end(Buffer.from([137, 80, 78, 71]));
      else res.writeHead(200, { 'content-type': 'text/html' }).end('<html></html>');
    });
    await new Promise<void>((resolve) => site.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(site.address() as AddressInfo).port}`;
    try {
      const proxyApp = buildApp({ imageFetcher: new RemoteImageFetcher({ allowAddress: () => true }) });
      const { agent } = await signUp('proxy', false, proxyApp);
      const image = await agent.get('/api/image-proxy').query({ url: `${base}/foto.png` });
      expect(image.status).toBe(200);
      expect(image.headers['content-type']).toContain('image/png');
      expect(image.headers['content-security-policy']).toContain('sandbox');
      expect((await agent.get('/api/image-proxy').query({ url: `${base}/pagina` })).status).toBe(415);

      // O app de verdade nunca busca endereços da própria máquina ou da rede interna.
      const { agent: plain } = await signUp('proxy');
      expect((await plain.get('/api/image-proxy').query({ url: `${base}/foto.png` })).status).toBe(400);
      expect((await plain.get('/api/image-proxy').query({ url: 'http://localhost/foto.png' })).status).toBe(400);
      expect((await plain.get('/api/image-proxy').query({ url: 'não é link' })).status).toBe(400);
    } finally {
      await new Promise((resolve) => site.close(resolve));
    }
  });
});
