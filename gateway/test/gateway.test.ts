import { afterEach, describe, expect, it } from 'vitest';
import { call, closeAll, fakeApi, ID, listen, SESSION, startGateway } from './support';

afterEach(closeAll);

describe('gateway: o que nem chega ao backend', () => {
  it('responde as próprias checagens de saúde e recusa o que não é da API', async () => {
    const api = await fakeApi('a');
    const { port, gateway } = await startGateway([api.url]);
    expect((await call(port, { path: '/health/live' })).status).toBe(200);
    expect(JSON.parse((await call(port, { path: '/health/ready' })).body)).toEqual({ ok: true });
    expect((await call(port, { path: '/index.html' })).status).toBe(404);

    gateway.pool.markDown(gateway.pool.upstreams[0]);
    expect((await call(port, { path: '/health/ready' })).status).toBe(503);
    expect(api.seen).toHaveLength(0);
  });

  it('barra rota inexistente, método errado e id malformado pelo manifesto da API', async () => {
    const api = await fakeApi('a');
    const { port } = await startGateway([api.url]);
    const missing = await call(port, { path: '/api/nada', headers: { cookie: SESSION } });
    expect(missing.status).toBe(404);
    expect(JSON.parse(missing.body)).toEqual({ error: 'NotFound', message: 'Rota inexistente' });

    const wrongMethod = await call(port, { method: 'DELETE', path: `/api/seasons/${ID}/state`, headers: { cookie: SESSION } });
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.allow).toBe('GET');

    expect((await call(port, { path: '/api/seasons/1%20OR%201=1', headers: { cookie: SESSION } })).status).toBe(400);
    expect((await call(port, { path: '//outro.site/api/auth/me' })).status).toBe(404);
    expect(api.seen).toHaveLength(0);
  });

  it('exige o cookie da sessão nas rotas de quem está logado (as públicas passam sem)', async () => {
    const api = await fakeApi('a');
    const { port } = await startGateway([api.url]);
    const anonymous = await call(port, { path: '/api/seasons' });
    expect(anonymous.status).toBe(401);
    expect(JSON.parse(anonymous.body).error).toBe('UnauthorizedError');
    expect((await call(port, { path: '/api/seasons', headers: { cookie: 'outro=1; traitors_session=' } })).status).toBe(401);

    expect((await call(port, { path: '/api/auth/me' })).status).toBe(200);
    expect((await call(port, { path: '/api/seasons', headers: { cookie: `tema=escuro; ${SESSION}` } })).status).toBe(200);
    expect(api.seen.map((r) => r.url)).toEqual(['/api/auth/me', '/api/seasons']);
  });

  it('recusa escrita vinda de outro site (CSRF) e aceita a do próprio site', async () => {
    const api = await fakeApi('a');
    const { port } = await startGateway([api.url], { allowedOrigins: ['https://app.castelo.test'] });
    const write = { method: 'POST', path: '/api/seasons', body: '{"name":"X"}' };
    const json = { cookie: SESSION, 'content-type': 'application/json' };
    expect((await call(port, { ...write, headers: { ...json, host: 'castelo.test', origin: 'https://atacante.test' } })).status).toBe(403);
    expect((await call(port, { ...write, headers: { ...json, 'sec-fetch-site': 'cross-site' } })).status).toBe(403);
    expect((await call(port, { ...write, headers: { ...json, host: 'castelo.test', origin: 'https://castelo.test' } })).status).toBe(200);
    expect((await call(port, { ...write, headers: { ...json, host: 'castelo.test', origin: 'https://app.castelo.test' } })).status).toBe(200);
    expect(api.seen).toHaveLength(2);
  });

  it('confere o corpo: só JSON, bem formado e dentro do tamanho', async () => {
    const api = await fakeApi('a');
    const { port } = await startGateway([api.url], { bodyLimitBytes: 64 });
    const post = (headers: Record<string, string | number>, body?: string) =>
      call(port, { method: 'POST', path: '/api/seasons', headers: { cookie: SESSION, ...headers }, body });
    expect((await post({ 'content-type': 'text/plain' }, 'name=X')).status).toBe(415);
    expect((await post({ 'content-type': 'application/json' }, '{"name":')).status).toBe(400);
    expect((await post({ 'content-type': 'application/json', 'content-length': 1000 }, 'x'.repeat(1000))).status).toBe(413);
    expect((await post({ 'content-type': 'application/json', 'transfer-encoding': 'chunked' }, `"${'x'.repeat(200)}"`)).status).toBe(413);
    expect(api.seen).toHaveLength(0);

    expect((await call(port, { method: 'POST', path: `/api/seasons/${ID}/advance`, headers: { cookie: SESSION } })).status).toBe(200);
    expect((await post({ 'content-type': 'application/json; charset=utf-8' }, '{"name":"X"}')).status).toBe(200);
    expect(api.seen.map((r) => r.body)).toEqual(['', '{"name":"X"}']);
  });

  it('limita as requisições por IP e as tentativas de login', async () => {
    const api = await fakeApi('a');
    const { port } = await startGateway([api.url], { globalRateLimit: { windowMs: 60_000, max: 25 } });
    const login = () => call(port, { method: 'POST', path: '/api/auth/login', headers: { 'content-type': 'application/json' }, body: '{}' });
    for (let i = 0; i < 20; i++) expect((await login()).status).toBe(200);
    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    // 21 tentativas de login + 4 rotas inexistentes = 25 (o limite geral); a próxima passa do limite.
    for (let i = 0; i < 4; i++) expect((await call(port, { path: '/api/nada' })).status).toBe(404);
    expect((await call(port, { path: '/api/auth/me' })).status).toBe(429);
  });
});

