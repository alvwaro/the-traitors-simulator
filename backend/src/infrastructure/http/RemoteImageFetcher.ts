import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { AppError } from '../../shared/errors/AppError';

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Faixas da própria máquina/rede local: o proxy só busca imagens públicas (proteção contra SSRF). */
const PRIVATE_RANGES = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) PRIVATE_RANGES.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, 'ipv6');
}

export interface RemoteImage {
  contentType: string;
  body: Buffer;
}

/** Endereço IPv4 embutido em IPv6 (::ffff:127.0.0.1) é checado como IPv4. */
function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return PRIVATE_RANGES.check(mapped[1], 'ipv4');
  return PRIVATE_RANGES.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

/** Garante que a URL é http(s) e que o host resolve só para endereços públicos. */
async function assertPublicUrl(url: URL): Promise<void> {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new AppError('Só links http(s) são aceitos');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new AppError('Endereço não encontrado');
  if (addresses.some(isPrivateAddress)) throw new AppError('Endereço não permitido');
}

/**
 * Baixa uma imagem pública pelo servidor. Usado para gerar a arte do Instagram:
 * o navegador não pode ler pixels de imagens de outros sites sem CORS.
 * Os redirecionamentos são seguidos manualmente para validar cada destino.
 */
export class RemoteImageFetcher {
  async fetch(rawUrl: string): Promise<RemoteImage> {
    const response = await this.request(new URL(rawUrl));
    if (!response.ok) throw new AppError(`A imagem respondeu ${response.status}`, 502);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) throw new AppError('O link não é uma imagem', 415);
    if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new AppError('Imagem grande demais', 413);

    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > MAX_BYTES) throw new AppError('Imagem grande demais', 413);
    return { contentType, body };
  }

  private async request(initial: URL): Promise<Response> {
    let url = initial;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicUrl(url);
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual' }).catch(() => {
        throw new AppError('Não foi possível baixar a imagem', 502);
      });
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) return response;
      url = new URL(location, url);
    }
    throw new AppError('Redirecionamentos demais', 502);
  }
}
