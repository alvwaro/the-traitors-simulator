import { describe, expect, it } from 'vitest';
import { errorForLog, LOG_TRUNCATED, LOG_VALUE_MAX, requestIdFrom, sanitizeForLog } from '../src';

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

describe('sanitizeForLog', () => {
  it('deixa um valor comum como está', () => {
    expect(sanitizeForLog('/api/characters?search=Ana Paula')).toBe('/api/characters?search=Ana Paula');
    expect(sanitizeForLog('Conclave à noite — ação')).toBe('Conclave à noite — ação');
  });

  it('tira CR e LF, que forjariam uma linha nova', () => {
    expect(sanitizeForLog('/api/x\r\n[FAKE] linha forjada')).toBe('/api/x[FAKE] linha forjada');
  });

  it('tira os outros caracteres de controle (C0, DEL e C1)', () => {
    expect(sanitizeForLog('a\u0000b\u0007c\td\u001be\u007ff\u0085g\u009fh')).toBe('abcdefgh');
  });

  it('tira os separadores de linha e de parágrafo do Unicode', () => {
    // U+2028 e U+2029 quebram linha em vários visualizadores de log.
    const lineSeparator = String.fromCodePoint(0x2028);
    const paragraphSeparator = String.fromCodePoint(0x2029);
    expect(sanitizeForLog(`a${lineSeparator}b${paragraphSeparator}c`)).toBe('abc');
  });

  it('corta o que passa do limite e marca o corte', () => {
    const long = 'x'.repeat(LOG_VALUE_MAX + 50);
    expect(sanitizeForLog(long)).toBe('x'.repeat(LOG_VALUE_MAX) + LOG_TRUNCATED);
    expect(sanitizeForLog('x'.repeat(LOG_VALUE_MAX))).toBe('x'.repeat(LOG_VALUE_MAX));
    expect(sanitizeForLog('abcdef', 3)).toBe(`abc${LOG_TRUNCATED}`);
  });

  it('aceita o que não é string (headers repetidos, vazios)', () => {
    expect(sanitizeForLog(undefined)).toBe('');
    expect(sanitizeForLog(['a\n', 'b'])).toBe('a,b');
    expect(sanitizeForLog(42)).toBe('42');
  });
});

describe('errorForLog', () => {
  it('saneia mensagem, código e stack do erro', () => {
    const err = Object.assign(new Error('falhou em /api/x\r\n[FAKE] linha forjada'), { code: 'E\nX' });
    const logged = errorForLog(err);
    expect(logged.name).toBe('Error');
    expect(logged.message).toBe('falhou em /api/x[FAKE] linha forjada');
    expect(logged.code).toBe('EX');
    expect(logged.stack).toContain('[FAKE] linha forjada');
    expect(logged.stack).not.toMatch(/[\r\n]/);
  });

  it('também lida com o que foi lançado sem ser Error', () => {
    expect(errorForLog('texto\r\ncru')).toEqual({ name: 'NonError', message: 'textocru' });
  });
});

describe('requestIdFrom', () => {
  it('mantém um UUID válido', () => {
    const id = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';
    expect(requestIdFrom(id)).toBe(id);
  });

  it('troca por um novo o que tem quebra de linha, é grande demais, tem caracteres inválidos ou falta', () => {
    for (const bad of ['3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f\r\n[FAKE]', 'a'.repeat(500), 'id com espaço', '<script>', '', undefined, ['x']]) {
      const id = requestIdFrom(bad);
      expect(id).toMatch(UUID);
      expect(id).not.toBe(bad);
    }
  });
});
