import { useEffect, useState } from 'react';
import { useServices } from '../../../app/services';
import { Field, Input } from '../../../components/ui/Form';
import { ConfirmModal, Modal, ModalActions } from '../../../components/ui/Modal';
import type { Season } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { PrizeFields, type PrizeDraft } from './PrizeFields';
import styles from '../pages/Seasons.module.css';

interface SeasonModalProps {
  season: Season;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const draftOf = (season: Season): PrizeDraft => ({
  currency: season.currency,
  initialPrizePot: String(season.initialPrizePot),
  maxPrizePot: season.maxPrizePot === null ? '' : String(season.maxPrizePot),
});

/** Edita a temporada: o nome sempre; o prêmio só antes dos portões se abrirem. */
export function EditSeasonModal({ season, open, onClose, onDone }: Readonly<SeasonModalProps>) {
  const { seasons } = useServices();
  const [name, setName] = useState(season.name);
  const [prize, setPrize] = useState<PrizeDraft>(() => draftOf(season));
  const inSetup = season.status === 'SETUP';

  useEffect(() => {
    if (!open) return;
    setName(season.name);
    setPrize(draftOf(season));
  }, [open, season]);

  const save = useAction(
    () =>
      seasons.update(
        season.id,
        inSetup
          ? {
              name: name.trim(),
              currency: prize.currency,
              initialPrizePot: Number(prize.initialPrizePot || 0),
              maxPrizePot: prize.maxPrizePot ? Number(prize.maxPrizePot) : null,
            }
          : { name: name.trim() },
      ),
    { success: 'Temporada atualizada' },
  );

  async function handleSave() {
    if (await save.run()) {
      onClose();
      onDone();
    }
  }

  return (
    <Modal
      open={open}
      title="Editar temporada"
      onClose={onClose}
      footer={<ModalActions onCancel={onClose} confirmLabel="Salvar" pending={save.pending} disabled={!name.trim()} onConfirm={handleSave} />}
    >
      <div className={styles.formStack}>
        <Field label="Nome">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} data-autofocus />}</Field>
        {inSetup ? (
          <PrizeFields value={prize} onChange={setPrize} />
        ) : (
          <p className={styles.summary}>O prêmio não pode mais ser alterado: a temporada já começou.</p>
        )}
      </div>
    </Modal>
  );
}

/** Confirma e apaga a temporada com todo o registro dela. */
export function DeleteSeasonModal({ season, open, onClose, onDone }: Readonly<SeasonModalProps>) {
  const { seasons } = useServices();
  const remove = useAction(
    async () => {
      await seasons.remove(season.id);
      return true;
    },
    { success: 'Temporada apagada' },
  );

  async function handleDelete() {
    if (await remove.run()) {
      onClose();
      onDone();
    }
  }

  return (
    <ConfirmModal open={open} title="Apagar temporada" onClose={onClose} confirmLabel="Apagar para sempre" danger pending={remove.pending} onConfirm={handleDelete}>
      <p>"{season.name}" e todo o seu registro serão apagados. Personagens e casts da biblioteca não são afetados.</p>
    </ConfirmModal>
  );
}
