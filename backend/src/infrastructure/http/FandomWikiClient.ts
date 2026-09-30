import { IWikiClient, WikiParticipantData } from '../../application/ports/IWikiClient';
import { AppError } from '../../shared/errors/AppError';
import { parseParticipant, photosFrom } from './fandomParser';

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;

/** Só páginas de wikis da Fandom: https://<wiki>.fandom.com/wiki/<Página>. */
export function wikiPage(url: string): { host: string; page: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('Link da wiki inválido', 422);
  }
  const page = /^\/(?:[a-z-]+\/)?wiki\/(.+)$/.exec(parsed.pathname)?.[1];
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.fandom\.com$/i.test(parsed.hostname) || !page) {
    throw new AppError('Use o link de uma página da wiki Fandom (ex.: https://thetraitors.fandom.com/wiki/Dorinda_Medley)', 422);
  }
  return { host: parsed.hostname.toLowerCase(), page: decodeURIComponent(page).replaceAll('_', ' ') };
}

/** Lê páginas de participantes pela API do MediaWiki da Fandom (sem raspar o HTML). */
export class FandomWikiClient implements IWikiClient {
  private async api<T>(host: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`https://${host}/api.php`);
    for (const [k, v] of Object.entries({ ...params, format: 'json', formatversion: '2' })) url.searchParams.set(k, v);
    let response: Response;
    try {
      response = await fetch(url, { headers: { 'user-agent': 'TheTraitorsSimulator/1.0' }, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw new AppError('Não foi possível falar com a wiki agora', 502);
    }
    if (!response.ok) throw new AppError(`A wiki respondeu ${response.status}`, 502);
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new AppError('Página da wiki grande demais', 502);
    return JSON.parse(text) as T;
  }

  async participant(url: string): Promise<WikiParticipantData> {
    const { host, page } = wikiPage(url);
    const parsed = await this.api<{ parse?: { title: string; wikitext: string }; error?: { info: string } }>(host, {
      action: 'parse',
      page,
      prop: 'wikitext',
      redirects: '1',
    });
    if (!parsed.parse) throw new AppError('Página não encontrada na wiki', 404);
    const participant = parseParticipant(parsed.parse.title, parsed.parse.wikitext);

    const urls = new Map<string, string>();
    if (participant.images.length) {
      const files = participant.images.map((i) => `File:${i.file}`).join('|');
      const info = await this.api<{ query?: { pages?: { title: string; imageinfo?: { url: string }[] }[] } }>(host, {
        action: 'query',
        titles: files,
        prop: 'imageinfo',
        iiprop: 'url',
      });
      for (const p of info.query?.pages ?? []) {
        const found = p.imageinfo?.[0]?.url;
        if (found) urls.set(p.title.replace(/^File:/, ''), found);
      }
    }
    return {
      wikiUrl: `https://${host}/wiki/${encodeURIComponent(parsed.parse.title.replaceAll(' ', '_'))}`,
      seasons: participant.seasons,
      otherShows: participant.otherShows,
      photos: photosFrom(participant.images, urls),
    };
  }
}
