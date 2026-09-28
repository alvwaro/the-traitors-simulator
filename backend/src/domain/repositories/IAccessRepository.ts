/** Dono e visibilidade de uma temporada, para decidir quem pode ver ou alterar. */
export interface SeasonAccess {
  ownerId: string | null;
  /** Publicada numa área pública: qualquer pessoa pode assistir. */
  published: boolean;
}

/**
 * Consultas leves de posse, usadas pela política de acesso (sem carregar os agregados inteiros).
 * undefined = o registro não existe.
 */
export interface IAccessRepository {
  season(seasonId: string): Promise<SeasonAccess | undefined>;
  castOwner(castId: string): Promise<string | null | undefined>;
  characterOwner(characterId: string): Promise<string | null | undefined>;
  /** Passa para o dono tudo que foi criado antes das contas (sem dono). */
  claimOrphans(ownerId: string): Promise<void>;
}
