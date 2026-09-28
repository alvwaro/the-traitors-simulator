import { PhotoWall } from '../../../components/player/PhotoWall';
import { Panel } from '../../../components/ui/Panel';
import { statusLabel } from '../../../domain/labels';
import { toRoman } from '../../../lib/format';
import { useGame } from '../context/GameContext';

/** Elenco completo no fim da página: quem está no castelo e quem saiu (e quando). */
export function Roster() {
  const { history } = useGame();
  const dayNumber = new Map(history.days.map((d) => [d.day.id, d.day.number]));

  return (
    <Panel title="Elenco">
      <PhotoWall
        players={history.players}
        size="sm"
        caption={(p) =>
          p.status !== 'ACTIVE' && p.eliminatedDayId ? `${statusLabel[p.status]} · Dia ${toRoman(dayNumber.get(p.eliminatedDayId) ?? 0)}` : null
        }
      />
    </Panel>
  );
}
