import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { pool } from '../../src/infrastructure/database/connection';
import { app, createCharacters, createSeason, ok, signUp } from '../helpers';

type Member = { name: string; behaviorIds?: string[]; behaviors?: { name: string }[]; isHuman?: boolean };

describe('publicações e elenco', () => {
  it('publica cast e personagem, copia para a biblioteca e o dono do site modera', async () => {
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
    expect(ok(await agent.get(`/api/publications/${castPub.id}`))).toMatchObject({ kind: 'CAST', season: null });

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
    // Só uma temporada publicada vira temporada.
    expect((await reader.post(`/api/publications/${castPub.id}/copy-season`).send({})).status).toBe(422);

    const { agent: owner } = await signUp('moder', true);
    const seasonOfOwner = await createSeason(owner, 4);
    const official = ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: seasonOfOwner.id }), 201);
    // Sem dizer o país, vale o das missões da temporada (US_S3).
    expect(official).toMatchObject({ area: 'OFFICIAL', country: 'US' });
    expect(ok<unknown[]>(await reader.get('/api/publications').query({ area: 'OFFICIAL' })).length).toBeGreaterThan(0);
    ok(await owner.delete(`/api/publications/${charPub.id}`), 204);
    expect((await owner.post(`/api/publications/${charPub.id}/copy`)).status).toBe(404);
    expect((await owner.get(`/api/publications/${charPub.id}`)).status).toBe(404);
  });

  it('a temporada publicada é uma cópia das configurações e do elenco: jogar, renomear ou apagar a origem não muda a vitrine', async () => {
    const { agent: owner } = await signUp('congela', true);
    const behaviors = ok<{ id: string; name: string }[]>(await owner.get('/api/behaviors'));
    const settings = { missionPool: 'UK_S2', currency: 'GBP', initialPrizePot: 1000, maxPrizePot: 50000, hiddenShieldChance: 30 };
    const season = await createSeason(owner, 6, settings);
    // Papel escolhido antes do início não vai para a vitrine; comportamentos vão.
    ok(await owner.patch(`/api/seasons/${season.id}/players/${season.players[0].id}`).send({ role: 'TRAITOR', behaviorIds: [behaviors[0].id] }));
    const pub = ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: season.id, description: 'Elenco oficial' }), 201);
    expect(pub).toMatchObject({ area: 'OFFICIAL', country: 'UK', name: season.name, season: { mode: 'MANUAL', ...settings } });
    expect(pub.snapshot.characters).toHaveLength(6);
    expect(pub.snapshot.characters.map((c: { characterId: string }) => c.characterId)).toEqual(season.players.map((p: { characterId: string }) => p.characterId));
    expect(JSON.stringify(pub.snapshot)).not.toContain('TRAITOR');

    ok(await owner.post(`/api/seasons/${season.id}/start`));
    ok(await owner.patch(`/api/seasons/${season.id}`).send({ name: 'Nome novo' }));

    const { agent: fan } = await signUp('assiste');
    const seen = ok(await fan.get(`/api/publications/${pub.id}`));
    expect(seen).toMatchObject({ name: season.name, description: 'Elenco oficial', season: pub.season, snapshot: pub.snapshot });

    // A temporada em si continua só de quem criou.
    expect((await fan.get(`/api/seasons/${season.id}`)).status).toBe(404);
    expect((await fan.get(`/api/seasons/${season.id}/history`)).status).toBe(404);
    expect((await fan.post(`/api/seasons/${season.id}/advance`)).status).toBe(404);

    // Copiar o elenco leva o elenco publicado; copiar a temporada, as configurações também, pronta para começar.
    expect(ok(await fan.post(`/api/publications/${pub.id}/copy`).send({}), 201).cast.characterIds).toHaveLength(6);
    const copy = ok(await fan.post(`/api/publications/${pub.id}/copy-season`).send({}), 201);
    expect(copy).toMatchObject({ name: season.name, status: 'SETUP', mode: 'MANUAL', ...settings });
    expect(copy.players.map((p: Member) => p.name)).toEqual(pub.snapshot.characters.map((c: Member) => c.name));
    expect(copy.players[0].behaviorIds).toEqual([behaviors[0].id]);
    expect(copy.players.every((p: { role: string }) => p.role === 'FAITHFUL')).toBe(true);
    expect(ok(await fan.get(`/api/seasons/${copy.id}`)).ownerId).not.toBe(season.ownerId);
    expect(ok(await fan.post(`/api/publications/${pub.id}/copy-season`).send({ name: 'Minha versão' }), 201).name).toBe('Minha versão');

    // Atualizar a publicação tira uma cópia nova e pode trocar o país.
    const updated = ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: season.id, country: 'US' }), 201);
    expect(updated).toMatchObject({ id: pub.id, area: 'OFFICIAL', country: 'US', name: 'Nome novo' });

    // Apagar a temporada de origem não tira a publicação do ar.
    ok(await owner.delete(`/api/seasons/${season.id}`), 204);
    const orphan = ok(await fan.get(`/api/publications/${pub.id}`));
    expect(orphan.seasonId).toBeNull();
    expect(orphan.snapshot.characters).toHaveLength(6);
    ok(await fan.post(`/api/publications/${pub.id}/copy-season`).send({}), 201);
  });

  it('copiar uma temporada do modo Jogador pede o nome de quem vai jogar', async () => {
    const { agent: author } = await signUp('jogadora');
    const played = await createSeason(author, 5, { mode: 'PLAYER', human: { name: 'Eu Mesma' }, interactionLimit: 2, chaos: 10, drama: true, showPhrases: false });
    const pub = ok(await author.post('/api/publications').send({ kind: 'SEASON', sourceId: played.id }), 201);
    // Quem jogava não entra no elenco publicado.
    expect(pub.snapshot.characters.map((c: Member) => c.name)).not.toContain('Eu Mesma');
    expect(pub.season).toMatchObject({ mode: 'PLAYER', interactionLimit: 2, chaos: 10, drama: true, showPhrases: false });

    const { agent: other } = await signUp('outra');
    expect((await other.post(`/api/publications/${pub.id}/copy-season`).send({})).status).toBe(422);
    const copy = ok(await other.post(`/api/publications/${pub.id}/copy-season`).send({ name: 'Minha vez', human: { name: 'Outra Pessoa' } }), 201);
    expect(copy).toMatchObject({ name: 'Minha vez', mode: 'PLAYER', status: 'SETUP', interactionLimit: 2, drama: true, showPhrases: false });
    expect(copy.players).toHaveLength(6);
    expect(copy.players.filter((p: Member) => p.isHuman).map((p: Member) => p.name)).toEqual(['Outra Pessoa']);
  });

  it('nas Temporadas Oficiais só entram temporadas, publicadas pelos donos, dos EUA ou do Reino Unido', async () => {
    const { agent: owner } = await signUp('lugares', true);
    const [character] = await createCharacters(owner, ['Só na Área de Fãs']);
    expect((await owner.post('/api/publications').send({ kind: 'CHARACTER', sourceId: character, area: 'OFFICIAL' })).status).toBe(422);
    expect(ok(await owner.post('/api/publications').send({ kind: 'CHARACTER', sourceId: character }), 201)).toMatchObject({ area: 'FAN', country: null });

    const season = await createSeason(owner, 4);
    const asFan = ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: season.id, area: 'FAN', country: 'UK' }), 201);
    expect(asFan).toMatchObject({ area: 'FAN', country: null });
    // Atualizar sem dizer a área mantém onde está; pedir a oficial move, com o país.
    expect(ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: season.id }), 201).area).toBe('FAN');
    const moved = ok(await owner.post('/api/publications').send({ kind: 'SEASON', sourceId: season.id, area: 'OFFICIAL', country: 'UK' }), 201);
    expect(moved).toMatchObject({ id: asFan.id, area: 'OFFICIAL', country: 'UK' });

    const { agent: fan } = await signUp('semoficial');
    const own = await createSeason(fan, 4);
    expect((await fan.post('/api/publications').send({ kind: 'SEASON', sourceId: own.id, area: 'OFFICIAL', country: 'US' })).status).toBe(422);
    expect((await fan.post('/api/publications').send({ kind: 'SEASON', sourceId: own.id, country: 'BR' })).status).toBe(400);
    expect(ok(await fan.post('/api/publications').send({ kind: 'SEASON', sourceId: own.id }), 201)).toMatchObject({ area: 'FAN', country: null });
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
