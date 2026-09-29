import { IUseCase } from '../contracts/IUseCase';
import { SeasonIdInput } from '../dtos/SeasonDTOs';
import { IUnitOfWork, Repositories } from '../ports/IUnitOfWork';

/**
 * Temporadas manuais: guarda o estado antes de um registro, para o botão "voltar" poder desfazê-lo.
 * `label` diz o que vai ser desfeito (ex.: "Registro da mesa redonda").
 */
export async function rememberForUndo(repos: Repositories, seasonId: string, label: string): Promise<void> {
  const season = await repos.seasons.findById(seasonId);
  if (season && !season.isAutomatic() && season.isInProgress()) await repos.snapshots.capture(seasonId, label);
}

/**
 * Template Method dos registros de uma temporada em andamento (fases, avanço, desistência, prêmio):
 * `execute` abre a transação, guarda o estado anterior (para o "voltar") e chama `record`, que tem só a regra.
 * A simulação automática chama `record` direto, dentro da transação dela (as mesmas regras do modo manual).
 */
export abstract class UndoableRecord<I extends SeasonIdInput, O> implements IUseCase<I, O> {
  /** O que o "voltar" vai desfazer (aparece para o usuário). */
  protected abstract readonly undoLabel: string;

  constructor(protected readonly uow: IUnitOfWork) {}

  execute(input: I): Promise<O> {
    return this.uow.run(async (repos) => {
      await rememberForUndo(repos, input.seasonId, this.undoLabel);
      return this.record(repos, input);
    });
  }

  /** A regra do registro, dentro de uma transação já aberta. */
  abstract record(repos: Repositories, input: I): Promise<O>;
}
