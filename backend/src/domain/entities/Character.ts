import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors/DomainError';

export interface CharacterProps {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Comportamentos (tags de personalidade) usados na simulação automática. */
  behaviorIds: string[];
  createdAt: Date;
  /** Quem criou o personagem (Minha Área). Null só em registros anteriores às contas. */
  ownerId: string | null;
}

/** Personagem salvo na biblioteca, reutilizável em várias temporadas. */
export class Character {
  constructor(private readonly props: CharacterProps) {}

  static create(input: { name: string; ownerId: string; imageUrl?: string | null; behaviorIds?: string[] }): Character {
    const character = new Character({ id: randomUUID(), name: '', imageUrl: input.imageUrl ?? null, behaviorIds: [], createdAt: new Date(), ownerId: input.ownerId });
    character.rename(input.name);
    character.setBehaviors(input.behaviorIds ?? []);
    return character;
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get ownerId(): string | null { return this.props.ownerId; }
  get imageUrl(): string | null { return this.props.imageUrl; }
  get behaviorIds(): readonly string[] { return this.props.behaviorIds; }

  rename(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new DomainError('O nome do personagem é obrigatório');
    this.props.name = trimmed;
  }

  changeImage(imageUrl: string | null): void {
    this.props.imageUrl = imageUrl;
  }

  setBehaviors(behaviorIds: readonly string[]): void {
    this.props.behaviorIds = [...new Set(behaviorIds)];
  }

  toJSON(): CharacterProps { return { ...this.props, behaviorIds: [...this.props.behaviorIds] }; }
}
