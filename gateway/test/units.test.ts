import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { compose, type GatewayContext } from '../src/pipeline';
import { LeastConnections, probe, RoundRobin, strategyFor, type Upstream } from '../src/upstream/pool';

const upstream = (port: number, active = 0): Upstream => ({ url: new URL(`http://127.0.0.1:${port}`), healthy: true, active });

describe('configuração', () => {
  it('usa padrões seguros sem variáveis', () => {
    const config = loadConfig({});
    expect(config.port).toBe(8080);
    expect(config.upstreams.map((u) => u.origin)).toEqual(['http://localhost:3000']);
    expect(config.strategy).toBe('round-robin');
    expect(config.trustProxy).toBe(false);
    expect(config.bodyLimitBytes).toBe(1024 * 1024);
  });

  it('lê as variáveis e recusa valores inválidos', () => {
    const config = loadConfig({
      PORT: '9000',
      UPSTREAMS: 'http://api-1:3000, http://api-2:3000',
      LB_STRATEGY: 'least-connections',
      TRUST_PROXY: 'true',
      ALLOWED_ORIGINS: 'https://a.test,https://b.test',
      RATE_LIMIT_MAX: '10',
    });
    expect(config.port).toBe(9000);
    expect(config.upstreams).toHaveLength(2);
    expect(config.strategy).toBe('least-connections');
    expect(config.trustProxy).toBe(true);
    expect(config.allowedOrigins).toEqual(['https://a.test', 'https://b.test']);
    expect(config.globalRateLimit.max).toBe(10);

    expect(() => loadConfig({ LB_STRATEGY: 'aleatorio' })).toThrow(/LB_STRATEGY/);
    expect(() => loadConfig({ PORT: 'oitenta' })).toThrow(/PORT/);
    expect(() => loadConfig({ UPSTREAMS: 'ftp://api:21' })).toThrow(/http/);
  });
});

describe('estratégias de balanceamento', () => {
  it('revezamento passa por todas em ordem', () => {
    const list = [upstream(1), upstream(2), upstream(3)];
    const rr = new RoundRobin();
    expect([rr.pick(list), rr.pick(list), rr.pick(list), rr.pick(list)]).toEqual([list[0], list[1], list[2], list[0]]);
    expect(rr.pick([])).toBeUndefined();
  });

  it('menos conexões escolhe a instância mais livre', () => {
    const list = [upstream(1, 3), upstream(2, 1), upstream(3, 2)];
    expect(new LeastConnections().pick(list)).toBe(list[1]);
    expect(new LeastConnections().pick([])).toBeUndefined();
    expect(strategyFor('least-connections')).toBeInstanceOf(LeastConnections);
    expect(strategyFor('round-robin')).toBeInstanceOf(RoundRobin);
  });

  it('a checagem de saúde falha para quem não responde', async () => {
    expect(await probe(new URL('http://127.0.0.1:1'), 200)).toBe(false);
  });
});

describe('cadeia de etapas', () => {
  it('roda na ordem e para quando uma etapa responde', async () => {
    const calls: string[] = [];
    const ctx = {} as GatewayContext;
    await compose([
      async (_c, next) => {
        calls.push('a');
        await next();
        calls.push('a depois');
      },
      (_c, next) => {
        calls.push('b');
        return next();
      },
      () => {
        calls.push('c');
      },
      () => {
        calls.push('nunca');
      },
    ])(ctx);
    expect(calls).toEqual(['a', 'b', 'c', 'a depois']);
  });
});
