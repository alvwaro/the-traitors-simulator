import { Portrait } from '../../../components/player/Portrait';
import { PortraitGrid } from '../../../components/player/PortraitGrid';
import { DaggerIcon } from '../../../components/ui/Icons';
import type { GamePhase } from '../../../domain/enums';
import { statusLabel } from '../../../domain/labels';
import type { Player, PlayerView } from '../../../domain/models';
import { cx } from '../../../lib/cx';
import { useGame } from '../context/GameContext';
import { SeerNote } from './panels/SeerPanels';
import styles from './Player.module.css';

/** Seu cartão: papel, credibilidade, conversas restantes, alianças e o que o Vidente descobriu. */
export function YouCard({ me, phase }: Readonly<{ me: PlayerView; phase: GamePhase }>) {
  const { playersById } = useGame();
  const traitor = me.role === 'TRAITOR';
  const alliances = me.alliances.map((a) => ({ id: a.id, members: a.memberIds.flatMap((id) => playersById.get(id) ?? []) })).filter((a) => a.members.length > 0);
  return (
    <div className={cx(styles.you, traitor && styles.youTraitor)}>
      <Portrait name={me.name} imageUrl={me.imageUrl} size="sm" hideName />
      <div className={styles.youText}>
        <p className={styles.youName}>Você · {me.name}</p>
        <p className={traitor ? styles.traitorText : styles.faithfulText}>
          <RoleLabel traitor={traitor} phase={phase} />
        </p>
      </div>
      {me.seer && <SeerNote me={me} />}
      {(me.record.hits > 0 || me.record.misses > 0) && (
        <p className={styles.talks}>
          Acusações certeiras: <strong>{me.record.hits}</strong> · erradas: <strong>{me.record.misses}</strong>
        </p>
      )}
      {(me.canTalk || me.interactionsLeft < me.interactionLimit) && (
        <p className={styles.talks}>
          <strong>{me.interactionsLeft}</strong> de {me.interactionLimit} conversas neste momento
        </p>
      )}
      {alliances.length > 0 && (
        <div className={styles.allies}>
          {/* Cada aliança é um grupo próprio: estar com Ana numa e com Caio noutra não junta os dois. */}
          {alliances.map((a, i) => (
            <div key={a.id} className={styles.alliance}>
              <span>{alliances.length > 1 ? `Aliança ${i + 1}:` : 'Sua aliança:'}</span>
              {a.members.map((p) => (
                <Portrait key={p.id} name={p.name} imageUrl={p.imageUrl} size="xs" hideName />
              ))}
              <span className={styles.alliesNames}>{a.members.map((p) => p.name).join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleLabel({ traitor, phase }: Readonly<{ traitor: boolean; phase: GamePhase }>) {
  if (traitor) {
    return (
      <>
        <DaggerIcon size={13} /> Traidor(a)
      </>
    );
  }
  return <>{phase === 'ARRIVAL' || phase === 'TRAITOR_SELECTION' ? 'Papel ainda não sorteado' : 'Fiel'}</>;
}

/** Eliminado(a): agora assiste a tudo, como quem vê o episódio. */
export function SpectatorBanner({ me }: Readonly<{ me: PlayerView }>) {
  return (
    <div className={styles.spectator}>
      <Portrait name={me.name} imageUrl={me.imageUrl} status={me.status} size="sm" hideName />
      <p>
        Você foi <strong>{statusLabel[me.status].toLowerCase()}</strong>. Agora assiste ao resto da temporada como quem vê o episódio: tudo é revelado.
      </p>
    </div>
  );
}

/** O toque no ombro: seu papel e, sendo traidor(a), os parceiros. */
export function RoleReveal({ me, playersById }: Readonly<{ me: PlayerView; playersById: Map<string, Player> }>) {
  if (me.role !== 'TRAITOR') {
    return (
      <div className={cx(styles.reveal, styles.revealFaithful)}>
        <p className={styles.revealTitle}>Ninguém tocou no seu ombro.</p>
        <p>Você é Fiel. Descubra os traidores antes que eles descubram você.</p>
      </div>
    );
  }
  const partners = me.fellowTraitorIds.flatMap((id) => playersById.get(id) ?? []);
  return (
    <div className={cx(styles.reveal, styles.revealTraitor)}>
      <p className={styles.revealTitle}>
        <DaggerIcon size={16} /> Um toque no ombro. Você é Traidor(a).
      </p>
      {partners.length ? (
        <>
          <p>Na torre, os capuzes caem. Seus parceiros:</p>
          <PortraitGrid items={partners} size="sm" />
        </>
      ) : (
        <p>Você é o único Traidor. Ninguém pode saber.</p>
      )}
    </div>
  );
}
