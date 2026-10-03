import { describe, expect, it } from 'vitest';
import {
  countryOfSeason,
  enumOf,
  GamePhase,
  isBehaviorEffectKey,
  leadersOf,
  lastRound,
  phraseProblem,
  pickOne,
  seededRng,
  shuffle,
  tally,
  userSlots,
  userTokens,
  USERNAME_PATTERN,
} from '../src';

describe('enums', () => {
  it('usa o próprio nome como valor e não deixa alterar', () => {
    const Color = enumOf('RED', 'BLUE');
    expect(Color).toEqual({ RED: 'RED', BLUE: 'BLUE' });
    expect(Object.isFrozen(Color)).toBe(true);
    expect(GamePhase.ROUND_TABLE).toBe('ROUND_TABLE');
  });

  it('acha a versão do programa pelas missões e, nas misturadas, pela moeda', () => {
    expect(countryOfSeason('US_S4', 'GBP')).toBe('US');
    expect(countryOfSeason('UK_S2', 'BRL')).toBe('UK');
    expect(countryOfSeason('MIX', 'GBP')).toBe('UK');
    expect(countryOfSeason('MIX', 'USD')).toBe('US');
  });
});

describe('sorteio', () => {
  it('repete a mesma sequência para a mesma semente', () => {
    const a = seededRng('temporada:1:MISSION');
    const b = seededRng('temporada:1:MISSION');
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(seededRng('outra')()).not.toBe(first[0]);
  });

  it('mantém a sequência já usada pelas temporadas gravadas', () => {
    // Valores do gerador anterior (soma com "| 0"): as sementes antigas continuam produzindo o mesmo jogo.
    const rng = seededRng('abc');
    expect([rng(), rng(), rng()]).toEqual([0.8397557286079973, 0.370647334959358, 0.20023633493110538]);
  });

  it('embaralha sem perder itens e escolhe um da lista', () => {
    const rng = seededRng('embaralhar');
    const items = [1, 2, 3, 4, 5];
    expect(shuffle(rng, items).sort((x, y) => x - y)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(items).toContain(pickOne(rng, items));
    expect(pickOne(rng, [])).toBeUndefined();
  });
});

describe('apuração de votos', () => {
  const votes = [
    { voterId: 'a', targetId: 'x', round: 1 },
    { voterId: 'b', targetId: 'y', round: 1 },
    { voterId: 'c', targetId: 'x', round: 1 },
    { voterId: 'a', targetId: 'y', round: 2 },
    { voterId: 'c', targetId: 'x', round: 2 },
  ];

  it('apura a última rodada por padrão e aponta o empate', () => {
    expect(lastRound(votes)).toBe(2);
    expect(tally(votes)).toEqual({ round: 2, counts: [['y', 1], ['x', 1]], leaders: ['y', 'x'] });
    expect(tally(votes, 1)).toEqual({ round: 1, counts: [['x', 2], ['y', 1]], leaders: ['x'] });
  });

  it('não tem mais votado sem votos', () => {
    expect(lastRound([])).toBe(1);
    expect(tally([]).leaders).toEqual([]);
    expect(leadersOf(new Map())).toEqual([]);
  });
});

describe('frases', () => {
  it('lista os marcadores e as vagas na ordem de aparição', () => {
    const text = '{user1} viu {user} com {user1} e {victim}';
    expect(userTokens(text).map((m) => [m[0], m.index])).toEqual([['{user1}', 0], ['{user}', 12], ['{user1}', 23]]);
    expect(userSlots(text)).toEqual(['{user1}', '{user}']);
  });

  it('explica o que está errado na frase', () => {
    expect(phraseProblem('{user} chegou')).toBeNull();
    expect(phraseProblem('x'.repeat(401))).toMatch(/400 caracteres/);
    expect(phraseProblem('{user} e {amigo}')).toMatch(/Marcador inválido: \{amigo\}/);
    expect(phraseProblem('{user sem fechar')).toMatch(/Marcador inválido/);
    expect(phraseProblem('ninguém aqui')).toMatch(/pelo menos um \{user\}/);
  });
});

describe('regras de conta e comportamentos', () => {
  it('valida o nome de usuário e as chaves de efeito', () => {
    expect(USERNAME_PATTERN.test('ana.maria_1')).toBe(true);
    expect(USERNAME_PATTERN.test('ab')).toBe(false);
    expect(USERNAME_PATTERN.test('com espaço')).toBe(false);
    expect(isBehaviorEffectKey('loyalty')).toBe(true);
    expect(isBehaviorEffectKey('toString')).toBe(false);
  });
});
