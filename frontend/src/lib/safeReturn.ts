/**
 * Só aceita voltar para caminhos do próprio site (evita redirecionamento para fora). O caminho é lido como
 * o navegador leria: "//outro.site" e "/\outro.site" apontam para outro site e são recusados.
 */
export function safeReturn(path: string | null, origin: string = globalThis.location.origin): string {
  if (!path?.startsWith('/')) return '/';
  const url = new URL(path, origin);
  return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : '/';
}
