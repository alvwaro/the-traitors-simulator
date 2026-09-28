import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Field, Input } from '../../../components/ui/Form';
import { Modal } from '../../../components/ui/Modal';
import { useAction } from '../../../hooks/useAction';
import { fireAndForget } from '../../../lib/async';

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
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
          <Button pending={save.pending} disabled={!name.trim()} onClick={fireAndForget(async () => (await save.run()) && onClose())}>
            Salvar cast
          </Button>
        </>
      }
    >
      <Field label="Nome do cast">
        {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />}
      </Field>
    </Modal>
  );
}
