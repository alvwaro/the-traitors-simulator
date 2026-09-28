import { IUseCase } from '../../contracts/IUseCase';
import { IUnitOfWork } from '../../ports/IUnitOfWork';
import { RegisterPhaseNotesInput } from '../../dtos/GameDTOs';
import { DayPhase, DayPhaseProps } from '../../../domain/entities';
import { loadActiveGame } from '../../services/gameGuards';

/** Anota interações/acontecimentos da fase atual (chegada, café da manhã...). */
export class RegisterPhaseNotesUseCase implements IUseCase<RegisterPhaseNotesInput, DayPhaseProps> {
  constructor(private readonly uow: IUnitOfWork) {}

  execute(input: RegisterPhaseNotesInput): Promise<DayPhaseProps> {
    return this.uow.run(async (repos) => {
      const { day, phase } = await loadActiveGame(repos, input.seasonId);
      const dayPhase = (await repos.days.findPhase(day.id, phase)) ?? DayPhase.start(day.id, phase);
      dayPhase.writeNotes(input.notes);
      await repos.days.savePhase(dayPhase);
      return dayPhase.toJSON();
    });
  }
}
