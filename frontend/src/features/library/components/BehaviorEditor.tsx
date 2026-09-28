import { useState, type SubmitEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Field, FormRow, Input } from '../../../components/ui/Form';
import { EFFECT_GROUPS, EFFECT_LIMIT, type BehaviorEffectKey } from '../../../domain/behaviors';
import type { Behavior, BehaviorEffects } from '../../../domain/models';
import type { BehaviorInput } from '../../../services/api/BehaviorService';
import styles from './Behaviors.module.css';
import { fireAndForget } from '../../../lib/async';

interface BehaviorEditorProps {
  initial?: Behavior;
  pending?: boolean;
  onSubmit: (input: BehaviorInput) => Promise<boolean>;
  onCancel: () => void;
  onDelete?: () => void;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** Nome, descrição e o quanto a tag mexe em cada relacionamento e atributo. */
export function BehaviorEditor({ initial, pending, onSubmit, onCancel, onDelete }: Readonly<BehaviorEditorProps>) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [effects, setEffects] = useState<BehaviorEffects>(initial?.effects ?? {});

  const set = (key: BehaviorEffectKey, value: number) => setEffects((e) => ({ ...e, [key]: value }));
  const loyalty = clamp(50 + (effects.loyalty ?? 0));

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const clean = Object.fromEntries(Object.entries(effects).filter(([, v]) => v)) as BehaviorEffects;
    await onSubmit({ name: name.trim(), description: description.trim() || null, effects: clean });
  }

  return (
    <form className={styles.editor} onSubmit={fireAndForget(handleSubmit)}>
      <FormRow>
        <Field label="Nome">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Ex.: Vingativo" />}</Field>
        <Field label="Descrição">{(id) => <Input id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Como esse personagem joga" />}</Field>
      </FormRow>

      {EFFECT_GROUPS.map((group) => (
        <fieldset key={group.title} className={styles.group}>
          <legend className={styles.groupTitle}>{group.title}</legend>
          <p className={styles.groupLead}>{group.lead}</p>
          {group.effects.map((effect) => {
            const value = effects[effect.key] ?? 0;
            return (
              <label key={effect.key} className={styles.slider}>
                <span className={styles.sliderLabel}>{effect.label}</span>
                <input type="range" min={-EFFECT_LIMIT} max={EFFECT_LIMIT} step={5} value={value} onChange={(e) => set(effect.key, Number(e.target.value))} />
                <span className={signClass(value)}>{value > 0 ? `+${value}` : value}</span>
                <span className={styles.sliderHint}>{effect.description}</span>
              </label>
            );
          })}
        </fieldset>
      ))}

      <p className={styles.example}>
        Exemplo: sozinha, esta tag deixa a lealdade em <strong>{loyalty}</strong>. Com 90% de confiança em alguém, a chance de propor aliança a essa pessoa é de{' '}
        <strong>{Math.round(0.9 * loyalty)}%</strong> por dia.
      </p>

      <div className={styles.actions}>
        {onDelete && (
          <Button variant="danger" onClick={onDelete}>
            Excluir
          </Button>
        )}
        <span className={styles.spacer} />
        <Button variant="quiet" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" pending={pending} disabled={!name.trim()}>
          {initial ? 'Salvar comportamento' : 'Criar comportamento'}
        </Button>
      </div>
    </form>
  );
}

/** Cor do valor do efeito: positivo, negativo ou neutro. */
function signClass(value: number): string {
  if (value > 0) return styles.plus;
  return value < 0 ? styles.minus : styles.zero;
}
