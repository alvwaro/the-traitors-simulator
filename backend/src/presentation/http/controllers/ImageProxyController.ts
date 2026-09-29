import { RemoteImageFetcher } from '../../../infrastructure/http/RemoteImageFetcher';
import { Handlers, RoutesOf } from '../endpoint';
import { imageProxyQuery } from '../validators/schemas';

/** Repassa imagens externas com a mesma origem do site (para desenhar a arte do Instagram). */
export function imageProxyController(fetcher: RemoteImageFetcher): Handlers<RoutesOf<'imageProxy'>> {
  return {
    'imageProxy.get': async (req, res) => {
      const { url } = imageProxyQuery.parse(req.query);
      const image = await fetcher.fetch(url);
      res.set('Content-Type', image.contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      // A resposta é uma imagem de outro site: nada de ser interpretada como página ou script.
      res.set('Content-Security-Policy', "default-src 'none'; sandbox");
      res.send(image.body);
    },
  };
}
