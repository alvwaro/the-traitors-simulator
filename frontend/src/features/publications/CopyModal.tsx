import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useServices } from '../../app/services';
import { Button } from '../../components/ui/Button';
import { ButtonLink } from '../../components/ui/ButtonLink';
import { Field, Input } from '../../components/ui/Form';
import { Modal, ModalActions } from '../../components/ui/Modal';
import type { CopyResult, Publication } from '../../domain/models';
import { useAction } from '../../hooks/useAction';

/**
 * Copia uma publicação para a biblioteca. Casts e temporadas viram um cast pronto para jogar;
 * personagens entram na biblioteca. Personagens com o mesmo nome dos seus são reaproveitados.
 */
export function CopyModal({ publication, onClose }: Readonly<{ publication: Publication | null; onClose: () => void }>) {
  const { publications } = useServices();
  const [name, setName] = useState('');
  const [result, setResult] = useState<CopyResult | null>(null);
  const isCharacter = publication?.kind === 'CHARACTER';

  const copy = useAction((p: Publication) => publications.copy(p.id, isCharacter ? undefined : name.trim() || undefined), {
    success: (r) => (r.cast ? `Cast "${r.cast.name}" salvo na sua biblioteca` : `Personagem "${r.character?.name}" na sua biblioteca`),
  });

  function close() {
    setName('');
    setResult(null);
    onClose();
  }

  async function handleCopy() {
    if (!publication) return;
    const r = await copy.run(publication);
    if (r) setResult(r);
  }

  if (result) {
    return (
      <Modal
        open={!!publication}
        title="Copiado para a sua biblioteca"
        onClose={close}
        footer={
          <>
            <Button variant="quiet" onClick={close}>
              Fechar
            </Button>
            {result.cast ? (
              <ButtonLink to={`/temporadas/nova?cast=${result.cast.id}`}>Começar uma temporada</ButtonLink>
            ) : (
              <ButtonLink to="/biblioteca/personagens">Ver personagens</ButtonLink>
            )}
          </>
        }
      >
        {result.cast ? (
          <p>
            O cast "{result.cast.name}" está na sua <Link to="/biblioteca">biblioteca</Link>, pronto para jogar.
          </p>
        ) : (
          <p>"{result.character?.name}" está na sua biblioteca de personagens.</p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      open={!!publication}
      title={isCharacter ? 'Salvar personagem' : 'Copiar para jogar'}
      onClose={close}
      footer={<ModalActions onCancel={close} confirmLabel={isCharacter ? 'Salvar na biblioteca' : 'Copiar'} pending={copy.pending} onConfirm={handleCopy} />}
    >
      {!isCharacter && (
        <Field label="Nome do cast" hint="Se você já tiver um cast com esse nome, um número é acrescentado.">
          {(id) => <Input id={id} value={name} placeholder={publication?.name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
        </Field>
      )}
      <p>
        {publication?.kind === 'SEASON' ? 'O elenco da temporada, como foi publicado, vira um cast na sua biblioteca. ' : ''}
        Personagens que você já tem (mesmo nome) são reaproveitados; os outros são criados com foto e comportamentos.
      </p>
    </Modal>
  );
}
