import { randomUUID } from 'node:crypto';
import { PlayerRole, PlayerStatus } from '../enums';
import { DomainError } from '../errors/DomainError';

export interface PlayerProps {
  id: string;
  seasonId: string;
  characterId: string | null;
  /** O participante controlado pelo usuário (modo Jogador). */
  isHuman: boolean;
  name: string;
  imageUrl: string | null;
  /** Cópia das tags de personalidade do personagem (simulação automática). */
  behaviorIds: string[];
  role: PlayerRole;
  isOriginalTraitor: boolean;
  status: PlayerStatus;
  eliminatedDayId: string | null;
  createdAt: Date;
  /** Só na leitura: banido(a) na reta final, sem revelar o papel à mesa (o papel aparece no fim do jogo). */
  roleHidden?: boolean;
  /** Só na leitura: quem está olhando também não sabe o papel (o participante, no modo Jogador). */
  roleUnknown?: boolean;
}

export type EliminationStatus = Exclude<PlayerStatus, PlayerStatus.ACTIVE>;

export class Player {
  constructor(private readonly props: PlayerProps) {}

  static create(input: {
    seasonId: string;
    name: string;
    imageUrl?: string | null;
    role?: PlayerRole;
    characterId?: string | null;
    behaviorIds?: readonly string[];
    isHuman?: boolean;
  }): Player {
    const player = new Player({
      id: randomUUID(),
      seasonId: input.seasonId,
      characterId: input.characterId ?? null,
      isHuman: input.isHuman ?? false,
      name: '',
      imageUrl: input.imageUrl ?? null,
      behaviorIds: [...new Set(input.behaviorIds ?? [])],
      role: PlayerRole.FAITHFUL,
      isOriginalTraitor: false,
      status: PlayerStatus.ACTIVE,
      eliminatedDayId: null,
      createdAt: new Date(),
    });
    player.rename(input.name);
    player.assignRole(input.role ?? PlayerRole.FAITHFUL);
    return player;
  }

  get id(): string { return this.props.id; }
  get seasonId(): string { return this.props.seasonId; }
  get characterId(): string | null { return this.props.characterId; }
  get isHuman(): boolean { return this.props.isHuman; }
  get name(): string { return this.props.name; }
  get imageUrl(): string | null { return this.props.imageUrl; }
  get behaviorIds(): readonly string[] { return this.props.behaviorIds; }
  get role(): PlayerRole { return this.props.role; }
  get isOriginalTraitor(): boolean { return this.props.isOriginalTraitor; }
  get status(): PlayerStatus { return this.props.status; }
  get eliminatedDayId(): string | null { return this.props.eliminatedDayId; }

  isActive(): boolean { return this.props.status === PlayerStatus.ACTIVE; }
  isTraitor(): boolean { return this.props.role === PlayerRole.TRAITOR; }

  rename(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new DomainError('O nome do jogador é obrigatório');
    this.props.name = trimmed;
  }

  changeImage(imageUrl: string | null): void {
    this.props.imageUrl = imageUrl;
  }

  setBehaviors(behaviorIds: readonly string[]): void {
    this.props.behaviorIds = [...new Set(behaviorIds)];
  }

  linkCharacter(characterId: string): void {
    this.props.characterId = characterId;
  }

  /** Seleção inicial (dia 1): quem recebe TRAITOR aqui é traidor original. */
  assignRole(role: PlayerRole): void {
    this.ensureActive();
    this.props.role = role;
    this.props.isOriginalTraitor = role === PlayerRole.TRAITOR;
  }

  /** Recrutado pelos traidores: vira traidor, mas não original. */
  recruit(): void {
    this.ensureActive();
    if (this.isTraitor()) throw new DomainError(`${this.name} já é traidor(a)`);
    this.props.role = PlayerRole.TRAITOR;
    this.props.isOriginalTraitor = false;
  }

  eliminate(status: EliminationStatus, dayId: string): void {
    this.ensureActive();
    this.props.status = status;
    this.props.eliminatedDayId = dayId;
  }

  private ensureActive(): void {
    if (!this.isActive()) throw new DomainError(`${this.name} já foi eliminado(a)`);
  }

  toJSON(): PlayerProps { return { ...this.props, behaviorIds: [...this.props.behaviorIds] }; }
}
