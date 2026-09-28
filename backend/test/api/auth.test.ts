import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, ok, signUp, TEST_SECRET } from '../helpers';

describe('contas', () => {
  it('cadastra, entra, diz quem é e sai', async () => {
    const { agent, username } = await signUp('conta');
    const me = ok(await agent.get('/api/auth/me'));
    expect(me.user.username).toBe(username);

    ok(await agent.post('/api/auth/logout'), 204);
    expect(ok(await agent.get('/api/auth/me')).user).toBeNull();

    const again = request.agent(app);
    ok(await again.post('/api/auth/login').send({ username, password: TEST_SECRET }));
    expect(ok(await again.get('/api/auth/me')).user.username).toBe(username);
  });

  it('recusa senha errada, usuário repetido e dados inválidos', async () => {
    const { username } = await signUp('dup');
    const anon = request.agent(app);
    expect((await anon.post('/api/auth/login').send({ username, password: `${TEST_SECRET}-errada` })).status).toBe(401);
    expect((await anon.post('/api/auth/register').send({ username, password: TEST_SECRET })).status).toBe(409);
    expect((await anon.post('/api/auth/register').send({ username: 'x', password: '1' })).status).toBe(422);
    expect((await anon.post('/api/auth/register').send({})).status).toBe(400);
  });

  it('exige login para a área logada e dono do site para mexer nas frases', async () => {
    const anon = request(app);
    expect((await anon.get('/api/seasons')).status).toBe(401);
    const { agent } = await signUp('fan');
    expect((await agent.post('/api/phrases').send({ phase: 'ARRIVAL', text: 'Olá {user}' })).status).toBe(403);
    expect(ok(await request(app).get('/health')).ok).toBe(true);
  });
});
