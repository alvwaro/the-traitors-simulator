import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../../shared/errors/AppError';

/**
 * Tratamento central de erros (o Express reconhece o middleware de erro pelos 4 parâmetros).
 * Validação e erros de regra viram 400/404/409; o resto vira 500 sem detalhes para o cliente.
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
  console.error(err);
  res.status(500).json({ error: 'InternalServerError' });
};
