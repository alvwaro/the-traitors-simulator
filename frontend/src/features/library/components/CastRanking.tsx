import { useServices } from '../../../app/services';
import { Portrait } from '../../../components/player/Portrait';
import { EmptyState, ErrorState, Loading } from '../../../components/ui/States';
import type { CastRankingRow } from '../../../domain/models';
import { useResource } from '../../../hooks/useResource';
import { cx } from '../../../lib/cx';
import { formatMoney } from '../../../lib/format';
import styles from './CastDetail.module.css';

const percent = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '—');

/** Ranking de desempenho dos personagens do cast, somando todas as temporadas em que jogaram. */
export function CastRanking({ castId }: Readonly<{ castId: string }>) {
  const { casts } = useServices();
  const ranking = useResource(() => casts.ranking(castId), [castId]);

  if (ranking.error) return <ErrorState error={ranking.error} onRetry={ranking.reload} />;
  if (!ranking.data) return <Loading />;
  const rows = ranking.data.rows;
  if (!rows.some((r) => r.stats.seasons > 0)) {
    return <EmptyState title="Ninguém deste cast jogou uma temporada ainda">O ranking aparece depois da primeira temporada iniciada.</EmptyState>;
  }

  return (
    <>
      <div className={styles.podium}>
        {rows.slice(0, 3).map((r) => (
          <PodiumCard key={r.character.id} row={r} />
        ))}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Personagem</th>
              <th scope="col" title="Temporadas iniciadas">Temp.</th>
              <th scope="col">Vitórias</th>
              <th scope="col" title="Vitórias como traidor / como fiel">Traidor · Fiel</th>
              <th scope="col" title="Chegou vivo(a) à revelação final">Finais</th>
              <th scope="col">Prêmio</th>
              <th scope="col" title="Vezes traidor (recrutado)">Foi traidor</th>
              <th scope="col">Banido</th>
              <th scope="col">Morto</th>
              <th scope="col" title="Votos recebidos na mesa redonda">Votos recebidos</th>
              <th scope="col" title="Votos dados em quem era traidor">Acerto nos votos</th>
              <th scope="col">Escudos</th>
              <th scope="col" title="Média de dias no jogo">Dias</th>
              <th scope="col">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ position, character, stats: s, score }) => (
              <tr key={character.id} className={cx(position <= 3 && s.seasons > 0 && styles[`top${position}`])}>
                <td className={styles.position}>{position}</td>
                <th scope="row">
                  <span className={styles.who}>
                    <Portrait name={character.name} imageUrl={character.imageUrl} size="xs" hideName />
                    <span>{character.name}</span>
                  </span>
                </th>
                <td>{s.seasons}</td>
                <td className={styles.strong}>{s.wins}</td>
                <td>
                  <span className={styles.traitor}>{s.winsAsTraitor}</span> · <span className={styles.faithful}>{s.winsAsFaithful}</span>
                </td>
                <td>{s.finals}</td>
                <td>{s.prizeWon ? formatMoney(s.prizeWon) : '—'}</td>
                <td>
                  {s.timesTraitor}
                  {s.timesRecruited ? <span className={styles.muted}> ({s.timesRecruited} recrutado)</span> : null}
                </td>
                <td>{s.banished}</td>
                <td>{s.murdered}</td>
                <td>{s.votesReceived}</td>
                <td>
                  {s.votesOnTraitors}/{s.votesCast} <span className={styles.muted}>{percent(s.votesOnTraitors, s.votesCast)}</span>
                </td>
                <td>{s.shields}</td>
                <td>{s.avgDays ? s.avgDays.toFixed(1) : '—'}</td>
                <td className={styles.strong}>{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.footnote}>
        Pontos: vitória 100, final 30, cada dia de jogo 3, voto certeiro em traidor 4, escudo 5, vez como traidor 5, banimento −8, assassinato −3.
      </p>
    </>
  );
}

function PodiumCard({ row }: Readonly<{ row: CastRankingRow }>) {
  const { character, stats, position, score } = row;
  const medal = ['Ouro', 'Prata', 'Bronze'][position - 1];
  return (
    <div className={cx(styles.podiumCard, styles[`top${position}`])}>
      <span className={styles.medal}>
        {position}º · {medal}
      </span>
      <Portrait name={character.name} imageUrl={character.imageUrl} size="md" />
      <span className={styles.podiumStats}>
        {stats.wins} {stats.wins === 1 ? 'vitória' : 'vitórias'} · {score} pts
      </span>
    </div>
  );
}
