import { WikiSeason } from '../../application/ports/IWikiClient';
import { CharacterPhoto, ParticipantRole } from '../../domain/entities';

/**
 * Lê o wikitext da página de um participante na wiki Fandom de The Traitors
 * (ex.: https://thetraitors.fandom.com/wiki/Dorinda_Medley). O infobox {{Contestant}} traz
 * uma temporada por grupo de campos (season, faction, status...; season2, faction2...);
 * a seção "Game History" diz em que episódio cada participação terminou.
 */

export interface WikiParticipant {
  name: string;
  seasons: WikiSeason[];
  otherShows: string[];
  /** Arquivos de imagem da wiki com a legenda (a url é resolvida depois). */
  images: { file: string; label: string | null }[];
}

const COUNTRIES: Record<string, string> = {
  US: 'EUA',
  UK: 'Reino Unido',
  AU: 'Austrália',
  CA: 'Canadá',
  NZ: 'Nova Zelândia',
  IE: 'Irlanda',
  FR: 'França',
  DE: 'Alemanha',
  NL: 'Holanda',
  BE: 'Bélgica',
  ES: 'Espanha',
  IT: 'Itália',
  BR: 'Brasil',
  MX: 'México',
  IN: 'Índia',
  ZA: 'África do Sul',
};

const STATUS: Record<string, string> = {
  murdered: 'Assassinado(a)',
  banished: 'Banido(a)',
  winner: 'Venceu',
  'runner-up': 'Finalista',
  finalist: 'Finalista',
  withdrew: 'Desistiu',
  withdrawn: 'Desistiu',
  left: 'Deixou o jogo',
  ejected: 'Expulso(a)',
  eliminated: 'Eliminado(a)',
};

/** "US4" → "EUA · 4ª temporada". */
export function seasonLabel(code: string): string {
  const match = /^([A-Z]{2,3})(\d+)$/.exec(code.trim());
  if (!match) return code.trim();
  const [, country, number] = match;
  return `${COUNTRIES[country] ?? country} · ${number}ª temporada`;
}

/** Tira a marcação da wiki: links, negrito/itálico, tags e modelos simples. */
export function plain(value: string): string {
  return value
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\{\{V2?\|([^}]+)\}\}/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/'{2,}/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Os campos do infobox {{Contestant ...}}: `| chave=valor` (o valor pode ter várias linhas). */
export function infobox(wikitext: string): Record<string, string> {
  const start = wikitext.indexOf('{{Contestant');
  if (start < 0) return {};
  // Acha o fim do modelo contando as chaves abertas.
  let depth = 0;
  let end = wikitext.length;
  for (let i = start; i < wikitext.length - 1; i++) {
    const two = wikitext.slice(i, i + 2);
    if (two === '{{') {
      depth++;
      i++;
    } else if (two === '}}') {
      depth--;
      i++;
      if (depth === 0) {
        end = i - 1;
        break;
      }
    }
  }
  const body = wikitext.slice(start + '{{Contestant'.length, end);
  const fields: Record<string, string> = {};
  let key: string | null = null;
  for (const line of body.split('\n')) {
    const field = /^\s*\|\s*([\w-]+)\s*=(.*)$/.exec(line);
    if (field) {
      key = field[1].toLowerCase();
      fields[key] = field[2].trim();
    } else if (key) {
      fields[key] += `\n${line}`;
    }
  }
  return fields;
}

function roleOf(faction: string): { role: ParticipantRole | null; roleDetail: string | null } {
  const text = plain(faction);
  const traitor = /traitor/i.test(text);
  const faithful = /faithful/i.test(text);
  if (traitor && faithful) {
    const from = /traitors?\s*\(from episode (\d+)\)/i.exec(text);
    return { role: 'RECRUITED', roleDetail: from ? `Recrutado(a): Traidor(a) a partir do episódio ${from[1]}` : 'Recrutado(a) pelos Traidores' };
  }
  if (traitor) return { role: 'TRAITOR', roleDetail: /secret/i.test(text) ? 'Traidor(a) Secreto(a)' : null };
  if (faithful) return { role: 'FAITHFUL', roleDetail: null };
  return { role: null, roleDetail: text || null };
}

