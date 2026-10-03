/**
 * Consultas leves de posse, usadas pela política de acesso (sem carregar os agregados inteiros).
 * undefined = o registro não existe.
 */
export interface IAccessRepository {
  seasonOwner(seasonId: string): Promise<string | null | undefined>;
  castOwner(castId: string): Promise<string | null | undefined>;
  characterOwner(characterId: string): Promise<string | null | undefined>;
  /** Passa para o dono tudo que foi criado antes das contas (sem dono). */
  claimOrphans(ownerId: string): Promise<void>;
}
