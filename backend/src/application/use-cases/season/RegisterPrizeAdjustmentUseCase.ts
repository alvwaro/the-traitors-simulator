import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { PrizeAdjustmentInput, PrizeAdjustmentOutput } from '../../dtos/SeasonDTOs';
import { PrizeTransaction } from '../../../domain/entities';
import { PrizeTransactionType } from '../../../domain/enums';
import { DomainError } from '../../../domain/errors/DomainError';
import { loadActiveGame } from '../../services/gameGuards';

/** Penalidades e ajustes manuais no prêmio (fora das missões). */
export class RegisterPrizeAdjustmentUseCase implements IUseCase<PrizeAdjustmentInput, PrizeAdjustmentOutput> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: PrizeAdjustmentInput): Promise<PrizeAdjustmentOutput> {
    return this.uow.run(async (repos) => {
      const { season, day } = await loadActiveGame(repos, input.seasonId);
      const amount = input.type === PrizeTransactionType.PENALTY ? -Math.abs(input.amount) : input.amount;

      const pot = await repos.prizes.getPrizePot(season.id);
      if (pot + amount < 0) throw new DomainError('O prêmio não pode ficar negativo');
      if (season.maxPrizePot !== null && pot + amount > season.maxPrizePot) {
        throw new DomainError(`O prêmio não pode passar de ${season.maxPrizePot}`);
      }

      const transaction = PrizeTransaction.create({
        seasonId: season.id,
        dayId: day.id,
        missionId: null,
        type: input.type,
        amount,
        description: input.description ?? null,
      });
      await repos.prizes.addTransaction(transaction);
      return { transaction: transaction.toJSON(), prizePot: pot + amount };
    });
  }
}
