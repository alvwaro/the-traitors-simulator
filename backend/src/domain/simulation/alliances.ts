import { RelationshipMatrix } from './RelationshipMatrix';

/** Uma aliança tem de 2 a 5 pessoas. */
export const MIN_ALLIANCE = 2;
export const MAX_ALLIANCE = 5;
/** Em quantas alianças diferentes a mesma pessoa pode estar ao mesmo tempo. */
export const MAX_ALLIANCES_PER_PLAYER = 3;

/** Um grupo de aliados. A mesma pessoa pode estar em vários grupos, com gente diferente em cada um. */
export interface AllianceGroup {
  id: string;
  memberIds: string[];
}

/** Onde as alianças ficam guardadas entre as fases (a memória da simulação na temporada). */
export interface AllianceStore {
  alliances?: AllianceGroup[];
}

/**
 * As alianças da temporada. Cada aliança é um grupo próprio: estar com Ana numa aliança
 * e com Caio em outra não faz Ana e Caio aliados.
 * O "aliado" da matriz (usado nos votos e sentimentos) passa a valer para quem divide pelo menos uma aliança.
 * Toda mudança é gravada em `store`.
 */
export class AllianceBook {
  private groups: AllianceGroup[];

  constructor(
    private readonly matrix: RelationshipMatrix,
    private readonly store: AllianceStore,
    activeIds: readonly string[],
  ) {
    const active = new Set(activeIds);
    this.groups = (store.alliances ?? [])
      .map((g) => ({ id: g.id, memberIds: g.memberIds.filter((id) => active.has(id)) }))
      .filter((g) => g.memberIds.length >= MIN_ALLIANCE);
    this.absorbLoosePairs(activeIds);
    this.save();
  }

  /** Alianças de alguém. */
  of(playerId: string): AllianceGroup[] {
    return this.groups.filter((g) => g.memberIds.includes(playerId));
  }

  get(groupId: string): AllianceGroup | undefined {
    return this.groups.find((g) => g.id === groupId);
  }

  /** Alianças que duas pessoas dividem. */
  shared(a: string, b: string): AllianceGroup[] {
    return this.groups.filter((g) => g.memberIds.includes(a) && g.memberIds.includes(b));
  }

  /** Todos os aliados de alguém, somando todas as alianças. */
  allies(playerId: string): string[] {
    return [...new Set(this.of(playerId).flatMap((g) => g.memberIds))].filter((id) => id !== playerId);
  }

  /** Ainda cabe em mais uma aliança. */
  canJoin(playerId: string): boolean {
    return this.of(playerId).length < MAX_ALLIANCES_PER_PLAYER;
  }

  /** Cria uma aliança nova (de 2 a 5, cada um com espaço para mais uma). */
  create(memberIds: readonly string[]): AllianceGroup | null {
    const members = [...new Set(memberIds)];
    if (members.length < MIN_ALLIANCE || members.length > MAX_ALLIANCE || !members.every((id) => this.canJoin(id))) return null;
    const group = { id: this.nextId(), memberIds: members };
    this.groups.push(group);
    this.sync(members);
    return group;
  }

  /** Entra numa aliança que já existe. */
  join(groupId: string, playerId: string): boolean {
    const group = this.get(groupId);
    if (!group || group.memberIds.includes(playerId) || group.memberIds.length >= MAX_ALLIANCE || !this.canJoin(playerId)) return false;
    group.memberIds.push(playerId);
    this.sync(group.memberIds);
    return true;
  }

  /**
   * Sai de toda aliança que divide com `otherId` (votar num aliado, acusar um aliado...).
   * As outras alianças de quem saiu continuam. Devolve quem eram os colegas nessas alianças.
   */
  leaveWith(playerId: string, otherId: string): string[] {
    const left = this.shared(playerId, otherId);
    const former = [...new Set(left.flatMap((g) => g.memberIds))].filter((id) => id !== playerId);
    for (const group of left) group.memberIds = group.memberIds.filter((id) => id !== playerId);
    this.dissolveSmall();
    this.sync([playerId, ...former]);
    return former;
  }

  /** Quem saiu do jogo sai de todas as alianças (grupos que ficam com uma pessoa só acabam). */
  removePlayer(playerId: string): void {
    const former = this.allies(playerId);
    for (const group of this.of(playerId)) group.memberIds = group.memberIds.filter((id) => id !== playerId);
    this.dissolveSmall();
    this.sync([playerId, ...former]);
  }

  toJSON(): AllianceGroup[] {
    return this.groups.map((g) => ({ id: g.id, memberIds: [...g.memberIds] }));
  }

  private dissolveSmall(): void {
    this.groups = this.groups.filter((g) => g.memberIds.length >= MIN_ALLIANCE);
  }

  /** "Aliado" na matriz = divide pelo menos uma aliança. */
  private sync(ids: readonly string[]): void {
    const people = [...new Set(ids)];
    for (const a of people) {
      for (const b of people) {
        if (a < b) this.matrix.setAllied(a, b, this.shared(a, b).length > 0);
      }
    }
    this.save();
  }

  private save(): void {
    this.store.alliances = this.toJSON();
  }

  /**
   * Aliados sem aliança registrada (temporadas antigas, ajuste manual, cast) viram alianças:
   * o par cresce com quem é aliado de todos (até 5), como um grupo que já andava junto.
   */
  private absorbLoosePairs(activeIds: readonly string[]): void {
    for (const a of activeIds) {
      for (const b of activeIds) {
        if (a >= b || !this.matrix.isAllied(a, b) || this.shared(a, b).length > 0) continue;
        const members = [a, b];
        for (const c of activeIds) {
          if (members.length >= MAX_ALLIANCE) break;
          if (!members.includes(c) && members.every((m) => this.matrix.isAllied(m, c))) members.push(c);
        }
        this.groups.push({ id: this.nextId(), memberIds: members });
      }
    }
  }

  private nextId(): string {
    const max = Math.max(0, ...this.groups.map((g) => Number(g.id.replace(/\D/g, '')) || 0));
    return `a${max + 1}`;
  }
}
