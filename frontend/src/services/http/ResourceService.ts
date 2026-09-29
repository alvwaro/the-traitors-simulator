import type { IHttpClient } from './HttpClient';

/**
 * Recurso REST com as operações de sempre sob um caminho (/behaviors, /characters...):
 * listar, criar, alterar e apagar. Os serviços acrescentam só o que é próprio do recurso.
 */
export abstract class ResourceService<T, Input> {
  protected constructor(
    protected readonly http: IHttpClient,
    protected readonly path: string,
  ) {}

  /** Caminho de um item (e, opcionalmente, de algo dentro dele: "/relationships"). */
  protected itemPath(id: string, suffix = ''): string {
    return `${this.path}/${id}${suffix}`;
  }

  protected listWhere(query?: Record<string, string | undefined>): Promise<T[]> {
    return this.http.get<T[]>(this.path, query);
  }

  create(input: Input): Promise<T> {
    return this.http.post<T>(this.path, input);
  }

  update(id: string, input: Partial<Input>): Promise<T> {
    return this.http.patch<T>(this.itemPath(id), input);
  }

  remove(id: string): Promise<void> {
    return this.http.delete(this.itemPath(id));
  }
}
