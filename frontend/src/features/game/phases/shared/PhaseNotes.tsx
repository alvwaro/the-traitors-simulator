import { useEffect, useState } from 'react';
import { useServices } from '../../../../app/services';
import { Button } from '../../../../components/ui/Button';
import { TextArea } from '../../../../components/ui/Form';
import { useAction } from '../../../../hooks/useAction';
import { useGame } from '../../context/GameContext';
import styles from './Shared.module.css';
import { fireAndForget } from '../../../../lib/async';

/** Anotações livres da fase atual. */
export function PhaseNotes() {
  const { today, state, seasonId, refresh } = useGame();
  const { phases } = useServices();
  const saved = today?.phases.find((p) => p.phase === state.phase)?.notes ?? '';
  const [notes, setNotes] = useState(saved);
  useEffect(() => setNotes(saved), [saved]);

  const save = useAction(() => phases.notes(seasonId, notes.trim() || null), { success: 'Anotações salvas' });

  return (
    <div className={styles.notes}>
      <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} aria-label="Anotações da fase" placeholder="O que aconteceu nesta fase" />
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" pending={save.pending} disabled={notes === saved} onClick={fireAndForget(async () => (await save.run()) && refresh())}>
          Salvar anotações
        </Button>
      </div>
    </div>
  );
}
