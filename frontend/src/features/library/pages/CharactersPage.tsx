import { useServices } from '../../../app/services';
import { ErrorState, Loading } from '../../../components/ui/States';
import { useResource } from '../../../hooks/useResource';
import { CharactersSection } from '../components/CharactersSection';

/** Personagens: cadastro com foto e tags de personalidade, separados por cast. */
export function CharactersPage() {
  const services = useServices();
  const list = useResource(() => services.characters.list(), []);
  const casts = useResource(() => services.casts.list(), []);
  const behaviors = useResource(() => services.behaviors.list(), []);

  const error = list.error ?? casts.error ?? behaviors.error;
  const reload = () => {
    list.reload();
    casts.reload();
  };
  if (error) return <ErrorState error={error} onRetry={() => { reload(); behaviors.reload(); }} />;
  if (!list.data || !casts.data || !behaviors.data) return <Loading />;

  return <CharactersSection characters={list.data} behaviors={behaviors.data} casts={casts.data} onChanged={reload} />;
}
