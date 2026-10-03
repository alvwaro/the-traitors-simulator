import { useEffect, useState } from 'react';
import { useAuth } from '../../app/auth';
import { useServices } from '../../app/services';
import { Button } from '../../components/ui/Button';
import { Check, Field, TextArea } from '../../components/ui/Form';
import { Modal, ModalActions } from '../../components/ui/Modal';
import type { Publication, PublicationCountry, PublicationKind } from '../../domain/models';
import { useAction } from '../../hooks/useAction';
import { fireAndForget } from '../../lib/async';
import { formatDate } from '../../lib/format';
import type { PublicationPlace } from '../../services/api/PublicationService';
import { countryLabel, kindExplanation, kindLabel, placeLabel } from './labels';
import styles from './Publications.module.css';

interface PublishModalProps {
  /** O que publicar (null = fechado). Temporadas sugerem o país pelas missões. */
  target: { kind: PublicationKind; id: string; name: string; country?: PublicationCountry } | null;
  /** A publicação que já existe dessa origem, se houver. */
  current: Publication | null;
  /** Motivo para não poder publicar (ex.: cast pequeno demais). */
  blockedReason?: string | null;
  onClose: () => void;
  /** Depois de publicar, atualizar ou tirar da vitrine. */
  onDone: () => void;
}

/** Para onde vai uma temporada publicada por um dono do site: uma das Temporadas Oficiais ou a Área de Fãs. */
type Destination = PublicationCountry | 'FAN';

const DESTINATIONS: readonly { value: Destination; label: string }[] = [
  { value: 'US', label: `Temporadas Oficiais · ${countryLabel.US}` },
  { value: 'UK', label: `Temporadas Oficiais · ${countryLabel.UK}` },
  { value: 'FAN', label: 'Área de Fãs: uma versão sua, como qualquer fã' },
];

function destinationOf(current: Publication | null, suggested: PublicationCountry | undefined): Destination {
  if (current) return current.area === 'OFFICIAL' && current.country ? current.country : 'FAN';
  return suggested ?? 'US';
}

const placeOf = (d: Destination): PublicationPlace => (d === 'FAN' ? { area: 'FAN' } : { area: 'OFFICIAL', country: d });

/**
 * Publica uma temporada, cast ou personagem da Minha Área (vai uma cópia do momento).
 * Donos escolhem onde entra uma temporada: Temporadas Oficiais dos EUA, do Reino Unido ou a Área de Fãs.
 * Casts, personagens e tudo o que os fãs publicam vão para a Área de Fãs.
 */
export function PublishModal({ target, current, blockedReason, onClose, onDone }: Readonly<PublishModalProps>) {
  const { publications } = useServices();
  const { isOwner } = useAuth();
  const [description, setDescription] = useState('');
  const [destination, setDestination] = useState<Destination>('US');
  const chooses = isOwner && target?.kind === 'SEASON';
  const place: PublicationPlace = chooses ? placeOf(destination) : { area: 'FAN' };
  const same = !!current && current.area === place.area && (current.country ?? undefined) === place.country;

  useEffect(() => {
    if (!target) return;
    setDescription(current?.description ?? '');
    setDestination(destinationOf(current, target.country));
  }, [target, current]);

  const publish = useAction(() => publications.publish(target!.kind, target!.id, description.trim() || null, chooses ? place : undefined), {
    success: (p) => (current ? `Publicação de "${p.name}" atualizada` : `"${p.name}" publicado em ${placeLabel(p)}`),
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
          confirmLabel={same ? 'Atualizar publicação' : 'Publicar'}
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
          {chooses && (
            <fieldset className={styles.areaChoice}>
              <legend>Onde publicar</legend>
              {DESTINATIONS.map((d) => (
                <Check key={d.value} type="radio" name="publication-place" label={d.label} checked={destination === d.value} onChange={() => setDestination(d.value)} />
              ))}
            </fieldset>
          )}
          <p>
            "{target?.name}" {same ? 'está' : 'vai ficar'} em <strong>{placeLabel({ area: place.area, country: place.country ?? null })}</strong>. {target && kindExplanation[target.kind]}
          </p>
          {current && <p className={styles.since}>A cópia na vitrine é de {formatDate(current.publishedAt)}.</p>}
          <Field label="Descrição (opcional)">
            {(id) => <TextArea id={id} value={description} maxLength={500} rows={3} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
        </>
      )}
    </Modal>
  );
}
