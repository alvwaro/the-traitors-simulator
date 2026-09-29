import { describe, expect, it } from 'vitest';
import { isCrossSiteWrite, MemoryRateLimitStore, RateLimiter } from '../src';

describe('isCrossSiteWrite', () => {
  const write = { method: 'POST', host: 'castelo.com', origin: undefined, secFetchSite: undefined };

  it('deixa leituras e clientes sem cabeçalhos de navegador', () => {
    expect(isCrossSiteWrite({ ...write, method: 'GET', origin: 'https://outro.com' })).toBe(false);
    expect(isCrossSiteWrite(write)).toBe(false);
    expect(isCrossSiteWrite({ ...write, secFetchSite: 'same-origin' })).toBe(false);
  });

  it('aceita a própria origem e as origens liberadas', () => {
    expect(isCrossSiteWrite({ ...write, origin: 'https://castelo.com' })).toBe(false);
    expect(isCrossSiteWrite({ ...write, method: 'delete', origin: 'https://app.castelo.com' }, ['https://app.castelo.com'])).toBe(false);
  });

  it('recusa escrita vinda de outro site', () => {
    expect(isCrossSiteWrite({ ...write, origin: 'https://atacante.com' })).toBe(true);
    expect(isCrossSiteWrite({ ...write, origin: 'null' })).toBe(true);
    expect(isCrossSiteWrite({ ...write, secFetchSite: 'cross-site' })).toBe(true);
    expect(isCrossSiteWrite({ ...write, host: undefined, origin: 'https://castelo.com' })).toBe(true);
  });
});

describe('RateLimiter', () => {
  it('barra quem passa do limite e libera quando a janela anda', () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 2 });
    expect(limiter.check('ip', 0)).toEqual({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
    expect(limiter.check('ip', 100).allowed).toBe(true);
    expect(limiter.check('ip', 200)).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 1 });
    expect(limiter.check('outro', 200).allowed).toBe(true);
    expect(limiter.check('ip', 1001).allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('não guarda tentativas barradas e esquece as chaves paradas', () => {
    const store = new MemoryRateLimitStore(1);
    const rule = { windowMs: 1000, max: 1 };
    store.take('a', rule, 0);
    for (let i = 0; i < 1000; i++) expect(store.take('a', rule, 10).allowed).toBe(false);
    expect(store.take('a', rule, 1000).allowed).toBe(true);
    store.take('b', rule, 5000);
    expect(store.take('a', rule, 5000).allowed).toBe(true);
  });
});
