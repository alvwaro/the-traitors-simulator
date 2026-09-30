import { useEffect, useState } from 'react';
import { useAuth } from '../../app/auth';
import { useServices } from '../../app/services';
import { Button } from '../../components/ui/Button';
import { Check, Field, TextArea } from '../../components/ui/Form';
import { Modal, ModalActions } from '../../components/ui/Modal';
import type { Publication, PublicationArea, PublicationKind } from '../../domain/models';
import { useAction } from '../../hooks/useAction';
import { fireAndForget } from '../../lib/async';
import { areaLabel, kindExplanation, kindLabel } from './labels';
import styles from './Publications.module.css';

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
 * Donos escolhem: temporada oficial (participantes reais) ou Área de Fãs; fãs publicam na Área de Fãs.
 */
export function PublishModal({ target, current, blockedReason, onClose, onDone }: Readonly<PublishModalProps>) {
  const { publications } = useServices();
  const { isOwner } = useAuth();
  const [description, setDescription] = useState('');
  const [chosen, setChosen] = useState<PublicationArea>('OFFICIAL');
  const area: PublicationArea = isOwner ? chosen : 'FAN';

  useEffect(() => {
    if (!target) return;
    setDescription(current?.description ?? '');
    setChosen(current?.area ?? 'OFFICIAL');
  }, [target, current]);

  const publish = useAction(() => publications.publish(target!.kind, target!.id, description.trim() || null, isOwner ? area : undefined), {
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
          confirmLabel={current && current.area === area ? 'Atualizar publicação' : 'Publicar'}
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
          {isOwner && (
            <fieldset className={styles.areaChoice}>
              <legend>Onde publicar</legend>
              <Check type="radio" name="publication-area" label="Oficial: temporada real, com os participantes de verdade" checked={area === 'OFFICIAL'} onChange={() => setChosen('OFFICIAL')} />
              <Check type="radio" name="publication-area" label="Área de Fãs: uma versão sua, como qualquer fã" checked={area === 'FAN'} onChange={() => setChosen('FAN')} />
            </fieldset>
          )}
          <p>
            "{target?.name}" {current?.area === area ? 'está' : 'vai ficar'} em <strong>{areaLabel[area]}</strong>. {target && kindExplanation[target.kind]}
          </p>
          <Field label="Descrição (opcional)">
            {(id) => <TextArea id={id} value={description} maxLength={500} rows={3} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
        </>
      )}
    </Modal>
  );
}
