import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { pool } from '../../src/infrastructure/database/connection';
import { app, createCharacters, createSeason, ok, signUp } from '../helpers';

describe('publicações e elenco', () => {
  it('publica cast e personagem, copia para a Minha Área e o dono do site modera', async () => {
    const { agent } = await signUp('autor');
    const behaviors = ok<{ id: string }[]>(await agent.get('/api/behaviors'));
    const ids = await createCharacters(agent, ['Gabi', 'Hugo', 'Iris']);
    ok(await agent.patch(`/api/characters/${ids[0]}`).send({ behaviorIds: [behaviors[0].id], imageUrl: 'https://example.com/g.png' }));
    const cast = ok(await agent.post('/api/casts').send({ name: 'Trio', characterIds: ids, imageUrl: 'https://example.com/t.png' }), 201);
    ok(await agent.patch(`/api/casts/${cast.id}/relationships`).send({ fromId: ids[0], toId: ids[1], trust: 80, liking: 70, hatred: 5, allied: true }));

    const castPub = ok(await agent.post('/api/publications').send({ kind: 'CAST', sourceId: cast.id, description: 'Três amigos' }), 201);
    const charPub = ok(await agent.post('/api/publications').send({ kind: 'CHARACTER', sourceId: ids[0] }), 201);
    // Publicar de novo atualiza a mesma publicação.
    expect(ok(await agent.post('/api/publications').send({ kind: 'CAST', sourceId: cast.id }), 201).id).toBe(castPub.id);
    expect(ok<unknown[]>(await agent.get('/api/publications').query({ kind: 'CAST' })).length).toBeGreaterThan(0);

    const tiny = ok(await agent.post('/api/casts').send({ name: 'Dupla', characterIds: ids.slice(0, 2) }), 201);
    expect((await agent.post('/api/publications').send({ kind: 'CAST', sourceId: tiny.id })).status).toBe(422);

    const { agent: reader } = await signUp('leitor');
    const copiedCast = ok(await reader.post(`/api/publications/${castPub.id}/copy`).send({}), 201);
    expect(copiedCast.cast.characterIds.length).toBe(3);
    // Copiar de novo não duplica os personagens (mesmo nome).
    ok(await reader.post(`/api/publications/${castPub.id}/copy`).send({ name: 'Trio 2' }), 201);
    const copiedChar = ok(await reader.post(`/api/publications/${charPub.id}/copy`).send({ name: 'Gabi (cópia)' }), 201);
    expect(copiedChar.character.name).toContain('Gabi');
    expect((await reader.delete(`/api/publications/${charPub.id}`)).status).toBe(403);

    const { agent: owner } = await signUp('moder', true);
    const seasonOfOwner = await createSeason(owner, 4);
    const official = ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: seasonOfOwner.id }), 201);
    expect(official.area).toBe('OFFICIAL');
    expect(ok<unknown[]>(await reader.get('/api/publications').query({ area: 'OFFICIAL' })).length).toBeGreaterThan(0);
    ok(await owner.delete(`/api/publications/${charPub.id}`), 204);
    expect((await owner.post(`/api/publications/${charPub.id}/copy`)).status).toBe(404);
  });

  it('adiciona jogadores do cast, salva na biblioteca e muda papéis antes do início', async () => {
    const { agent } = await signUp('elenco');
    const ids = await createCharacters(agent, ['Joana', 'Kaio', 'Lia', 'Mauro']);
    const cast = ok(await agent.post('/api/casts').send({ name: 'Quarteto', characterIds: ids }), 201);
    const season = ok(await agent.post('/api/seasons').send({ name: 'Com cast', castId: cast.id, mode: 'AUTOMATIC' }), 201);
    expect(season.players.length).toBe(4);

    const [extra] = await createCharacters(agent, ['Nina']);
    const nina = ok(await agent.post(`/api/seasons/${season.id}/players`).send({ characterId: extra, role: 'TRAITOR' }), 201);
    expect((await agent.post(`/api/seasons/${season.id}/players`).send({ characterId: extra })).status).toBe(409);
    expect((await agent.post(`/api/seasons/${season.id}/players`).send({})).status).toBe(400);
    ok(await agent.patch(`/api/seasons/${season.id}/players/${nina.id}`).send({ role: 'FAITHFUL', imageUrl: 'https://example.com/n.png', behaviorIds: [] }));
    const saved = ok(await agent.post(`/api/seasons/${season.id}/players`).send({ name: 'Otávio', saveToLibrary: true }), 201);
    expect(saved.characterId).toBeTruthy();
    expect((await agent.post(`/api/seasons/${season.id}/players/${nina.id}/withdraw`)).status).toBe(422);

    // Sessão vencida: o cookie deixa de valer.
    await pool.query("UPDATE user_sessions SET expires_at = now() - interval '1 day'");
    expect((await agent.get('/api/seasons')).status).toBe(401);
    expect((await request(app).get('/api/seasons').set('Cookie', 'traitors_session=nao-existe')).status).toBe(401);
  });
});
