import { IUseCase } from '../../contracts/IUseCase';
import { SeasonProps } from '../../../domain/entities';
import { ISeasonRepository } from '../../../domain/repositories';
import { OwnerInput } from '../../dtos/LibraryDTOs';

/** Temporadas da Minha Área. */
export class ListSeasonsUseCase implements IUseCase<OwnerInput, SeasonProps[]> {
  constructor(private readonly seasons: ISeasonRepository) {}

  async execute(input: OwnerInput): Promise<SeasonProps[]> {
    const seasons = await this.seasons.findAll(input.ownerId);
    return seasons.map((s) => s.toJSON());
  }
}
