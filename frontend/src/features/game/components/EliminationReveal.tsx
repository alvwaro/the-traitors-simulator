import { Portrait } from '../../../components/player/Portrait';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import type { PlayerRole, PlayerStatus } from '../../../domain/enums';
import type { Player } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import styles from './EliminationReveal.module.css';

export type EliminationKind = Exclude<PlayerStatus, 'ACTIVE'>;

export interface Elimination {
  player: Player;
  kind: EliminationKind;
  role: PlayerRole;
  /** Reta final: saiu sem revelar o papel. */
  roleHidden?: boolean;
}

const HEADLINE: Record<EliminationKind, (name: string) => string> = {
  BANISHED: (name) => `${name} foi banido(a)`,
  MURDERED: (name) => `${name} foi assassinado(a)`,
  WITHDRAWN: (name) => `${name} deixou o castelo`,
};

/** A cena de saída de um jogador: banimento, assassinato ou desistência. */
export function EliminationReveal({ elimination, onClose }: Readonly<{ elimination: Elimination | null; onClose: () => void }>) {
  const traitor = elimination?.role === 'TRAITOR';
  return (
    <Modal
      open={!!elimination}
      dramatic
      onClose={onClose}
      footer={
        <Button variant="ghost" onClick={onClose}>
          Continuar
        </Button>
      }
    >
      {elimination && (
        <div className={styles.reveal}>
          <Portrait name={elimination.player.name} imageUrl={elimination.player.imageUrl} status={elimination.kind} size="xl" hideName />
          <p className={styles.headline}>{HEADLINE[elimination.kind](elimination.player.name)}</p>
          {elimination.roleHidden ? (
            <p className={styles.role}>Saiu sem revelar o papel. A verdade só aparece no fim do jogo.</p>
          ) : (
            <p className={cx(styles.role, traitor ? styles.traitor : styles.faithful)}>{traitor ? 'Era um(a) Traidor(a)' : 'Era um(a) Fiel'}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
