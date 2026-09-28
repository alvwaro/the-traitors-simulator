import { Link, useParams } from 'react-router-dom';
import { useServices } from '../../../app/services';
import { PageHeader } from '../../../components/layout/PageHeader';
import { PortraitGrid } from '../../../components/player/PortraitGrid';
import { Panel } from '../../../components/ui/Panel';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import { seasonStatusLabel } from '../../../domain/labels';
import { useResource } from '../../../hooks/useResource';
import { formatMoney } from '../../../lib/format';
import { DayChronicle } from '../components/DayChronicle';
import { WatchActions } from '../components/WatchActions';
import styles from '../components/Chronicle.module.css';

const TX_LABEL = { MISSION: 'Missão', PENALTY: 'Penalidade', ADJUSTMENT: 'Ajuste' } as const;

/**
 * Crônica completa da temporada, dia a dia.
 * `watching`: temporada publicada de outra pessoa, só para assistir (e copiar o elenco).
 */
export function HistoryPage({ watching = false }: Readonly<{ watching?: boolean }>) {
  const { seasonId = '' } = useParams();
  const { game } = useServices();
  const history = useResource(() => game.history(seasonId), [seasonId]);

  if (history.error) return <ErrorState error={history.error} onRetry={history.reload} />;
  if (!history.data) return <Loading />;

  const { season, days, players, winners, prizeTransactions, prizePot } = history.data;
  const playersById = new Map(players.map((p) => [p.id, p]));
  const winnerPlayers = winners.flatMap((w) => playersById.get(w.playerId) ?? []);

  return (
    <>
      <PageHeader
        eyebrow={`${watching ? 'Assistindo · ' : ''}${seasonStatusLabel[season.status]} · prêmio de ${formatMoney(prizePot, season.currency)}`}
        title={watching ? season.name : `Crônica de ${season.name}`}
        actions={watching ? <WatchActions seasonId={season.id} /> : <Link to={`/temporadas/${season.id}`}>Voltar ao castelo</Link>}
      />

      <div className={styles.list}>
        {watching && (
          <Panel title="Elenco">
            <PortraitGrid items={players} size="sm" />
          </Panel>
        )}

        {winnerPlayers.length > 0 && (
          <Panel tone="blood" title="Vencedores">
            <PortraitGrid
              items={winnerPlayers}
              caption={(p) => formatMoney(winners.find((w) => w.playerId === p.id)?.prizeShare ?? 0, season.currency)}
            />
          </Panel>
        )}

        {days.length === 0 ? (
          <EmptyState title="Nada foi registrado ainda" />
        ) : (
          days.map((day) => <DayChronicle key={day.day.id} day={day} playersById={playersById} currency={season.currency} />)
        )}

        {prizeTransactions.length > 0 && (
          <Panel title="Movimentações do prêmio">
            <table className={styles.ledger}>
              <tbody>
                <tr>
                  <td>Prêmio inicial</td>
                  <td>{formatMoney(season.initialPrizePot, season.currency)}</td>
                </tr>
                {prizeTransactions.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.type === 'MISSION'
                        ? (t.description ?? TX_LABEL.MISSION)
                        : [TX_LABEL[t.type], t.description].filter(Boolean).join(' · ')}
                    </td>
                    <td className={t.amount < 0 ? styles.negative : undefined}>{formatMoney(t.amount, season.currency)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>{formatMoney(prizePot, season.currency)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </>
  );
}
