import { useState } from 'react';
import { PortraitGrid } from '../../../../components/player/PortraitGrid';
import { Button } from '../../../../components/ui/Button';
import { DaggerIcon } from '../../../../components/ui/Icons';
import type { PlayerView } from '../../../../domain/models';
import { fireAndForget } from '../../../../lib/async';
import { cx } from '../../../../lib/cx';
import { useGame } from '../../context/GameContext';
import { othersThan, toggleOne, useDecision, type OnResult } from '../useDecision';
import styles from '../Player.module.css';

/** O convite dos Traidores para você: uma carta lacrada ou o ultimato (aceitar ou morrer). */
export function OfferPanel({ me, onResult }: Readonly<{ me: PlayerView; onResult: OnResult }>) {
  const { state } = useGame();
  const [accepting, setAccepting] = useState(false);
  const [victim, setVictim] = useState<string | null>(null);
  const { send, pending } = useDecision(onResult);
  const ultimatum = me.pendingOffer?.ultimatum ?? false;

  function accept() {
    if (ultimatum) setAccepting(true);
    else void send({ offerResponse: 'ACCEPT' });
  }

  return (
    <section className={cx(styles.panel, styles.tower)}>
      <h3 className={styles.panelTitle}>
        <DaggerIcon size={14} /> {ultimatum ? 'Ultimato' : 'Uma carta lacrada'}
      </h3>
      <p>
        {ultimatum
          ? 'Um Traidor está na sua frente. Juntar-se a eles ou morrer esta noite. Se aceitar, vocês escolhem juntos quem morre.'
          : 'Os Traidores querem você do lado deles. Se aceitar, vira Traidor(a) e conhece os outros. Se recusar, ninguém fica sabendo.'}
      </p>
      {accepting ? (
        <>
          <p className={styles.panelHint}>Quem vocês matam juntos esta noite? (Você ainda não sabe quem são os outros traidores.)</p>
          <PortraitGrid items={othersThan(state, me)} size="sm" selectedIds={victim ? [victim] : []} onToggle={(id) => setVictim(toggleOne(victim, id))} />
          <div className={styles.panelActions}>
            <Button variant="quiet" onClick={() => setAccepting(false)}>
              Voltar
            </Button>
            <Button pending={pending} disabled={!victim} onClick={fireAndForget(() => send({ offerResponse: 'ACCEPT', victimId: victim }))}>
              Aceitar e escolher a vítima
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.panelActions}>
          <Button variant="danger" pending={pending} onClick={fireAndForget(() => send({ offerResponse: 'DECLINE' }))}>
            {ultimatum ? 'Recusar (e morrer)' : 'Recusar'}
          </Button>
          <Button pending={pending} onClick={accept}>
            Aceitar
          </Button>
        </div>
      )}
    </section>
  );
}
