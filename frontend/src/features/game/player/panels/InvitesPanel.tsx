import { useServices } from '../../../../app/services';
import { Portrait } from '../../../../components/player/Portrait';
import { Button } from '../../../../components/ui/Button';
import type { PlayerView } from '../../../../domain/models';
import { useAction } from '../../../../hooks/useAction';
import { fireAndForget } from '../../../../lib/async';
import { cx } from '../../../../lib/cx';
import { useGame } from '../../context/GameContext';
import styles from '../Player.module.css';

/** Personagens que chamaram você para a aliança deles. Responder não gasta conversa. */
export function InvitesPanel({ me }: Readonly<{ me: PlayerView }>) {
  const { seasonId, refresh, playersById } = useGame();
  const { simulation } = useServices();
  const answer = useAction((inviterId: string, groupId: string | null, accept: boolean) => simulation.answerInvite(seasonId, inviterId, groupId, accept));

  async function reply(inviterId: string, groupId: string | null, accept: boolean) {
    if (await answer.run(inviterId, groupId, accept)) refresh();
  }

  return (
    <section className={cx(styles.panel, styles.invites)}>
      <h3 className={styles.panelTitle}>Convites para aliança</h3>
      <p className={styles.panelHint}>Cada aliança é um grupo à parte: você pode estar em mais de uma (até 3), com gente diferente em cada. Recusar magoa quem chamou; ignorar também.</p>
      {me.invites.map((invite) => {
        const inviter = playersById.get(invite.fromId);
        if (!inviter) return null;
        const members = invite.memberIds.filter((id) => id !== invite.fromId).flatMap((id) => playersById.get(id) ?? []);
        return (
          <div key={`${invite.fromId}:${invite.groupId ?? 'nova'}`} className={styles.invite}>
            <div className={styles.inviteFaces}>
              {[inviter, ...members].map((p) => (
                <Portrait key={p.id} name={p.name} imageUrl={p.imageUrl} size="xs" hideName />
              ))}
            </div>
            <p className={styles.inviteText}>
              <strong>{inviter.name}</strong>{' '}
              {members.length > 0 ? <>chamou você para a aliança com {members.map((p) => p.name).join(', ')}.</> : <>quer fechar uma aliança nova, só vocês dois.</>}
            </p>
            <div className={styles.inviteActions}>
              <Button variant="quiet" size="sm" pending={answer.pending} onClick={fireAndForget(() => reply(invite.fromId, invite.groupId, false))}>
                Recusar
              </Button>
              <Button size="sm" pending={answer.pending} onClick={fireAndForget(() => reply(invite.fromId, invite.groupId, true))}>
                Aceitar
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
