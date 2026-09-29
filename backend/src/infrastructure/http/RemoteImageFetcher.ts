import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { get as httpGet, type IncomingMessage } from 'node:http';
import { get as httpsGet } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { AppError } from '../../shared/errors/AppError';
import { isPublicAddress } from './ipAddress';

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export interface RemoteImage {
  contentType: string;
  body: Buffer;
}

export interface RemoteImageFetcherOptions {
  /** Quais endereços IP podem ser acessados (padrão: só os públicos da internet). */
  allowAddress?: (address: string) => boolean;
  maxBytes?: number;
  timeoutMs?: number;
}

class BlockedAddressError extends AppError {
  constructor() {
    super('Endereço não permitido');
  }
}

/**
 * Resolução de nomes usada pelo próprio socket: o IP é conferido na hora de conectar, então um DNS que muda
 * de resposta entre a checagem e a conexão (DNS rebinding) não consegue apontar para a rede interna.
 */
function guardedLookup(allow: (address: string) => boolean): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...(options as LookupOptions), all: true }, (err, found) => {
      const addresses = (found ?? []) as LookupAddress[];
      if (err) return callback(err, '', 0);
      if (addresses.length === 0 || !addresses.every((a) => allow(a.address))) return callback(new BlockedAddressError(), '', 0);
      if ((options as LookupOptions).all) return (callback as unknown as (e: null, list: LookupAddress[]) => void)(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

/** Lê o corpo sem passar do limite (não confia no Content-Length: conta o que chega). */
async function readLimited(response: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) {
      response.destroy();
      throw new AppError('Imagem grande demais', 413);
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Baixa uma imagem pública pelo servidor. Usado para gerar a arte do Instagram:
 * o navegador não pode ler pixels de imagens de outros sites sem CORS.
 * Proteções contra SSRF: só http(s), só endereços públicos (conferidos no momento da conexão),
 * redirecionamentos seguidos um a um (cada destino passa pelas mesmas regras), tempo e tamanho limitados.
 */
export class RemoteImageFetcher {
  private readonly allow: (address: string) => boolean;
  private readonly lookup: LookupFunction;
  private readonly maxBytes: number;
  private readonly timeoutMs: number;

  constructor(options: RemoteImageFetcherOptions = {}) {
    this.allow = options.allowAddress ?? isPublicAddress;
    this.lookup = guardedLookup(this.allow);
    this.maxBytes = options.maxBytes ?? MAX_BYTES;
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  }

  async fetch(rawUrl: string): Promise<RemoteImage> {
    const response = await this.follow(new URL(rawUrl));
    const status = response.statusCode ?? 0;
    if (status < 200 || status >= 300) {
      response.resume();
      throw new AppError(`A imagem respondeu ${status}`, 502);
    }
    const contentType = response.headers['content-type'] ?? '';
    if (!contentType.startsWith('image/')) {
      response.resume();
      throw new AppError('O link não é uma imagem', 415);
    }
    if (Number(response.headers['content-length'] ?? 0) > this.maxBytes) {
      response.destroy();
      throw new AppError('Imagem grande demais', 413);
    }
    return { contentType, body: await readLimited(response, this.maxBytes) };
  }

  private async follow(initial: URL): Promise<IncomingMessage> {
    let url = initial;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await this.request(url);
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status < 300 || status >= 400 || !location) return response;
      response.resume();
      url = new URL(location, url);
    }
    throw new AppError('Redirecionamentos demais', 502);
  }

  private request(url: URL): Promise<IncomingMessage> {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return Promise.reject(new AppError('Só links http(s) são aceitos'));
    // Endereço IP direto no link não passa pela resolução de nomes: confere aqui.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && !this.allow(host)) return Promise.reject(new BlockedAddressError());

    const get = url.protocol === 'https:' ? httpsGet : httpGet;
    return new Promise((resolve, reject) => {
      const request = get(url, { lookup: this.lookup, timeout: this.timeoutMs, headers: { accept: 'image/*' } }, resolve);
      request.on('timeout', () => request.destroy(new AppError('A imagem demorou demais para responder', 504)));
      request.on('error', (err) => reject(err instanceof AppError ? err : new AppError('Não foi possível baixar a imagem', 502)));
    });
  }
}