describe('gateway: repasse ao backend', () => {
  it('repassa com os cabeçalhos de rastreio e devolve a resposta do backend', async () => {
    const api = await fakeApi('a');
    const { port } = await startGateway([api.url]);
    const reply = await call(port, {
      path: '/api/characters?search=Ana%20Paula',
      headers: { cookie: SESSION, host: 'castelo.test', connection: 'keep-alive, x-segredo', 'x-segredo': '1', 'x-forwarded-for': '6.6.6.6' },
    });
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body)).toEqual({ from: 'a' });
    expect(reply.headers['x-api']).toBe('a');
    expect(reply.headers['cache-control']).toBe('private');
    expect(reply.headers['x-content-type-options']).toBe('nosniff');

    const [seen] = api.seen;
    expect(seen.url).toBe('/api/characters?search=Ana%20Paula');
    expect(seen.headers.host).toBe('castelo.test');
    expect(seen.headers['x-request-id']).toBe(reply.headers['x-request-id']);
    // Sem proxy confiável na frente, o X-Forwarded-For de quem pediu é ignorado.
    expect(seen.headers['x-forwarded-for']).toMatch(/127\.0\.0\.1$/);
    expect(seen.headers['x-forwarded-proto']).toBe('http');
    expect(seen.headers['x-segredo']).toBeUndefined();
  });

  it('atrás de um proxy confiável, usa o IP e o id de requisição que ele informou', async () => {
    const api = await fakeApi('a');
    const { port } = await startGateway([api.url], { trustProxy: true });
    await call(port, { path: '/api/auth/me', headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.7', 'x-forwarded-proto': 'https', 'x-request-id': ID } });
    const [seen] = api.seen;
    expect(seen.headers['x-forwarded-for']).toBe('203.0.113.7');
    expect(seen.headers['x-forwarded-proto']).toBe('https');
    expect(seen.headers['x-request-id']).toBe(ID);
  });

  it('reveza as instâncias e transmite respostas em partes (streaming)', async () => {
    const a = await fakeApi('a');
    const b = await fakeApi('b', (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: 1\n\n');
      setTimeout(() => res.end('data: 2\n\n'), 20);
    });
    const { port } = await startGateway([a.url, b.url]);
    const bodies = [];
    for (let i = 0; i < 4; i++) bodies.push((await call(port, { path: '/api/auth/me' })).body);
    expect(bodies).toEqual(['{"from":"a"}', 'data: 1\n\ndata: 2\n\n', '{"from":"a"}', 'data: 1\n\ndata: 2\n\n']);
  });

  it('tira da roda a instância que caiu e manda a requisição para outra', async () => {
    const a = await fakeApi('a');
    const b = await fakeApi('b');
    const { port, gateway } = await startGateway([a.url, b.url]);
    await new Promise<void>((resolve) => a.server.close(() => resolve()));

    // A conexão recusada prova que o POST não chegou: vai para a outra instância.
    const created = await call(port, { method: 'POST', path: '/api/seasons', headers: { cookie: SESSION, 'content-type': 'application/json' }, body: '{"name":"X"}' });
    expect(JSON.parse(created.body)).toEqual({ from: 'b' });
    expect(gateway.pool.upstreams[0].healthy).toBe(false);
    expect(JSON.parse((await call(port, { path: '/api/auth/me' })).body)).toEqual({ from: 'b' });

    await new Promise<void>((resolve) => b.server.close(() => resolve()));
    gateway.pool.upstreams[0].healthy = true;
    const down = await call(port, { path: '/api/auth/me' });
    expect(down.status).toBe(503);
    expect(JSON.parse(down.body).error).toBe('ServiceUnavailable');
  });

  it('não repete uma escrita que pode ter chegado ao backend', async () => {
    const flaky = await fakeApi('a', (req) => req.socket.destroy());
    const backup = await fakeApi('b');
    const { port } = await startGateway([flaky.url, backup.url]);
    const reply = await call(port, { method: 'POST', path: `/api/seasons/${ID}/advance`, headers: { cookie: SESSION } });
    expect(reply.status).toBe(502);
    expect(backup.seen).toHaveLength(0);

    // Leitura pode ser repetida em outra instância.
    const read = await call(port, { path: '/api/auth/me' });
    expect(JSON.parse(read.body)).toEqual({ from: 'b' });
  });

  it('responde 504 quando o backend demora demais e corta a resposta que quebra no meio', async () => {
    const slow = await fakeApi('a', () => undefined);
    const { port } = await startGateway([slow.url], { upstreamTimeoutMs: 50 });
    expect((await call(port, { path: '/api/auth/me' })).status).toBe(504);

    const broken = await fakeApi('b', (req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{"parte":');
      setTimeout(() => req.socket.destroy(), 10);
    });
    const other = await startGateway([broken.url]);
    await expect(call(other.port, { path: '/api/auth/me' })).rejects.toThrow();
  });
});

describe('gateway: saúde das instâncias', () => {
  it('a checagem ativa tira e devolve instâncias da roda', async () => {
    let ready = true;
    const api = await listen((req, res) => {
      if (req.url === '/health/ready') res.writeHead(ready ? 200 : 503).end();
      else res.writeHead(200).end('{}');
    });
    const { gateway } = await startGateway([api.url]);
    ready = false;
    await gateway.pool.checkAll();
    expect(gateway.pool.hasHealthy).toBe(false);
    ready = true;
    await gateway.pool.checkAll();
    expect(gateway.pool.hasHealthy).toBe(true);

    gateway.pool.startHealthChecks(10);
    gateway.pool.startHealthChecks(10);
    ready = false;
    await expect.poll(() => gateway.pool.hasHealthy).toBe(false);
    gateway.pool.stopHealthChecks();
  });
});
