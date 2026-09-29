import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Tratamento central de erros (o Express reconhece o middleware de erro pelos 4 parâmetros).
 * Validação e erros de regra viram 400/404/409; o resto vira 500 sem detalhes para o cliente,
 * só com o id da requisição (o mesmo do log) para achar o problema.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // Resposta já começou a ser enviada: quem encerra é o Express.
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'ValidationError', issues: err.issues });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.name, message: err.message });
    return;
  }
  // Corpo JSON malformado ou grande demais (o express.json marca o status no erro).
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: 'BadRequest', message: 'Corpo da requisição inválido' });
    return;
  }
  const requestId = res.locals.requestId;
  console.error(`[erro ${requestId ?? '-'}]`, err);
  res.status(500).json({ error: 'InternalServerError', requestId });
};
