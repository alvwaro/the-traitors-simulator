import { BehaviorEffects } from './Behavior';

/** Comportamento guardado pelo conteúdo: quem copia recebe o mesmo efeito mesmo sem ter a tag. */
export interface PublishedBehavior {
  name: string;
  description: string | null;
  effects: BehaviorEffects;
}

export interface PublishedCharacter {
  /** Identifica o personagem dentro da publicação (usado nos relacionamentos). */
  key: string;
  name: string;
  imageUrl: string | null;
  behaviors: PublishedBehavior[];
}

export interface PublishedRelationship {
  fromKey: string;
  toKey: string;
  trust: number;
  liking: number;
  hatred: number;
  allied: boolean;
}

/** Cópia congelada de um elenco (um cast inteiro ou um personagem só). */
export interface PublishedSnapshot {
  characters: PublishedCharacter[];
  relationships: PublishedRelationship[];
}