function fateOf(status: string, episode: number | null): string | null {
  const text = plain(status);
  if (!text) return null;
  const translated = STATUS[text.toLowerCase()] ?? text;
  if (!episode || /venceu|finalista/i.test(translated)) return translated;
  return `${translated} no episódio ${episode}`;
}

function placementOf(placed: string): string | null {
  const match = /(\d+)\s*\/\s*(\d+)/.exec(plain(placed));
  return match ? `${match[1]}º de ${match[2]}` : plain(placed) || null;
}

function number(value: string | undefined): number | null {
  const match = /\d+/.exec(plain(value ?? ''));
  return match ? Number(match[0]) : null;
}

/** "Murdered: Episode 9", "Banished: Episode 3"... na ordem das temporadas da seção Game History. */
function exitEpisodes(wikitext: string): number[] {
  const history = wikitext.split(/==\s*Game History\s*==/i)[1] ?? '';
  return [...history.matchAll(/'''''[^':]+:\s*Episode\s*(\d+)'''''/gi)].map((m) => Number(m[1]));
}

/** Legenda de foto da wiki ("US Season 4") ou prefixo do arquivo ("US4 Eric Nam.webp") → rótulo em português. */
function photoLabel(file: string, caption: string | null): string | null {
  const fromCaption = caption ? /\b([A-Z]{2,3})\s+Season\s+(\d+)/i.exec(caption) : null;
  if (fromCaption) return seasonLabel(`${fromCaption[1].toUpperCase()}${fromCaption[2]}`);
  const fromFile = /^([A-Z]{2,3}\d+)\s/.exec(file);
  if (fromFile) return seasonLabel(fromFile[1]);
  return caption?.trim() || null;
}

function imagesOf(value: string | undefined): WikiParticipant['images'] {
  if (!value) return [];
  const lines = value
    .replace(/<\/?gallery[^>]*>/gi, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\.(webp|png|jpe?g|gif)\b/i.test(l));
  return lines.map((line) => {
    const [file, caption] = line.replace(/^\[\[(?:File|Ficheiro|Arquivo):/i, '').replace(/\]\]$/, '').split('|');
    return { file: file.trim(), label: photoLabel(file.trim(), caption ?? null) };
  });
}

/** Interpreta a página inteira do participante. */
export function parseParticipant(title: string, wikitext: string): WikiParticipant {
  const fields = infobox(wikitext);
  const exits = exitEpisodes(wikitext);
  const seasons: WikiSeason[] = [];
  for (let n = 1; n <= 20; n++) {
    const suffix = n === 1 ? '' : String(n);
    const raw = fields[`season${suffix}`];
    if (raw === undefined) {
      if (n > 1) break;
      continue;
    }
    const code = /\{\{V2?\|([A-Z]{2,3}\d+)\}\}/.exec(raw)?.[1] ?? (/^[A-Z]{2,3}\d+$/.test(plain(raw)) ? plain(raw) : null);
    const { role, roleDetail } = roleOf(fields[`faction${suffix}`] ?? '');
    seasons.push({
      code,
      label: code ? seasonLabel(code) : plain(raw) || `Temporada ${n}`,
      role,
      roleDetail,
      fate: fateOf(fields[`status${suffix}`] ?? '', exits[seasons.length] ?? null),
      placement: placementOf(fields[`placed${suffix}`] ?? ''),
      shieldWins: number(fields[`shield_wins${suffix}`]),
      episodes: number(fields[`episodes_lasted${suffix}`]),
    });
  }
  const otherShows = plain(fields.known_for ?? '')
    .split(/\n|;|,\s(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { name: title, seasons, otherShows, images: imagesOf(fields.image1 ?? fields.image) };
}

/** Fotos resolvidas (arquivo → url), na ordem do infobox. */
export function photosFrom(images: WikiParticipant['images'], urls: ReadonlyMap<string, string>): CharacterPhoto[] {
  return images.flatMap((img) => {
    const url = urls.get(img.file);
    return url ? [{ url, label: img.label }] : [];
  });
}
