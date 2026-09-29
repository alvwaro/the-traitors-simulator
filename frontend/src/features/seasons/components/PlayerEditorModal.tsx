import { useEffect, useState } from 'react';
import { useServices } from '../../../app/services';
import { TagPicker } from '../../../components/behavior/BehaviorTags';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { IdentityFields } from '../../../components/player/IdentityFields';
import { Field, Select } from '../../../components/ui/Form';
import { Modal, ModalActions } from '../../../components/ui/Modal';
import type { PlayerRole } from '../../../domain/enums';
import type { Player } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import type { UpdatePlayerInput } from '../../../services/api/PlayerService';
import styles from './Setup.module.css';
import { fireAndForget } from '../../../lib/async';

interface PlayerEditorModalProps {
  seasonId: string;
  player: Player | null;
  onClose: () => void;
  onChanged: () => void;
}

export function PlayerEditorModal({ seasonId, player, onClose, onChanged }: Readonly<PlayerEditorModalProps>) {
  const { players, behaviors } = useServices();
  const library = useResource(() => behaviors.list(), []);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [role, setRole] = useState<PlayerRole>('FAITHFUL');
  const [behaviorIds, setBehaviorIds] = useState<string[]>([]);

  useEffect(() => {
    if (!player) return;
    setName(player.name);
    setImageUrl(player.imageUrl ?? '');
    setRole(player.role);
    setBehaviorIds(player.behaviorIds);
  }, [player]);

  const save = useAction((input: UpdatePlayerInput) => players.update(seasonId, player!.id, input), { success: 'Jogador atualizado' });
  const remove = useAction(async () => { await players.remove(seasonId, player!.id); return true; }, { success: 'Jogador dispensado' });

  async function handleSave() {
    if (await save.run({ name: name.trim(), imageUrl: imageUrl.trim() || null, role, behaviorIds })) {
      onChanged();
      onClose();
    }
  }

  async function handleRemove() {
    if (await remove.run()) {
      onChanged();
      onClose();
    }
  }

  return (
    <Modal
      open={!!player}
      title="Ficha do jogador"
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel="Salvar"
          pending={save.pending}
          disabled={!name.trim()}
          onConfirm={handleSave}
          extra={
            <Button variant="danger" pending={remove.pending} onClick={fireAndForget(handleRemove)}>
              Dispensar
            </Button>
          }
        />
      }
    >
      <div className={styles.editor}>
        <Portrait name={name || '?'} imageUrl={imageUrl.trim() || null} />
        <div className={styles.editorFields}>
          <IdentityFields name={name} imageUrl={imageUrl} onName={setName} onImageUrl={setImageUrl} required={false} />
          <Field label="Função">
            {(id) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value as PlayerRole)}>
                <option value="FAITHFUL">Fiel</option>
                <option value="TRAITOR">Traidor</option>
              </Select>
            )}
          </Field>
          <div className={styles.tags}>
            <span className={styles.tagsLabel}>Comportamentos</span>
            <TagPicker behaviors={library.data ?? []} value={behaviorIds} onChange={setBehaviorIds} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
