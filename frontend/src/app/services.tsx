import { createContext, useContext, type ReactNode } from 'react';
import { config } from '../config/env';
import { FetchHttpClient } from '../services/http/FetchHttpClient';
import type { IHttpClient } from '../services/http/HttpClient';
import { CastService, type ICastService } from '../services/api/CastService';
import { CharacterService, type ICharacterService } from '../services/api/CharacterService';
import { GameService, type IGameService } from '../services/api/GameService';
import { PhaseService, type IPhaseService } from '../services/api/PhaseService';
import { PhraseService, type IPhraseService } from '../services/api/PhraseService';
import { PlayerService, type IPlayerService } from '../services/api/PlayerService';
import { SeasonService, type ISeasonService } from '../services/api/SeasonService';
import { BehaviorService, type IBehaviorService } from '../services/api/BehaviorService';
import { SimulationService, type ISimulationService } from '../services/api/SimulationService';
import { PublicationService, type IPublicationService } from '../services/api/PublicationService';
import { AuthService, type IAuthService } from '../services/api/AuthService';
import { EditionService, type IEditionService } from '../services/api/EditionService';

/** Tudo que os componentes podem usar para falar com a API (só interfaces). */
export interface Services {
  characters: ICharacterService;
  casts: ICastService;
  seasons: ISeasonService;
  players: IPlayerService;
  game: IGameService;
  phases: IPhaseService;
  phrases: IPhraseService;
  behaviors: IBehaviorService;
  simulation: ISimulationService;
  publications: IPublicationService;
  auth: IAuthService;
  editions: IEditionService;
}

// Composition root do frontend.
export function createServices(http: IHttpClient = new FetchHttpClient(config.apiBaseUrl)): Services {
  return {
    characters: new CharacterService(http),
    casts: new CastService(http),
    seasons: new SeasonService(http),
    players: new PlayerService(http),
    game: new GameService(http),
    phases: new PhaseService(http),
    phrases: new PhraseService(http),
    behaviors: new BehaviorService(http),
    simulation: new SimulationService(http),
    publications: new PublicationService(http),
    auth: new AuthService(http),
    editions: new EditionService(http),
  };
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: Readonly<{ services: Services; children: ReactNode }>) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices precisa estar dentro de <ServicesProvider>');
  return services;
}
