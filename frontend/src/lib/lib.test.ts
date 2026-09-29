import { describe, expect, it } from 'vitest';
import { pickOne, sample, seededRng, shuffle } from './random';
import { safeReturn } from './safeReturn';

describe('safeReturn', () => {
  const origin = 'https://castelo.test';

  it('volta para caminhos do próprio site (com query e âncora)', () => {
    expect(safeReturn('/temporadas/1?aba=cronica#dia-2', origin)).toBe('/temporadas/1?aba=cronica#dia-2');
    expect(safeReturn('/biblioteca/../minha-area', origin)).toBe('/minha-area');
  });

  it('recusa o que levaria para outro site', () => {
    expect(safeReturn(null, origin)).toBe('/');
    expect(safeReturn('https://atacante.test', origin)).toBe('/');
    expect(safeReturn('//atacante.test/entrar', origin)).toBe('/');
    expect(safeReturn('/\\atacante.test', origin)).toBe('/');
    expect(safeReturn('temporadas', origin)).toBe('/');
  });

  it('usa a origem da página por padrão', () => {
    expect(safeReturn('/guia')).toBe('/guia');
  });
});

describe('sorteio do site', () => {
  it('embaralha, sorteia e escolhe com a mesma semente do backend', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(shuffle(items, seededRng('x')).sort((a, b) => a.localeCompare(b))).toEqual(items);
    expect(sample(items, 2, seededRng('x'))).toHaveLength(2);
    expect(items).toContain(pickOne(items, seededRng('y')));
    expect(pickOne([])).toBeUndefined();
  });
});
