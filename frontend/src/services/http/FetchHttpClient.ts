import { ApiError, type IHttpClient } from './HttpClient';

interface ErrorBody {
  message?: string;
  error?: string;
  issues?: { path?: (string | number)[]; message: string }[];
  /** Id da requisição que falhou no servidor (o mesmo do log). */
  requestId?: string;
}

/** Mensagens para quando a resposta de erro não vem da API (ex.: o gateway ou o balanceador respondendo). */
const STATUS_MESSAGES: Record<number, string> = {
  429: 'Muitas tentativas. Espere um pouco e tente de novo.',
  502: 'O servidor está indisponível no momento. Tente de novo em instantes.',
  503: 'O servidor está indisponível no momento. Tente de novo em instantes.',
  504: 'O servidor demorou demais para responder. Tente de novo.',
};

/** Corpo da resposta: JSON quando der; qualquer outra coisa (HTML de um proxy, texto vazio) vira undefined. */
function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
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
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError('Não foi possível falar com o servidor. O backend está rodando?', 0);
    }

    const data = parseBody(await response.text());
    if (!response.ok) throw new ApiError(this.messageFrom(data as ErrorBody | undefined, response.status), response.status);
    return data as T;
  }

  private messageFrom(body: ErrorBody | undefined, status: number): string {
    if (body?.issues?.length) {
      return body.issues.map((i) => (i.path?.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
    }
    if (!body?.message && body?.requestId) return `Algo deu errado no servidor (código ${body.requestId.slice(0, 8)}).`;
    return body?.message ?? STATUS_MESSAGES[status] ?? body?.error ?? `Erro ${status}`;
  }
}
