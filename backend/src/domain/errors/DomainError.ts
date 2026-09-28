import { AppError } from '../../shared/errors/AppError';

/** Violação de regra do jogo (ex.: banir alguém já eliminado). */
export class DomainError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}
