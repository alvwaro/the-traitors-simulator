import { useState } from 'react';
import { useServices } from '../../../app/services';
import { Button } from '../../../components/ui/Button';
import { useResource } from '../../../hooks/useResource';
import { CopyModal } from '../../publications/CopyModal';

/** Ação de quem assiste a uma temporada publicada: copiar o elenco para jogar. */
export function WatchActions({ seasonId }: Readonly<{ seasonId: string }>) {
  const { publications } = useServices();
  const list = useResource(() => publications.list({ kind: 'SEASON' }), []);
  const [copying, setCopying] = useState(false);
  const publication = list.data?.find((p) => p.seasonId === seasonId) ?? null;

  if (!publication) return null;
  return (
    <>
      <Button variant="ghost" onClick={() => setCopying(true)}>
        Copiar elenco para jogar
      </Button>
      <CopyModal publication={copying ? publication : null} onClose={() => setCopying(false)} />
    </>
  );
}
