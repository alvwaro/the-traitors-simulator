import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/auth';
import { useServices } from '../../app/services';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { Field, Input } from '../../components/ui/Form';
import { Modal, ModalActions } from '../../components/ui/Modal';
import type { Publication, SeasonDetails } from '../../domain/models';
import { useAction } from '../../hooks/useAction';

/**
 * Copia uma temporada publicada inteira para a Minha Área: uma temporada nova, em preparação, com as mesmas
 * configurações e o elenco publicado. No modo Jogador, pede o nome de quem vai entrar no castelo.
 */
export function CopySeasonModal({ publication, onClose }: Readonly<{ publication: Publication | null; onClose: () => void }>) {
  const { publications } = useServices();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [you, setYou] = useState('');
  const [created, setCreated] = useState<SeasonDetails | null>(null);
  const playerMode = publication?.season?.mode === 'PLAYER';

  const copy = useAction(
    (p: Publication) =>
      publications.copySeason(p.id, {
        name: name.trim() || undefined,
        human: playerMode ? { name: you.trim() || (user?.username ?? '') } : undefined,
      }),
    { success: (s) => `Temporada "${s.name}" na Minha Área` },
  );

  function close() {
    setName('');
    setYou('');
    setCreated(null);
    onClose();
  }

  async function handleCopy() {
    if (!publication) return;
    const season = await copy.run(publication);
    if (season) setCreated(season);
  }

  if (created) {
    return (
      <Modal
        open={!!publication}
        title="Temporada copiada"
        onClose={close}
        footer={
          <>
            <Button variant="quiet" onClick={close}>
              Fechar
            </Button>
            <ButtonLink to={`/temporadas/${created.id}`}>Abrir a temporada</ButtonLink>
          </>
        }
      >
        <p>
          "{created.name}" está nas suas temporadas, na <Link to="/minha-area">Minha Área</Link>, com as mesmas configurações e o elenco. Ajuste o que quiser e comece quando estiver pronto(a).
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open={!!publication}
      title="Copiar temporada"
      onClose={close}
      footer={<ModalActions onCancel={close} confirmLabel="Copiar temporada" pending={copy.pending} onConfirm={handleCopy} />}
    >
      <Field label="Nome da temporada">
        {(id) => <Input id={id} value={name} placeholder={publication?.name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
      </Field>
      {playerMode && (
        <Field label="Seu nome no castelo" hint="No modo Jogador você entra como mais um participante.">
          {(id) => <Input id={id} value={you} placeholder={user?.username} maxLength={80} onChange={(e) => setYou(e.target.value)} />}
        </Field>
      )}
      <p>
        A temporada vai para a Minha Área com as mesmas configurações (missões, prêmio, moeda...) e o elenco publicado, pronta para começar.
        Personagens que você já tem (mesmo nome) são reaproveitados; os outros são criados.
      </p>
    </Modal>
  );
}
