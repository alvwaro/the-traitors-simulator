/**
 * Defesa contra CSRF pela origem da requisição (OWASP "Verifying Origin With Standard Headers").
 * O navegador sempre informa de onde vem um POST/PATCH/DELETE (Origin e Sec-Fetch-Site): o que vem de outro site
 * é recusado, mesmo que o cookie da sessão tenha ido junto. Clientes que não são navegador (sem esses cabeçalhos)
 * não carregam o cookie de ninguém, então passam.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface OriginHeaders {
  method: string;
  /** Host pedido (com a porta), ex.: "localhost:5173". */
  host: string | undefined;
  origin: string | undefined;
  secFetchSite: string | undefined;
}

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/**
 * A requisição muda dados e veio de uma página de outro site?
 * `allowedOrigins`: origens extras aceitas (ex.: o site servido de outro domínio), no formato "https://site.com".
 */
export function isCrossSiteWrite(headers: OriginHeaders, allowedOrigins: readonly string[] = []): boolean {
  if (SAFE_METHODS.has(headers.method.toUpperCase())) return false;
  const { origin, secFetchSite } = headers;
  if (origin) {
    if (allowedOrigins.includes(origin)) return false;
    const host = hostOf(origin);
    return host === null || host !== headers.host;
  }
  // Sem Origin (navegadores antigos ou clientes de API): vale o Sec-Fetch-Site, quando existe.
  return secFetchSite === 'cross-site';
}
