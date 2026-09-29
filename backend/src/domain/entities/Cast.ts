import { randomUUID } from 'node:crypto';
import { requiredText, uniqueIds } from './values';

export interface CastProps {
  id: string;
  name: string;
  description: string | null;
  /** Foto de capa opcional (a biblioteca mostra a capa em vez de todo o elenco). */
  imageUrl: string | null;
  characterIds: string[]; // em ordem
  createdAt: Date;
  /** Quem criou o cast (Minha Área). Null só em registros anteriores às contas. */
  ownerId: string | null;
}

/** Elenco salvo: um grupo nomeado de personagens para iniciar temporadas. */
export class Cast {
  constructor(private readonly props: CastProps) {}

  static create(input: { name: string; ownerId: string; description?: string | null; imageUrl?: string | null; characterIds?: string[] }): Cast {
    const cast = new Cast({
      id: randomUUID(),
      name: '',
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      characterIds: [],
      createdAt: new Date(),
      ownerId: input.ownerId,
    });
    cast.rename(input.name);
    cast.setMembers(input.characterIds ?? []);
    return cast;
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get ownerId(): string | null { return this.props.ownerId; }
  get characterIds(): readonly string[] { return this.props.characterIds; }

  rename(name: string): void {
    this.props.name = requiredText(name, 'O nome do cast é obrigatório');
  }

  describe(description: string | null): void {
    this.props.description = description;
  }

  changeImage(imageUrl: string | null): void {
    this.props.imageUrl = imageUrl;
  }

  setMembers(characterIds: string[]): void {
    this.props.characterIds = uniqueIds(characterIds);
  }

  toJSON(): CastProps { return { ...this.props, characterIds: [...this.props.characterIds] }; }
}
