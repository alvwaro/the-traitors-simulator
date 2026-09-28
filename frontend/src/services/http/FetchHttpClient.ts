import { ApiError, type IHttpClient } from './HttpClient';

interface ErrorBody {
  message?: string;
  error?: string;
  issues?: { path?: (string | number)[]; message: string }[];
}

export class FetchHttpClient implements IHttpClient {
  constructor(private readonly baseUrl: string) {}

  get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
    const params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => value && params.set(key, value));
    const suffix = params.size ? `?${params}` : '';
    return this.request<T>('GET', `${path}${suffix}`);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete(path: string): Promise<void> {
    await this.request<void>('DELETE', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Não foi possível falar com o servidor. O backend está rodando?', 0);
    }

    const text = await response.text();
    const data: unknown = text ? JSON.parse(text) : undefined;
    if (!response.ok) throw new ApiError(this.messageFrom(data as ErrorBody | undefined, response.status), response.status);
    return data as T;
  }

  private messageFrom(body: ErrorBody | undefined, status: number): string {
    if (body?.issues?.length) {
      return body.issues.map((i) => (i.path?.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
    }
    return body?.message ?? body?.error ?? `Erro ${status}`;
  }
}
