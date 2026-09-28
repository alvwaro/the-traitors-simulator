import { useParams } from 'react-router-dom';
import { useAuth } from '../../../app/auth';
import { useServices } from '../../../app/services';
import { ErrorState, Loading } from '../../../components/ui/States';
import { useResource } from '../../../hooks/useResource';
import { GameView } from '../../game/components/GameView';
import { HistoryPage } from '../../history/pages/HistoryPage';
import { SeasonSetup } from '../components/SeasonSetup';

/**
 * Quem criou a temporada joga nela: em preparação, o elenco; depois de iniciada, o tabuleiro.
 * Os outros (temporada publicada) só assistem: a crônica, sem nenhum controle.
 */
export function SeasonPage() {
  const { seasonId = '' } = useParams();
  const { seasons } = useServices();
  const { user } = useAuth();
  const season = useResource(() => seasons.get(seasonId), [seasonId]);

  if (season.error) return <ErrorState error={season.error} onRetry={season.reload} />;
  if (!season.data || user === undefined) return <Loading />;
  if (season.data.ownerId !== user?.id) return <HistoryPage watching />;
  if (season.data.status === 'SETUP') return <SeasonSetup season={season.data} onChanged={season.reload} />;
  return <GameView seasonId={seasonId} />;
}
