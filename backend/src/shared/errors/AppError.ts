export class AppError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} não encontrado(a): ${id}`, 404);
  }
}

/** Banco fora do ar, credenciais erradas ou migrações não aplicadas. */
export class DatabaseUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** Precisa estar logado. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Entre na sua conta para continuar') {
    super(message, 401);
  }
}

/** Logado, mas sem permissão para isso. */
export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para isso') {
    super(message, 403);
  }
}
