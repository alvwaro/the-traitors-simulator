import { useState, type SubmitEvent } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { TagPicker } from '../../../components/behavior/BehaviorTags';
import { PortraitGrid, toggleIn } from '../../../components/player/PortraitGrid';
import { Button } from '../../../components/ui/Button';
import { IdentityFields } from '../../../components/player/IdentityFields';
import { Check } from '../../../components/ui/Form';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState, Loading } from '../../../components/ui/States';
import type { SeasonDetails } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import type { AddPlayerInput } from '../../../services/api/PlayerService';
import styles from '../pages/Seasons.module.css';
import { fireAndForget } from '../../../lib/async';

type Tab = 'library' | 'new';

/** Convoca jogadores: da biblioteca ou criando um novo (opcionalmente salvo na biblioteca). */
export function RecruitPanel({ season, onChanged }: Readonly<{ season: SeasonDetails; onChanged: () => void }>) {
  const services = useServices();
  const [tab, setTab] = useState<Tab>('library');

  return (
    <Panel title="Trazer jogadores">
      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'library'} onClick={() => setTab('library')}>
          Da biblioteca
        </button>
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'new'} onClick={() => setTab('new')}>
          Novo jogador
        </button>
      </div>
      {tab === 'library' ? (
        <FromLibrary season={season} onChanged={onChanged} add={(input) => services.players.add(season.id, input)} />
      ) : (
        <NewPlayer onChanged={onChanged} add={(input) => services.players.add(season.id, input)} />
      )}
    </Panel>
  );
}

interface TabProps {
  onChanged: () => void;
  add: (input: AddPlayerInput) => Promise<unknown>;
}

function FromLibrary({ season, onChanged, add }: Readonly<TabProps & { season: SeasonDetails }>) {
  const { characters } = useServices();
  const library = useResource(() => characters.list(), []);
  const [selected, setSelected] = useState<string[]>([]);

  const recruit = useAction(
    async (ids: string[]) => {
      for (const characterId of ids) await add({ characterId });
      return ids.length;
    },
    { success: (n) => `${n} jogador(es) convocado(s)` },
  );

  if (!library.data) return <Loading label="Abrindo a galeria" />;
  const inSeason = new Set(season.players.map((p) => p.characterId));
  const available = library.data.filter((c) => !inSeason.has(c.id));

  async function handleRecruit() {
    await recruit.run(selected);
    setSelected([]);
    onChanged();
  }

  if (!available.length) {
    return (
      <EmptyState title="Todos já estão na temporada">
        Cadastre mais personagens na <Link to="/biblioteca">biblioteca</Link>.
      </EmptyState>
    );
  }

  return (
    <div className={styles.formStack}>
      <PortraitGrid items={available} size="sm" selectedIds={selected} onToggle={(id) => setSelected((list) => toggleIn(list, id))} />
      <div className={styles.actionsRow}>
        <Button pending={recruit.pending} disabled={!selected.length} onClick={fireAndForget(handleRecruit)}>
          Convocar {selected.length || ''}
        </Button>
      </div>
    </div>
  );
}

function NewPlayer({ onChanged, add }: Readonly<TabProps>) {
  const { behaviors } = useServices();
  const library = useResource(() => behaviors.list(), []);
  const [behaviorIds, setBehaviorIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const create = useAction((input: AddPlayerInput) => add(input), { success: 'Jogador convocado' });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (await create.run({ name: name.trim(), imageUrl: imageUrl.trim() || null, saveToLibrary, behaviorIds })) {
      setName('');
      setImageUrl('');
      setBehaviorIds([]);
      onChanged();
    }
  }

  return (
    <form className={styles.formStack} onSubmit={fireAndForget(handleSubmit)}>
      <IdentityFields name={name} imageUrl={imageUrl} onName={setName} onImageUrl={setImageUrl} />
      <TagPicker behaviors={library.data ?? []} value={behaviorIds} onChange={setBehaviorIds} />
      <Check label="Guardar também na biblioteca" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)} />
      <div className={styles.actionsRow}>
        <Button type="submit" pending={create.pending} disabled={!name.trim()}>
          Convocar
        </Button>
      </div>
    </form>
  );
}
