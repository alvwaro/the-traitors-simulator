import { useState } from 'react';
import { useServices } from '../../../app/services';
import { TagChips } from '../../../components/behavior/BehaviorTags';
import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { behaviorNames } from '../../../domain/behaviors';
import type { Cast } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import styles from './CastDetail.module.css';
import { fireAndForget } from '../../../lib/async';

/** Comportamentos de cada personagem do cast, com a opção de sortear novos para todos. */
export function CastBehaviors({ cast, onChanged }: Readonly<{ cast: Cast; onChanged: () => void }>) {
  const services = useServices();
  const behaviors = useResource(() => services.behaviors.list(), []);
  const [confirming, setConfirming] = useState(false);
  const randomize = useAction(() => services.casts.randomizeBehaviors(cast.id), { success: 'Comportamentos sorteados' });

  async function confirm() {
    const result = await randomize.run();
    setConfirming(false);
    if (result) onChanged();
  }

  return (
    <div className={styles.relationships}>
      <div className={styles.behaviorsHead}>
        <p className={styles.muted}>Os comportamentos definem como cada personagem joga, vota e se relaciona.</p>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
          Sortear comportamentos
        </Button>
      </div>
      <ul className={styles.behaviorList}>
        {cast.characters.map((character) => (
          <li key={character.id} className={styles.behaviorRow}>
            <Portrait name={character.name} imageUrl={character.imageUrl} size="xs" hideName />
            <span className={styles.pickerName}>{character.name}</span>
            {character.behaviorIds.length ? (
              <TagChips names={behaviorNames(character.behaviorIds, behaviors.data ?? [])} />
            ) : (
              <span className={styles.random}>Sem comportamento</span>
            )}
          </li>
        ))}
      </ul>
      <Modal
        open={confirming}
        title="Sortear comportamentos?"
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button pending={randomize.pending} onClick={fireAndForget(confirm)}>
              Sortear
            </Button>
          </>
        }
      >
        <p>
          Cada um dos {cast.characters.length} personagens recebe de 1 a 3 comportamentos que combinam entre si. Os comportamentos atuais são substituídos,
          inclusive nos outros casts em que o personagem aparece. Temporadas já criadas não mudam.
        </p>
      </Modal>
    </div>
  );
}
