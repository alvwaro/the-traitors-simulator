import { Link } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { PhotoWall } from '../../../components/player/PhotoWall';
import { Panel } from '../../../components/ui/Panel';
import { statusLabel } from '../../../domain/labels';
import { useResource } from '../../../hooks/useResource';
import { toRoman } from '../../../lib/format';
import { useGame } from '../context/GameContext';
import styles from './GameView.module.css';

/**
 * Elenco completo no fim da página: quem está no castelo e quem saiu (e quando).
 * Nas temporadas oficiais, cada participante real tem a própria página de informações.
 */
export function Roster() {
  const { history, seasonId } = useGame();
  const { publications } = useServices();
  const official = useResource(() => publications.list({ area: 'OFFICIAL', kind: 'SEASON' }), []);
  const dayNumber = new Map(history.days.map((d) => [d.day.id, d.day.number]));
  const isOfficial = !!official.data?.some((p) => p.seasonId === seasonId);
  const participants = isOfficial ? history.players.filter((p) => p.characterId && !p.isHuman) : [];

  return (
    <Panel title="Elenco">
      <PhotoWall
        players={history.players}
        size="sm"
        caption={(p) =>
          p.status !== 'ACTIVE' && p.eliminatedDayId ? `${statusLabel[p.status]} · Dia ${toRoman(dayNumber.get(p.eliminatedDayId) ?? 0)}` : null
        }
      />
      {participants.length > 0 && (
        <nav className={styles.participants} aria-label="Páginas dos participantes">
          <span>Participantes:</span>
          {participants.map((p) => (
            <Link key={p.id} to={`/participantes/${p.characterId}`}>
              {p.name}
            </Link>
          ))}
        </nav>
      )}
    </Panel>
  );
}
