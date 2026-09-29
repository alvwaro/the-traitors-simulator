import { useState } from 'react';
import { useAuth } from '../../app/auth';
import { useServices } from '../../app/services';
import { PortraitGrid } from '../../components/player/PortraitGrid';
import { ConfirmModal, Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/States';
import type { Publication } from '../../domain/models';
import { useAction } from '../../hooks/useAction';
import cardStyles from '../library/components/Library.module.css';
import { CopyModal } from './CopyModal';
import { PublicationCard } from './PublicationCard';

interface ShelfProps {
  publications: Publication[];
  empty: string;
  onChanged: () => void;
  /** Mostra em qual área cada item está (lista da Minha Área). */
  showArea?: boolean;
}

/** Grade de publicações com as ações de ver elenco, copiar e tirar da vitrine. */
export function PublicationShelf({ publications, empty, onChanged, showArea }: Readonly<ShelfProps>) {
  const { user } = useAuth();
  const { publications: service } = useServices();
  const [viewing, setViewing] = useState<Publication | null>(null);
  const [copying, setCopying] = useState<Publication | null>(null);
  const [removing, setRemoving] = useState<Publication | null>(null);

  const remove = useAction(
    async (id: string) => {
      await service.unpublish(id);
      return true;
    },
    { success: 'Tirado da vitrine' },
  );

  async function handleRemove() {
    if (!removing) return;
    const ok = await remove.run(removing.id);
    setRemoving(null);
    if (ok) onChanged();
  }

  if (publications.length === 0) return <EmptyState title={empty} />;

  const items = (viewing?.snapshot?.characters ?? []).map((c) => ({ ...c, id: c.key }));
  return (
    <>
      <div className={cardStyles.castGrid}>
        {publications.map((p) => (
          <PublicationCard
            key={p.id}
            publication={p}
            showArea={showArea}
            canRemove={!!user && (user.role === 'OWNER' || user.id === p.publisherId)}
            onView={() => setViewing(p)}
            onCopy={() => setCopying(p)}
            onRemove={() => setRemoving(p)}
          />
        ))}
      </div>

      <Modal open={!!viewing} wide title={viewing?.name} onClose={() => setViewing(null)}>
        {viewing?.description && <p className={cardStyles.castDescription}>{viewing.description}</p>}
        <PortraitGrid items={items} size="sm" caption={(c) => c.behaviors.map((b) => b.name).join(', ') || undefined} />
      </Modal>

      <CopyModal publication={copying} onClose={() => setCopying(null)} />

      <ConfirmModal open={!!removing} title="Tirar da vitrine" onClose={() => setRemoving(null)} confirmLabel="Tirar da vitrine" danger pending={remove.pending} onConfirm={handleRemove}>
        <p>"{removing?.name}" deixa de aparecer para todos. Quem já copiou continua com a cópia.</p>
      </ConfirmModal>
    </>
  );
}
