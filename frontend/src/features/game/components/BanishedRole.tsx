import { roleLabel } from '../../../domain/labels';
import type { Player } from '../../../domain/models';

/**
 * O papel de quem foi banido(a). Na reta final a mesa não descobre: o participante vê "não revelado";
 * quem assiste (automática ou já eliminado) sabe a verdade, com o aviso de que a mesa não soube.
 */
export function BanishedRole({ player, traitorClass, faithfulClass }: Readonly<{ player: Player; traitorClass?: string; faithfulClass?: string }>) {
  const known = !player.roleUnknown;
  const cls = player.role === 'TRAITOR' ? traitorClass : faithfulClass;
  if (!player.roleHidden) return <span className={cls}>{roleLabel[player.role]}</span>;
  if (!known) return <span>papel não revelado</span>;
  return (
    <span>
      não revelado à mesa · quem assiste sabe: <span className={cls}>{roleLabel[player.role]}</span>
    </span>
  );
}
