import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/presentation/http/middlewares/errorHandler';
import { requestId } from '../../src/presentation/http/middlewares/requestId';

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const ID = '3f2b8c1e-9d4a-4c6b-8e2f-1a2b3c4d5e6f';

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeRes(locals: Record<string, unknown> = {}) {
  const res = { locals, headersSent: false, headers: {} as Record<string, string>, statusCode: 200, body: undefined as unknown };
  return Object.assign(res, {
    set: (name: string, value: string) => ((res.headers[name] = value), res),
    status: (code: number) => ((res.statusCode = code), res),
    json: (body: unknown) => ((res.body = body), res),
  });
}

describe('requestId', () => {
  const idFor = (header: string | undefined) => {
    const res = fakeRes();
    requestId({ get: () => header } as unknown as Request, res as unknown as Response, (() => undefined) as NextFunction);
    expect(res.headers['x-request-id']).toBe(res.locals.requestId);
    return res.locals.requestId as string;
  };

  it('mantém o id válido vindo do gateway', () => {
    expect(idFor(ID)).toBe(ID);
  });

  it('troca por um novo o id com quebra de linha, grande demais ou com caracteres inválidos', () => {
    for (const bad of [`${ID}\r\n[FAKE] linha forjada`, 'a'.repeat(500), 'id;com<coisas>', undefined]) {
      const id = idFor(bad);
      expect(id).toMatch(UUID);
      expect(id).not.toBe(bad);
    }
  });
});

describe('errorHandler', () => {
  it('loga o erro inesperado numa linha só de JSON, sem as quebras forjadas', () => {
    const logs = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = fakeRes({ requestId: ID });
    const req = { method: 'GET', path: '/api/x\r\n[FAKE] linha forjada' } as unknown as Request;
    errorHandler(new Error('quebrou em /api/x\r\n[FAKE] linha forjada'), req, res as unknown as Response, (() => undefined) as NextFunction);

    expect(logs).toHaveBeenCalledTimes(1);
    const [line] = logs.mock.calls[0];
    expect(typeof line).toBe('string');
    expect(line).not.toMatch(/[\r\n\p{Zl}\p{Zp}]/u);
    expect(JSON.parse(line as string)).toMatchObject({
      level: 'error',
      requestId: ID,
      method: 'GET',
      path: '/api/x[FAKE] linha forjada',
      error: { name: 'Error', message: 'quebrou em /api/x[FAKE] linha forjada' },
    });
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'InternalServerError', requestId: ID });
  });
});
