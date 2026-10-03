import { Navigate, useParams } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { ErrorState, Loading } from '../../../components/ui/States';
import { useResource } from '../../../hooks/useResource';
import { GameView } from '../../game/components/GameView';
import { publishedSeasonPath } from '../../publications/labels';
import { SeasonSetup } from '../components/SeasonSetup';

/**
 * Temporada de outra pessoa (ou que não existe mais): links antigos de uma temporada publicada
 * levam à publicação, que é uma cópia; senão, mostra o erro.
 */
function NotMine({ seasonId, error, onRetry }: Readonly<{ seasonId: string; error: Error; onRetry: () => void }>) {
  const { publications } = useServices();
  const list = useResource(() => publications.list({ kind: 'SEASON' }), []);
  if (!list.data && !list.error) return <Loading />;
  const published = list.data?.find((p) => p.seasonId === seasonId);
  if (published) return <Navigate to={publishedSeasonPath(published.id)} replace />;
  return <ErrorState error={error} onRetry={onRetry} />;
}

/** Quem criou a temporada joga nela: em preparação, o elenco; depois de iniciada, o tabuleiro. */
export function SeasonPage() {
  const { seasonId = '' } = useParams();
  const { seasons } = useServices();
  const season = useResource(() => seasons.get(seasonId), [seasonId]);

  if (season.error) return <NotMine seasonId={seasonId} error={season.error} onRetry={season.reload} />;
  if (!season.data) return <Loading />;
  if (season.data.status === 'SETUP') return <SeasonSetup season={season.data} onChanged={season.reload} />;
  return <GameView seasonId={seasonId} />;
}
