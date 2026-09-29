import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Field, Input } from '../../../components/ui/Form';
import { Modal, ModalActions } from '../../../components/ui/Modal';
import { useAction } from '../../../hooks/useAction';

interface SaveAsCastModalProps {
  open: boolean;
  seasonId: string;
  defaultName: string;
  onClose: () => void;
}

/** Guarda o elenco da temporada como cast; jogadores sem ficha viram personagens da biblioteca. */
export function SaveAsCastModal({ open, seasonId, defaultName, onClose }: Readonly<SaveAsCastModalProps>) {
  const { seasons } = useServices();
  const [name, setName] = useState(defaultName);
  const save = useAction(() => seasons.saveAsCast(seasonId, { name: name.trim() }), {
    success: (cast) => `Cast "${cast.name}" salvo com ${cast.characters.length} personagens`,
  });

  return (
    <Modal
      open={open}
      title="Salvar elenco como cast"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel="Salvar cast"
          pending={save.pending}
          disabled={!name.trim()}
          onConfirm={async () => (await save.run()) && onClose()}
        />
      }
    >
      <Field label="Nome do cast">
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} data-autofocus />}
      </Field>
    </Modal>
  );
}
