import { RequestHandler } from 'express';
import { REQUEST_ID_HEADER, requestIdFrom } from '@traitors/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      /** Id da requisição (vem do gateway ou é criado aqui): aparece nos logs e na resposta. */
      requestId?: string;
    }
  }
}

/** Reaproveita o id que o gateway mandou (se for um UUID) para cruzar os logs das duas pontas. */
export const requestId: RequestHandler = (req, res, next) => {
  const id = requestIdFrom(req.get(REQUEST_ID_HEADER));
  res.locals.requestId = id;
  res.set(REQUEST_ID_HEADER, id);
  next();
};
