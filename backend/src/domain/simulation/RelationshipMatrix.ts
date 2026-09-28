import { clamp, Rng } from './random';
import { SimPlayer } from './traits';

/** O que um jogador sente por outro (0 a 100) e se são aliados. */
export interface Feeling {
  trust: number;
  liking: number;
  hatred: number;
  allied: boolean;
}

export interface RelationshipProps extends Feeling {
  fromId: string;
  toId: string;
}

export type FeelingDelta = Partial<Record<'trust' | 'liking' | 'hatred', number>>;

const NEUTRAL: Feeling = { trust: 50, liking: 50, hatred: 10, allied: false };

/**
 * Relacionamentos direcionais de toda a temporada ("A confia 80% em B" não implica o contrário).
 * Guarda quais pares mudaram para gravar só o necessário.
 */
export class RelationshipMatrix {
  private readonly feelings = new Map<string, Feeling>();
  private readonly dirty = new Set<string>();

  constructor(entries: readonly RelationshipProps[] = []) {
    for (const e of entries) {
      this.feelings.set(key(e.fromId, e.toId), { trust: e.trust, liking: e.liking, hatred: e.hatred, allied: e.allied });
    }
  }

  has(fromId: string, toId: string): boolean {
    return this.feelings.has(key(fromId, toId));
  }

  get(fromId: string, toId: string): Feeling {
    return this.feelings.get(key(fromId, toId)) ?? NEUTRAL;
  }

  /** Suspeita = o contrário da confiança. */
  suspicion(fromId: string, toId: string): number {
    return 100 - this.get(fromId, toId).trust;
  }

  set(fromId: string, toId: string, feeling: Partial<Feeling>): void {
    if (fromId === toId) return;
    const current = this.get(fromId, toId);
    this.feelings.set(key(fromId, toId), {
      trust: Math.round(clamp(feeling.trust ?? current.trust)),
      liking: Math.round(clamp(feeling.liking ?? current.liking)),
      hatred: Math.round(clamp(feeling.hatred ?? current.hatred)),
      allied: feeling.allied ?? current.allied,
    });
    this.dirty.add(key(fromId, toId));
  }

  /** Soma (ou subtrai) nos sentimentos de A por B, multiplicando por `scale`. */
  adjust(fromId: string, toId: string, delta: FeelingDelta, scale = 1): void {
    if (fromId === toId) return;
    const current = this.get(fromId, toId);
    this.set(fromId, toId, {
      trust: current.trust + (delta.trust ?? 0) * scale,
      liking: current.liking + (delta.liking ?? 0) * scale,
      hatred: current.hatred + (delta.hatred ?? 0) * scale,
    });
  }

  /** Aliança vale nos dois sentidos. */
  setAllied(a: string, b: string, allied: boolean): void {
    this.set(a, b, { allied });
    this.set(b, a, { allied });
  }

  isAllied(a: string, b: string): boolean {
    return this.get(a, b).allied && this.get(b, a).allied;
  }

  alliesOf(playerId: string, among: readonly string[]): string[] {
    return among.filter((id) => id !== playerId && this.isAllied(playerId, id));
  }

  /** Média do que `fromIds` sentem por `toId`. */
  toward(toId: string, fromIds: readonly string[]): { trust: number; liking: number; hatred: number } {
    const others = fromIds.filter((id) => id !== toId);
    if (others.length === 0) return { trust: NEUTRAL.trust, liking: NEUTRAL.liking, hatred: NEUTRAL.hatred };
    const total = others.reduce(
      (acc, id) => {
        const f = this.get(id, toId);
        return { trust: acc.trust + f.trust, liking: acc.liking + f.liking, hatred: acc.hatred + f.hatred };
      },
      { trust: 0, liking: 0, hatred: 0 },
    );
    return { trust: total.trust / others.length, liking: total.liking / others.length, hatred: total.hatred / others.length };
  }

  entries(): RelationshipProps[] {
    return [...this.feelings].map(([k, f]) => ({ ...split(k), ...f }));
  }

  changed(): RelationshipProps[] {
    return [...this.dirty].map((k) => ({ ...split(k), ...this.get(split(k).fromId, split(k).toId) }));
  }
}

function key(fromId: string, toId: string): string {
  return `${fromId}>${toId}`;
}

function split(k: string): { fromId: string; toId: string } {
  const [fromId, toId] = k.split('>');
  return { fromId, toId };
}

/**
 * Primeira impressão de A sobre B (com loucura, parte dela é puro acaso): base + o que A tende a sentir + o que B desperta + acaso.
 * Invejosos (envy) passam a odiar quem desperta muita simpatia.
 */
export function firstImpression(from: SimPlayer, to: SimPlayer, rng: Rng, chaos = 0): Feeling {
  const a = from.traits;
  const b = to.traits;
  const noise = (spread: number) => (rng() * 2 - 1) * spread;
  const envy = a.envy > 0 ? (a.envy / 50) * Math.max(0, b.likeReceived + 10) * 0.8 : 0;
  const mix = (expected: number, randomMax: number) => Math.round(clamp((1 - chaos) * expected + chaos * rng() * randomMax));
  return {
    trust: mix(clamp(50 + a.trustGiven + b.trustReceived - (a.paranoia - 50) * 0.3 + noise(15)), 100),
    liking: mix(clamp(50 + a.likeGiven + b.likeReceived + noise(18)), 100),
    hatred: mix(clamp(8 + a.hateGiven + b.hateReceived + envy + Math.max(0, noise(12))), 70),
    allied: false,
  };
}

/** Cria os pares que ainda não existem entre os jogadores informados. Devolve quantos criou. */
export function fillMissingRelationships(matrix: RelationshipMatrix, players: readonly SimPlayer[], rng: Rng, chaos = 0): number {
  let created = 0;
  for (const from of players) {
    for (const to of players) {
      if (from.id === to.id || matrix.has(from.id, to.id)) continue;
      matrix.set(from.id, to.id, firstImpression(from, to, rng, chaos));
      created++;
    }
  }
  return created;
}
