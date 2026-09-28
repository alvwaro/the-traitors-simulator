import { Repositories } from '../ports/IUnitOfWork';

/**
 * Temporadas manuais: guarda o estado antes de um registro, para o botão "voltar" poder desfazê-lo.
 * `label` diz o que vai ser desfeito (ex.: "Registro da mesa redonda").
 */
export async function rememberForUndo(repos: Repositories, seasonId: string, label: string): Promise<void> {
  const season = await repos.seasons.findById(seasonId);
  if (season && !season.isAutomatic() && season.isInProgress()) await repos.snapshots.capture(seasonId, label);
}
