import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { RemoteImageFetcher } from '../../src/infrastructure/http/RemoteImageFetcher';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const servers: Server[] = [];

/** Sobe um servidor local de teste e devolve o endereço base (http://localhost:porta). */
async function serve(handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://localhost:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((resolve) => s.close(resolve))));
});

/** Nos testes o "site externo" é a própria máquina: libera o loopback só aqui. */
const local = (options: ConstructorParameters<typeof RemoteImageFetcher>[0] = {}) => new RemoteImageFetcher({ allowAddress: () => true, ...options });

describe('RemoteImageFetcher', () => {
  it('baixa a imagem e segue redirecionamentos', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/antiga.png') {
        res.writeHead(302, { location: '/foto.png' }).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'image/png' }).end(PNG);
    });
    const image = await local().fetch(`${base}/antiga.png`);
    expect(image.contentType).toBe('image/png');
    expect(image.body.equals(PNG)).toBe(true);
  });

  it('recusa o que não é imagem, respostas de erro e redirecionamentos demais', async () => {
    const base = await serve((req, res) => {
      if (req.url === '/pagina') res.writeHead(200, { 'content-type': 'text/html' }).end('<html></html>');
      else if (req.url === '/sumiu') res.writeHead(404).end();
      else res.writeHead(302, { location: '/loop' }).end();
    });
    await expect(local().fetch(`${base}/pagina`)).rejects.toMatchObject({ statusCode: 415 });
    await expect(local().fetch(`${base}/sumiu`)).rejects.toMatchObject({ statusCode: 502 });
    await expect(local().fetch(`${base}/loop`)).rejects.toMatchObject({ message: 'Redirecionamentos demais' });
  });

  it('para de baixar quando passa do tamanho máximo (com ou sem Content-Length)', async () => {
    const big = Buffer.alloc(64, 1);
    const base = await serve((req, res) => {
      const headers: Record<string, string> = { 'content-type': 'image/png' };
      if (req.url === '/declarada') headers['content-length'] = String(big.length);
      res.writeHead(200, headers);
      res.end(big);
    });
    const fetcher = local({ maxBytes: 16 });
    await expect(fetcher.fetch(`${base}/declarada`)).rejects.toMatchObject({ statusCode: 413 });
    await expect(fetcher.fetch(`${base}/escondida`)).rejects.toMatchObject({ statusCode: 413 });
  });

  it('desiste de quem demora demais para responder', async () => {
    const base = await serve(() => undefined);
    await expect(local({ timeoutMs: 50 }).fetch(`${base}/lenta.png`)).rejects.toMatchObject({ statusCode: 504 });
  });

  it('por padrão só acessa endereços públicos (nem pelo nome, nem por redirecionamento)', async () => {
    const internal = await serve((_req, res) => res.writeHead(200, { 'content-type': 'image/png' }).end(PNG));
    const fetcher = new RemoteImageFetcher();
    // "localhost" resolve para a própria máquina: a checagem acontece na conexão.
    await expect(fetcher.fetch(`${internal}/foto.png`)).rejects.toMatchObject({ message: 'Endereço não permitido' });
    await expect(fetcher.fetch('http://127.0.0.1/foto.png')).rejects.toMatchObject({ message: 'Endereço não permitido' });
    await expect(fetcher.fetch('http://[::1]/foto.png')).rejects.toMatchObject({ message: 'Endereço não permitido' });

    // Um site liberado não consegue mandar o servidor para um endereço barrado por redirecionamento.
    const port = new URL(internal).port;
    const redirector = await serve((_req, res) => res.writeHead(302, { location: `http://[::1]:${port}/foto.png` }).end());
    const onlyRedirector = new RemoteImageFetcher({ allowAddress: (address) => address === '127.0.0.1' });
    await expect(onlyRedirector.fetch(redirector.replace('localhost', '127.0.0.1'))).rejects.toMatchObject({ message: 'Endereço não permitido' });
  });

  it('aceita só links http(s) e avisa quando o site não existe', async () => {
    await expect(local().fetch('ftp://example.com/foto.png')).rejects.toMatchObject({ message: 'Só links http(s) são aceitos' });
    await expect(local().fetch('http://nao-existe.invalid/foto.png')).rejects.toMatchObject({ statusCode: 502 });
  });
});
