import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Field, Input } from '../../../components/ui/Form';
import { Panel } from '../../../components/ui/Panel';
import type { SeasonDetails } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import type { SeasonMode } from '../../../domain/enums';
import { ModePicker } from './ModePicker';
import { SimulationFields, type SimulationDraft } from './SimulationFields';
import { PrizeFields, type PrizeDraft } from './PrizeFields';
import { SaveAsCastModal } from './SaveAsCastModal';
import { DeleteSeasonModal } from './SeasonModals';
import styles from '../pages/Seasons.module.css';
import { fireAndForget } from '../../../lib/async';

export function SeasonSettingsPanel({ season, onChanged }: Readonly<{ season: SeasonDetails; onChanged: () => void }>) {
  const { seasons } = useServices();
  const navigate = useNavigate();
  const [name, setName] = useState(season.name);
  const [prize, setPrize] = useState<PrizeDraft>({
    currency: season.currency,
    initialPrizePot: String(season.initialPrizePot),
    maxPrizePot: season.maxPrizePot === null ? '' : String(season.maxPrizePot),
  });
  const [mode, setMode] = useState<SeasonMode>(season.mode);
  const [simulation, setSimulation] = useState<SimulationDraft>({ chaos: season.chaos, missionPool: season.missionPool, withdrawals: season.withdrawals });
  const [interactionLimit, setInteractionLimit] = useState(season.interactionLimit);
  const [savingCast, setSavingCast] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useAction(
    () =>
      seasons.update(season.id, {
        name: name.trim(),
        mode,
        ...(mode === 'PLAYER' ? { interactionLimit } : {}),
        ...(mode !== 'MANUAL' ? simulation : {}),
        currency: prize.currency,
        initialPrizePot: Number(prize.initialPrizePot || 0),
        maxPrizePot: prize.maxPrizePot ? Number(prize.maxPrizePot) : null,
      }),
    { success: 'Configurações salvas' },
  );

  return (
    <Panel title="A temporada">
      <div className={styles.formStack}>
        <Field label="Nome">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />}</Field>
        {season.mode === 'PLAYER' ? (
          <Field label={`Conversas por momento: ${interactionLimit}`}>
            {(id) => <input id={id} type="range" min={0} max={10} value={interactionLimit} onChange={(e) => setInteractionLimit(Number(e.target.value))} />}
          </Field>
        ) : (
          <ModePicker value={mode} onChange={setMode} withPlayer={false} />
        )}
        {mode !== 'MANUAL' && <SimulationFields value={simulation} onChange={setSimulation} />}
        <PrizeFields value={prize} onChange={setPrize} />
        <div className={styles.actionsRow}>
          <Button pending={save.pending} disabled={!name.trim()} onClick={fireAndForget(async () => (await save.run()) && onChanged())}>
            Salvar
          </Button>
          <Button variant="ghost" disabled={!season.players.length} onClick={() => setSavingCast(true)}>
            Salvar elenco como cast
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Apagar
          </Button>
        </div>
      </div>

      <SaveAsCastModal open={savingCast} seasonId={season.id} defaultName={`Elenco de ${season.name}`} onClose={() => setSavingCast(false)} />

      <DeleteSeasonModal season={season} open={confirmDelete} onClose={() => setConfirmDelete(false)} onDone={fireAndForget(() => navigate('/'))} />
    </Panel>
  );
}
