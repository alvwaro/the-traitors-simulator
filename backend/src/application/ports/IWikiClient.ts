import { CharacterPhoto, ParticipantSeason } from '../../domain/entities';

/** Uma temporada lida da wiki, com o código do programa (US4, UK2) para ligar à temporada do site. */
export interface WikiSeason extends Omit<ParticipantSeason, 'seasonId'> {
  code: string | null;
}

/** O que a página do participante na wiki diz sobre ele. */
export interface WikiParticipantData {
  /** Endereço canônico da página. */
  wikiUrl: string;
  seasons: WikiSeason[];
  otherShows: string[];
  photos: CharacterPhoto[];
}

/** Busca as informações de um participante numa wiki (Fandom). */
export interface IWikiClient {
  participant(url: string): Promise<WikiParticipantData>;
}
