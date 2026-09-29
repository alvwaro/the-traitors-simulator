import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/main/app';
import { Lifecycle } from '../../src/presentation/http/health';
import { app, ok, signUp } from '../helpers';

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;

describe('plataforma HTTP', () => {
  it('responde às checagens do balanceador de carga', async () => {
    expect(ok(await request(app).get('/health')).ok).toBe(true);
    expect(ok(await request(app).get('/health/live')).ok).toBe(true);
    expect(ok(await request(app).get('/health/ready')).ok).toBe(true);

    const lifecycle = new Lifecycle();
    const leaving = buildApp({}, lifecycle);
    lifecycle.startDraining();
    const ready = await request(leaving).get('/health/ready');
    expect(ready.status).toBe(503);
    expect(ready.body.reason).toBe('draining');
  });

  it('identifica cada requisição e protege as respostas', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();

    const id = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';
    expect((await request(app).get('/api/auth/me').set('x-request-id', id)).headers['x-request-id']).toBe(id);
    expect((await request(app).get('/api/auth/me').set('x-request-id', 'qualquer coisa')).headers['x-request-id']).toMatch(UUID);
  });

  it('responde em JSON para rota inexistente e corpo inválido', async () => {
    const missing = await request(app).get('/api/nada');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('NotFound');

    const broken = await request(app).post('/api/auth/login').set('content-type', 'application/json').send('{"username":');
    expect(broken.status).toBe(400);
    expect(broken.body.error).toBe('BadRequest');
  });

  it('recusa escrita vinda de outro site (CSRF), mas aceita a do próprio site', async () => {
    const { agent } = await signUp('csrf');
    const forged = await agent.post('/api/seasons').set('origin', 'https://atacante.example').send({ name: 'Golpe' });
    expect(forged.status).toBe(403);
    expect((await agent.delete('/api/seasons/3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f').set('sec-fetch-site', 'cross-site')).status).toBe(403);
    // Leitura de outro site não muda nada: segue a regra normal.
    expect((await agent.get('/api/seasons').set('origin', 'https://atacante.example')).status).toBe(200);

    const same = await agent.post('/api/seasons').set('host', 'castelo.test').set('origin', 'https://castelo.test').send({ name: 'Legítima' });
    expect(same.status).toBe(201);
  });

  it('limita as tentativas de login por IP', async () => {
    const limited = buildApp();
    const attempt = () => request(limited).post('/api/auth/login').send({ username: 'ninguem', password: 'senha-errada' });
    for (let i = 0; i < 20; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
