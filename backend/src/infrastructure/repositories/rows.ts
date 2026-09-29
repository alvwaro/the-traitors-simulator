import { RelationshipProps } from '../../domain/simulation/RelationshipMatrix';
import { Queryable } from '../database/connection';
import { query } from '../database/query';

/**
 * Tags de comportamento ligadas a um registro (personagem ou jogador) numa tabela de ligação
 * (`table`, com a coluna `owner` apontando o registro, mais behavior_id). Nomes vêm só do código.
 */
export class BehaviorLinks {
  constructor(
    private readonly table: 'player_behaviors' | 'character_behaviors',
    private readonly owner: 'player_id' | 'character_id',
  ) {}

  /** Coluna "behavior_ids" com as tags do registro `alias`, em ordem alfabética do nome. */
  column(alias: string): string {
    return `COALESCE(ARRAY(SELECT l.behavior_id FROM ${this.table} l
                             JOIN behaviors b ON b.id = l.behavior_id
                            WHERE l.${this.owner} = ${alias}.id ORDER BY lower(b.name)), '{}') AS behavior_ids`;
  }

  /** Troca todas as tags do registro. */
  async replace(db: Queryable, ownerId: string, behaviorIds: readonly string[]): Promise<void> {
    await query(db, `DELETE FROM ${this.table} WHERE ${this.owner} = $1`, [ownerId]);
    if (behaviorIds.length === 0) return;
    await query(db, `INSERT INTO ${this.table} (${this.owner}, behavior_id) SELECT $1, unnest($2::uuid[])`, [ownerId, behaviorIds]);
  }
}

export const PLAYER_BEHAVIORS = new BehaviorLinks('player_behaviors', 'player_id');
export const CHARACTER_BEHAVIORS = new BehaviorLinks('character_behaviors', 'character_id');

/** Linha de relacionamento (de jogadores ou de personagens de um cast), com as colunas de origem/destino renomeadas. */
export interface RelationshipRow {
  from_id: string;
  to_id: string;
  trust: number;
  liking: number;
  hatred: number;
  allied: boolean;
}

export const RELATIONSHIP_FEELINGS = 'trust, liking, hatred, allied';

export const toRelationship = (r: RelationshipRow): RelationshipProps => ({
  fromId: r.from_id,
  toId: r.to_id,
  trust: r.trust,
  liking: r.liking,
  hatred: r.hatred,
  allied: r.allied,
});
