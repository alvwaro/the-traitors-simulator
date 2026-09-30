import { randomUUID } from 'node:crypto';
import { DomainError } from '../errors/DomainError';
import { requiredText, uniqueIds } from './values';

export interface CastProps {
  id: string;
  name: string;
  description: string | null;
  /** Foto de capa opcional (a biblioteca mostra a capa em vez de todo o elenco). */
  imageUrl: string | null;
  characterIds: string[]; // em ordem
  /** Foto de cada personagem neste cast (quem não está aqui usa a foto principal). */
  memberImages: Record<string, string>;
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
      memberImages: {},
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
    // Quem saiu do cast leva embora a foto escolhida para ele aqui.
    const kept = new Set(this.props.characterIds);
    this.props.memberImages = Object.fromEntries(Object.entries(this.props.memberImages).filter(([id]) => kept.has(id)));
  }

  /** A foto do personagem neste cast (null volta a usar a principal). */
  setMemberImage(characterId: string, imageUrl: string | null): void {
    if (!this.props.characterIds.includes(characterId)) throw new DomainError('O personagem não faz parte deste cast');
    const url = imageUrl?.trim() || null;
    if (url && !/^https?:\/\//i.test(url)) throw new DomainError('A foto precisa de um link http(s)://');
    const images = { ...this.props.memberImages };
    if (url) images[characterId] = url;
    else delete images[characterId];
    this.props.memberImages = images;
  }

  /** A foto que o personagem usa neste cast. */
  imageOf(character: { id: string; imageUrl: string | null }): string | null {
    return this.props.memberImages[character.id] ?? character.imageUrl;
  }

  toJSON(): CastProps { return { ...this.props, characterIds: [...this.props.characterIds], memberImages: { ...this.props.memberImages } }; }
}
