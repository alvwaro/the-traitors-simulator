import { useEffect, useState } from 'react';
import { useAuth } from '../../app/auth';
import { useServices } from '../../app/services';
import { Button } from '../../components/ui/Button';
import { Field, TextArea } from '../../components/ui/Form';
import { Modal, ModalActions } from '../../components/ui/Modal';
import type { Publication, PublicationKind } from '../../domain/models';
import { useAction } from '../../hooks/useAction';
import { fireAndForget } from '../../lib/async';
import { areaLabel, kindExplanation, kindLabel } from './labels';

interface PublishModalProps {
  /** O que publicar (null = fechado). */
  target: { kind: PublicationKind; id: string; name: string } | null;
  /** A publicação que já existe dessa origem, se houver. */
  current: Publication | null;
  /** Motivo para não poder publicar (ex.: cast pequeno demais). */
  blockedReason?: string | null;
  onClose: () => void;
  /** Depois de publicar, atualizar ou tirar da vitrine. */
  onDone: () => void;
}

/**
 * Publica uma temporada, cast ou personagem da Minha Área.
 * Donos publicam no Castelo (Área Oficial); fãs, na Área de Fãs.
 */
export function PublishModal({ target, current, blockedReason, onClose, onDone }: Readonly<PublishModalProps>) {
  const { publications } = useServices();
  const { isOwner } = useAuth();
  const [description, setDescription] = useState('');
  const area = current?.area ?? (isOwner ? 'OFFICIAL' : 'FAN');

  useEffect(() => {
    if (target) setDescription(current?.description ?? '');
  }, [target, current]);

  const publish = useAction(() => publications.publish(target!.kind, target!.id, description.trim() || null), {
    success: (p) => (current ? `Publicação de "${p.name}" atualizada` : `"${p.name}" publicado em ${areaLabel[p.area]}`),
  });
  const unpublish = useAction(
    async () => {
      await publications.unpublish(current!.id);
      return true;
    },
    { success: 'Tirado da vitrine' },
  );

  async function run(action: typeof publish | typeof unpublish) {
    if (await action.run()) {
      onDone();
      onClose();
    }
  }

  return (
    <Modal
      open={!!target}
      title={current ? 'Publicação' : `Publicar ${kindLabel[target?.kind ?? 'CAST']}`}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          confirmLabel={current ? 'Atualizar publicação' : 'Publicar'}
          pending={publish.pending}
          disabled={!!blockedReason}
          onConfirm={() => run(publish)}
          extra={
            current && (
              <Button variant="danger" pending={unpublish.pending} onClick={fireAndForget(() => run(unpublish))}>
                Tirar da vitrine
              </Button>
            )
          }
        />
      }
    >
      {blockedReason ? (
        <p>{blockedReason}</p>
      ) : (
        <>
          <p>
            "{target?.name}" {current ? 'está' : 'vai ficar'} em <strong>{areaLabel[area]}</strong>. {target && kindExplanation[target.kind]}
          </p>
          <Field label="Descrição (opcional)">
            {(id) => <TextArea id={id} value={description} maxLength={500} rows={3} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
        </>
      )}
    </Modal>
  );
}
