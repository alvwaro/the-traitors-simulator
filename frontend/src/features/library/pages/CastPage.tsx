import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import { useAction } from '../../../hooks/useAction';
import { useResource } from '../../../hooks/useResource';
import type { CastInput } from '../../../services/api/CastService';
import { CastDetail } from '../components/CastDetail';
import { CastEditor } from '../components/CastEditor';
import { CharactersSection } from '../components/CharactersSection';
import { NO_CAST_ID, NO_CAST_NAME } from '../components/castGroups';

/**
 * Página de um cast da biblioteca: o elenco (com cadastro de personagens direto nele), ranking,
 * relacionamentos e comportamentos. `sem-cast` mostra os personagens que não estão em nenhum cast.
 */
export function CastPage() {
  const { castId = '' } = useParams();
  const navigate = useNavigate();
  const services = useServices();
  const casts = useResource(() => services.casts.list(), []);
  const characters = useResource(() => services.characters.list(), []);
  const behaviors = useResource(() => services.behaviors.list(), []);
  const [editing, setEditing] = useState(false);
  const update = useAction((id: string, input: CastInput) => services.casts.update(id, input), { success: 'Cast atualizado' });

  const error = casts.error ?? characters.error ?? behaviors.error;
  const reloadAll = () => {
    casts.reload();
    characters.reload();
  };
  if (error) return <ErrorState error={error} onRetry={() => { reloadAll(); behaviors.reload(); }} />;
  if (!casts.data || !characters.data || !behaviors.data) return <Loading />;

  const back = () => navigate('/biblioteca/casts');

  if (castId === NO_CAST_ID) {
    return (
      <Panel
        title={NO_CAST_NAME}
        eyebrow="Fora de qualquer cast"
        actions={
          <Button variant="quiet" size="sm" onClick={back}>
            Voltar
          </Button>
        }
      >
        <CharactersSection characters={characters.data} behaviors={behaviors.data} casts={casts.data} scope={{ castId: null }} onChanged={reloadAll} />
      </Panel>
    );
  }

  const cast = casts.data.find((c) => c.id === castId);
  if (!cast) {
    return (
      <EmptyState title="Cast não encontrado">
        <Button variant="ghost" size="sm" onClick={back}>
          Voltar para os casts
        </Button>
      </EmptyState>
    );
  }

  if (editing) {
    return (
      <Panel title={`Editar ${cast.name}`}>
        <CastEditor
          key={cast.id}
          characters={characters.data}
          initial={cast}
          pending={update.pending}
          onSubmit={async (input) => {
            const ok = !!(await update.run(cast.id, input));
            if (ok) {
              setEditing(false);
              reloadAll();
            }
            return ok;
          }}
          onCancel={() => setEditing(false)}
        />
      </Panel>
    );
  }

  return (
    <CastDetail
      cast={cast}
      onBack={back}
      onEdit={() => setEditing(true)}
      onChanged={reloadAll}
      characters={<CharactersSection characters={characters.data} behaviors={behaviors.data} casts={casts.data} scope={{ castId: cast.id }} onChanged={reloadAll} />}
    />
  );
}
