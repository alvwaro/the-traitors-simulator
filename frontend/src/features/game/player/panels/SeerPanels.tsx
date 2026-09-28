import { useState } from 'react';
import { PortraitGrid } from '../../../../components/player/PortraitGrid';
import { Button } from '../../../../components/ui/Button';
import type { PlayerView } from '../../../../domain/models';
import { fireAndForget } from '../../../../lib/async';
import { cx } from '../../../../lib/cx';
import { useGame } from '../../context/GameContext';
import { othersThan, toggleOne, useDecision, type OnResult } from '../useDecision';
import styles from '../Player.module.css';

/** O jantar do Vidente: com quem você janta esta noite (a resposta é sempre a verdade). */
export function SeerPanel({ me, onResult }: Readonly<{ me: PlayerView; onResult: OnResult }>) {
  const { state } = useGame();
  const [guest, setGuest] = useState<string | null>(null);
  const { send, pending } = useDecision(onResult);
  const chosen = state.activePlayers.find((p) => p.id === guest);
  return (
    <section className={cx(styles.panel, styles.seer)}>
      <h3 className={styles.panelTitle}>O jantar do Vidente</h3>
      <p className={styles.panelHint}>
        Você ganhou o poder do Vidente. Chame alguém para um jantar a sós e pergunte: Traidor(a) ou Fiel? A resposta é sempre verdadeira. No café, você decide o que contar.
      </p>
      <PortraitGrid items={othersThan(state, me)} size="sm" selectedIds={guest ? [guest] : []} onToggle={(id) => setGuest(toggleOne(guest, id))} />
      <div className={styles.panelActions}>
        <Button pending={pending} disabled={!chosen} onClick={fireAndForget(() => send({ seerGuestId: guest }))}>
          {chosen ? `Jantar com ${chosen.name}` : 'Escolha um nome'}
        </Button>
      </div>
    </section>
  );
}

/** No café seguinte ao jantar, o Vidente conta a verdade, mente ou guarda segredo. */
export function SeerAnnouncePanel({ me, onResult }: Readonly<{ me: PlayerView; onResult: OnResult }>) {
  const { playersById } = useGame();
  const { send, pending } = useDecision(onResult);
  const guest = me.seer ? playersById.get(me.seer.guestId) : undefined;
  if (!me.seer || !guest) return null;
  const traitor = me.seer.role === 'TRAITOR';
  return (
    <section className={cx(styles.panel, styles.seer)}>
      <h3 className={styles.panelTitle}>O que o Vidente conta?</h3>
      <p className={styles.panelHint}>
        No jantar, você descobriu que <strong>{guest.name}</strong> é <strong>{traitor ? 'Traidor(a)' : 'Fiel'}</strong>. O castelo inteiro espera o seu relato; acreditam em você na medida em que confiam em você.
      </p>
      <div className={styles.panelActions}>
        <Button variant="quiet" pending={pending} onClick={fireAndForget(() => send({ seerAnnouncement: 'SECRET' }))}>
          Guardar segredo
        </Button>
        <Button variant="danger" pending={pending} onClick={fireAndForget(() => send({ seerAnnouncement: 'LIE' }))}>
          Mentir: dizer que é {traitor ? 'Fiel' : 'Traidor(a)'}
        </Button>
        <Button pending={pending} onClick={fireAndForget(() => send({ seerAnnouncement: 'TRUTH' }))}>
          Contar a verdade
        </Button>
      </div>
    </section>
  );
}

/** O que você descobriu no jantar do Vidente (no seu cartão). */
export function SeerNote({ me }: Readonly<{ me: PlayerView }>) {
  const { playersById } = useGame();
  const seer = me.seer;
  const guest = seer ? playersById.get(seer.guestId) : undefined;
  if (!seer || !guest) return null;
  const traitor = seer.role === 'TRAITOR';
  return (
    <p className={styles.talks}>
      Vidente: no jantar, você descobriu que <strong>{guest.name}</strong> é{' '}
      <strong className={traitor ? styles.traitorText : styles.faithfulText}>{traitor ? 'Traidor(a)' : 'Fiel'}</strong>
      {seer.announced ? '.' : '. Só vocês dois sabem.'}
    </p>
  );
}
