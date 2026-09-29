import { useState, type ReactNode } from 'react';
import { Check } from '../../../components/ui/Form';
import { Modal, ModalActions } from '../../../components/ui/Modal';
import type { Relationship } from '../../../domain/models';
import { Meter } from './Meter';
import styles from './FeelingsEditor.module.css';

/** O que um lado da relação sente pelo outro. */
export type Feelings = Omit<Relationship, 'fromId' | 'toId'>;

/** Ponto de partida de um par ainda sem relação definida. */
export const NEUTRAL_FEELINGS: Feelings = { trust: 50, liking: 50, hatred: 10, allied: false };

/** Confiança, simpatia e ódio lado a lado. */
export function FeelingMeters({ feelings }: Readonly<{ feelings: Feelings }>) {
  return (
    <>
      <Meter value={feelings.trust} tone="trust" label="Confiança" />
      <Meter value={feelings.liking} tone="liking" label="Simpatia" />
      <Meter value={feelings.hatred} tone="hatred" label="Ódio" />
    </>
  );
}

function FeelingSlider({ label, value, onChange }: Readonly<{ label: string; value: number; onChange: (value: number) => void }>) {
  return (
    <label className={styles.slider}>
      <span>{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <strong>{value}%</strong>
    </label>
  );
}

interface FeelingsEditorProps {
  from: { name: string };
  to: { name: string };
  initial: Feelings;
  pending: boolean;
  onClose: () => void;
  onSave: (feelings: Feelings) => unknown;
  /** Ações extras no rodapé (ex.: voltar a sortear o par). */
  extra?: ReactNode;
}

/** Ajuste manual do que um personagem sente por outro (no cast ou numa temporada). */
export function FeelingsEditor({ from, to, initial, pending, onClose, onSave, extra }: Readonly<FeelingsEditorProps>) {
  // Só os sentimentos (a relação completa também traz os ids do par, que não mudam aqui).
  const [feelings, setFeelings] = useState<Feelings>({ trust: initial.trust, liking: initial.liking, hatred: initial.hatred, allied: initial.allied });
  const change = (key: 'trust' | 'liking' | 'hatred') => (value: number) => setFeelings((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open
      title={`O que ${from.name} sente por ${to.name}`}
      onClose={onClose}
      footer={<ModalActions onCancel={onClose} confirmLabel="Salvar" pending={pending} onConfirm={() => onSave(feelings)} extra={extra} />}
    >
      <div className={styles.fields}>
        <FeelingSlider label="Confiança" value={feelings.trust} onChange={change('trust')} />
        <FeelingSlider label="Gosta" value={feelings.liking} onChange={change('liking')} />
        <FeelingSlider label="Ódio" value={feelings.hatred} onChange={change('hatred')} />
        <Check
          label={`Aliança entre ${from.name} e ${to.name} (vale para os dois)`}
          checked={feelings.allied}
          onChange={(e) => setFeelings((current) => ({ ...current, allied: e.target.checked }))}
        />
      </div>
    </Modal>
  );
}
