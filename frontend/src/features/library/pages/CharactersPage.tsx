import { useServices } from '../../../app/services';
import { ErrorState, Loading } from '../../../components/ui/States';
import { useResource } from '../../../hooks/useResource';
import { CharactersSection } from '../components/CharactersSection';

/** Personagens: cadastro com foto e tags de personalidade. */
export function CharactersPage() {
  const services = useServices();
  const list = useResource(() => services.characters.list(), []);
  const behaviors = useResource(() => services.behaviors.list(), []);

  const error = list.error ?? behaviors.error;
  if (error) return <ErrorState error={error} onRetry={() => { list.reload(); behaviors.reload(); }} />;
  if (!list.data || !behaviors.data) return <Loading />;

  return <CharactersSection characters={list.data} behaviors={behaviors.data} onChanged={list.reload} />;
}
