import { useState, type SubmitEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Field, Select, TextArea } from '../../../components/ui/Form';
import type { PhrasePhase, PhraseTone } from '../../../domain/enums';
import { phrasePhaseLabel, phraseToneHint, phraseToneLabel } from '../../../domain/labels';
import type { Behavior, Phrase, Player } from '../../../domain/models';
import { fillTemplate, PHRASE_MAX_LENGTH, slotsOf, validatePhrase } from '../../../domain/phrases';
import type { PhraseInput } from '../../../services/api/PhraseService';
import styles from './Phrases.module.css';
import { fireAndForget } from '../../../lib/async';

// Nomes fictícios só para a prévia.
const SAMPLE_NAMES = ['Isla', 'Hamish', 'Morag', 'Fergus', 'Ailsa', 'Callum', 'Kirsty', 'Angus'];
const samplePlayers = SAMPLE_NAMES.map((name) => ({ id: name, name }) as Player);
const SAMPLE_VICTIM = 'Duncan';

interface PhraseFormProps {
  initial?: Phrase;
  /** Momento sugerido para uma frase nova. */
  defaultPhase?: PhrasePhase;
  behaviors: Behavior[];
  pending?: boolean;
  onSubmit: (input: PhraseInput) => Promise<boolean>;
  onCancel?: () => void;
}

export function PhraseForm({ initial, defaultPhase = 'BREAKFAST', behaviors, pending, onSubmit, onCancel }: Readonly<PhraseFormProps>) {
  const [phase, setPhase] = useState<PhrasePhase>(initial?.phase ?? defaultPhase);
  const [tone, setTone] = useState<PhraseTone>(initial?.tone ?? 'NEUTRAL');
  const [behaviorId, setBehaviorId] = useState(initial?.behaviorId ?? '');
  const [text, setText] = useState(initial?.text ?? '');
  const error = validatePhrase(text);
  const previewText = text.trim().replaceAll('{victim}', SAMPLE_VICTIM);
  const preview = previewText && !error ? fillTemplate(previewText, samplePlayers.slice(0, slotsOf(previewText).length)) : null;

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (await onSubmit({ phase, tone, behaviorId: behaviorId || null, text: text.trim() })) {
      if (!initial) setText('');
    }
  }

  return (
    <form className={styles.form} onSubmit={fireAndForget(handleSubmit)}>
      <div className={styles.selects}>
        <Field label="Momento">
          {(id) => (
            <Select id={id} value={phase} onChange={(e) => setPhase(e.target.value as PhrasePhase)}>
              {Object.entries(phrasePhaseLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Teor">
          {(id) => (
            <Select id={id} value={tone} onChange={(e) => setTone(e.target.value as PhraseTone)}>
              {Object.entries(phraseToneLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Mais dita por">
          {(id) => (
            <Select id={id} value={behaviorId} onChange={(e) => setBehaviorId(e.target.value)}>
              <option value="">Qualquer personagem</option>
              {behaviors.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <p className={styles.toneHint}>{phraseToneHint[tone]}</p>

      <Field label="Frase" hint="{user} fala · {user1}, {user2}... são outras pessoas · {victim} é quem acabou de sair (só nas automáticas)">
        {(id) => <TextArea id={id} rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder='{user} olhou para {user1}: "Eu sei o que você fez."' maxLength={PHRASE_MAX_LENGTH} />}
      </Field>

      {error && <p className={styles.error}>{error}</p>}
      {preview && (
        <p className={styles.preview}>
          {preview.map((part, i) => (part.kind === 'text' ? <span key={i}>{part.text}</span> : <strong key={i}>{part.player.name}</strong>))}
        </p>
      )}

      <div className={styles.actions}>
        {onCancel && (
          <Button variant="quiet" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" pending={pending} disabled={!text.trim() || !!error}>
          {initial ? 'Salvar alterações' : 'Salvar frase'}
        </Button>
      </div>
    </form>
  );
}
