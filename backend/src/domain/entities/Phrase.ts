import { randomUUID } from 'node:crypto';
import { PhrasePhase, PhraseTone } from '../enums';
import { DomainError } from '../errors/DomainError';

export interface PhraseProps {
  id: string;
  phase: PhrasePhase;
  tone: PhraseTone;
  /** Personagens com este comportamento têm mais chance de dizer a frase. */
  behaviorId: string | null;
  text: string;
  createdAt: Date;
}

export const PHRASE_MAX_LENGTH = 400;
const VALID_TOKEN = /^\{(user\d*|victim)\}$/;

/**
 * Modelo de fala usada nas conversas simuladas.
 * Cada marcador diferente ({user}, {user1}, {user2}...) é uma pessoa diferente;
 * o mesmo marcador repetido na frase é sempre a mesma pessoa.
 * {victim} é quem acabou de sair do jogo (só na simulação automática).
 */
export class Phrase {
  constructor(private readonly props: PhraseProps) {}

  static create(input: { phase: PhrasePhase; text: string; tone?: PhraseTone; behaviorId?: string | null }): Phrase {
    const phrase = new Phrase({
      id: randomUUID(),
      phase: input.phase,
      tone: input.tone ?? PhraseTone.NEUTRAL,
      behaviorId: input.behaviorId ?? null,
      text: '',
      createdAt: new Date(),
    });
    phrase.rewrite(input.text);
    return phrase;
  }

  get id(): string { return this.props.id; }
  get phase(): PhrasePhase { return this.props.phase; }
  get tone(): PhraseTone { return this.props.tone; }
  get behaviorId(): string | null { return this.props.behaviorId; }
  get text(): string { return this.props.text; }

  rewrite(text: string): void {
    this.props.text = Phrase.validate(text);
  }

  moveTo(phase: PhrasePhase): void {
    this.props.phase = phase;
  }

  retone(tone: PhraseTone): void {
    this.props.tone = tone;
  }

  linkBehavior(behaviorId: string | null): void {
    this.props.behaviorId = behaviorId;
  }

  /** Confere tamanho e marcadores; devolve o texto limpo. */
  static validate(raw: string): string {
    const text = raw.trim();
    if (!text) throw new DomainError('A frase não pode ficar vazia');
    if (text.length > PHRASE_MAX_LENGTH) throw new DomainError(`A frase pode ter no máximo ${PHRASE_MAX_LENGTH} caracteres`);

    const invalid = (text.match(/\{[^}]*\}?/g) ?? []).find((token) => !VALID_TOKEN.test(token));
    if (invalid) throw new DomainError(`Marcador inválido: ${invalid}. Use {user}, {user1}, {user2}... ou {victim}`);
    if (!/\{user\d*\}/.test(text)) throw new DomainError('A frase precisa de pelo menos um {user}');
    return text;
  }

  toJSON(): PhraseProps { return { ...this.props }; }
}
