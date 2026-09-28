import type { EditionsGuide } from '../../domain/models';
import type { IHttpClient } from '../http/HttpClient';

export interface IEditionService {
  guide(): Promise<EditionsGuide>;
}

/** Guia das temporadas do programa (missões e reviravoltas de cada versão). */
export class EditionService implements IEditionService {
  constructor(private readonly http: IHttpClient) {}

  guide() {
    return this.http.get<EditionsGuide>('/editions');
  }
}
