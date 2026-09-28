import { Request, Response } from 'express';
import { RemoteImageFetcher } from '../../../infrastructure/http/RemoteImageFetcher';
import { imageProxyQuery } from '../validators/schemas';

/** Repassa imagens externas com a mesma origem do site (para desenhar a arte do Instagram). */
export class ImageProxyController {
  constructor(private readonly fetcher: RemoteImageFetcher) {}

  get = async (req: Request, res: Response) => {
    const { url } = imageProxyQuery.parse(req.query);
    const image = await this.fetcher.fetch(url);
    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(image.body);
  };
}
