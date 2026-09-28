import type { ReactNode } from 'react';
import { PhotoWall } from '../../../../components/player/PhotoWall';
import { useGame } from '../../context/GameContext';
import styles from './Shared.module.css';

/** Abertura de cada dia: a parede de fotos de todo o elenco. */
export function DayWall({ children }: Readonly<{ children?: ReactNode }>) {
  const { history } = useGame();
  return (
    <div className={styles.wall}>
      {children}
      <PhotoWall players={history.players} size="md" />
    </div>
  );
}
