import { useMemo, useState, type SubmitEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PortraitGrid, toggleIn } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import { Field, Input, Select } from '../../../components/ui/Form';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import type { CreateSeasonInput } from '../../../services/api/SeasonService';
import type { SeasonMode } from '../../../domain/enums';
import { ModePicker } from '../components/ModePicker';
import { SimulationFields, type SimulationDraft } from '../components/SimulationFields';
import { PlayerFields, type PlayerDraft } from '../components/PlayerFields';
import { PrizeFields, type PrizeDraft } from '../components/PrizeFields';
import styles from './Seasons.module.css';
import { fireAndForget } from '../../../lib/async';

export function NewSeasonPage() {
  const services = useServices();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const casts = useResource(() => services.casts.list(), []);
  const characters = useResource(() => services.characters.list(), []);

  const [name, setName] = useState('');
  const [prize, setPrize] = useState<PrizeDraft>({ currency: 'BRL', initialPrizePot: '0', maxPrizePot: '' });
  const [castId, setCastId] = useState(params.get('cast') ?? '');
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [mode, setMode] = useState<SeasonMode>('MANUAL');
  const [simulation, setSimulation] = useState<SimulationDraft>({ chaos: 0, missionPool: 'S3' });
  const [me, setMe] = useState<PlayerDraft>({ name: '', imageUrl: '', interactionLimit: 3 });

  const create = useAction((input: CreateSeasonInput) => services.seasons.create(input), { success: (s) => `${s.name} criada com ${s.players.length} jogadores` });

  const castMembers = useMemo(() => new Set(casts.data?.find((c) => c.id === castId)?.characterIds ?? []), [casts.data, castId]);
  const extras = (characters.data ?? []).filter((c) => !castMembers.has(c.id));
  const total = castMembers.size + extraIds.filter((id) => !castMembers.has(id)).length + (mode === 'PLAYER' ? 1 : 0);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const season = await create.run({
      name: name.trim(),
      mode,
      ...(mode !== 'MANUAL' ? simulation : {}),
      ...(mode === 'PLAYER' ? { interactionLimit: me.interactionLimit, human: { name: me.name.trim(), imageUrl: me.imageUrl.trim() || null } } : {}),
      currency: prize.currency,
      initialPrizePot: Number(prize.initialPrizePot || 0),
      maxPrizePot: prize.maxPrizePot ? Number(prize.maxPrizePot) : null,
      castId: castId || null,
      characterIds: extraIds.filter((id) => !castMembers.has(id)),
    });
    if (season) void navigate(`/temporadas/${season.id}`);
  }

  const error = casts.error ?? characters.error;
  if (error) return <ErrorState error={error} />;
  if (!casts.data || !characters.data) return <Loading />;

  return (
    <form onSubmit={fireAndForget(handleSubmit)}>
      <PageHeader
        title="Nova temporada"
      />
      <div className={styles.layout}>
        <Panel title="Elenco">
          <div className={styles.formStack}>
            <Field label="Cast salvo">
              {(id) => (
                <Select id={id} value={castId} onChange={(e) => setCastId(e.target.value)}>
                  <option value="">Nenhum (escolher avulsos)</option>
                  {casts.data!.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.characters.length})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {castId && <PortraitGrid items={casts.data.find((c) => c.id === castId)?.characters ?? []} size="sm" />}

            <p className={styles.summary}>Personagens avulsos da biblioteca</p>
            {extras.length ? (
              <PortraitGrid items={extras} size="sm" selectedIds={extraIds} onToggle={(id) => setExtraIds((list) => toggleIn(list, id))} />
            ) : (
              <EmptyState title="Nenhum personagem avulso disponível" />
            )}
          </div>
        </Panel>

        <div className={styles.stack}>
          <Panel title="A temporada">
            <div className={styles.formStack}>
              <Field label="Nome">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Ex.: Temporada I" />}</Field>
              <ModePicker value={mode} onChange={setMode} />
              {mode === 'PLAYER' && <PlayerFields value={me} onChange={setMe} />}
              {mode !== 'MANUAL' && <SimulationFields value={simulation} onChange={setSimulation} />}
              <PrizeFields value={prize} onChange={setPrize} />
            </div>
          </Panel>
          <div className={styles.startBar}>
            <p className={styles.startText}>{total} jogadores convocados</p>
            <Button type="submit" size="lg" pending={create.pending} disabled={!name.trim() || (mode === 'PLAYER' && !me.name.trim())}>
              Criar temporada
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
