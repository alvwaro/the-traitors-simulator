import { cx } from '../../../lib/cx';
import { useGame } from '../context/GameContext';
import { ConversationFeed } from '../phrases/ConversationFeed';
import { DayWall } from './shared/DayWall';
import styles from './shared/Shared.module.css';

/** Abre o dia com a parede de fotos e a notícia da noite. */
export function BreakfastPhase() {
  return (
    <>
      <BreakfastNews />
      <ConversationFeed phase="BREAKFAST" />
    </>
  );
}

/** Parede de fotos com o que aconteceu na noite anterior. */
export function BreakfastNews() {
  const { yesterday, playersById } = useGame();
  const meeting = yesterday?.traitorsMeeting;
  const murder = meeting?.murder;
  const target = murder ? playersById.get(murder.targetId) : undefined;

  let news = 'Ninguém foi assassinado esta noite.';
  if (target && murder?.outcome === 'SUCCESS') news = `${target.name} não apareceu. Foi assassinado(a).`;
  else if (target) news = `Todos à mesa. ${target.name} foi salvo(a) pelo escudo.`;
  const recruited = meeting?.recruitments.filter((r) => r.outcome === 'ACCEPTED').map((r) => playersById.get(r.targetId)?.name);

  return (
    <DayWall>
      <p className={cx(styles.news, murder?.outcome === 'SUCCESS' ? styles.newsBad : styles.newsGood)}>{news}</p>
      {recruited?.length ? <p className={cx(styles.center, styles.muted)}>Recrutado(a) em segredo: {recruited.join(', ')}</p> : null}
    </DayWall>
  );
}
