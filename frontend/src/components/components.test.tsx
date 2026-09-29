import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { IdentityFields } from './player/IdentityFields';
import { ConfirmModal, Modal, ModalActions } from './ui/Modal';

function Harness({ autofocus }: Readonly<{ autofocus: boolean }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Modal open={open} title="Ficha" onClose={() => setOpen(false)}>
        <input aria-label="Nome" data-autofocus={autofocus || undefined} />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('leva o foco ao campo marcado, fecha com Esc e devolve o foco a quem abriu', async () => {
    const user = userEvent.setup();
    render(<Harness autofocus />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Ficha' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('sem campo marcado, o foco vai para o diálogo; clicar fora fecha', async () => {
    const user = userEvent.setup();
    render(<Harness autofocus={false} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('não reage ao Esc depois de fechado', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open title="A" onClose={onClose}>
        <p>conteúdo</p>
      </Modal>,
    );
    rerender(
      <Modal open={false} title="A" onClose={onClose}>
        <p>conteúdo</p>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ConfirmModal e ModalActions', () => {
  it('confirma, cancela e mostra ações extras', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmModal open title="Apagar?" onClose={onClose} confirmLabel="Apagar" danger onConfirm={onConfirm}>
        <p>Não dá para desfazer.</p>
      </ConfirmModal>,
    );
    expect(screen.getByRole('dialog', { name: 'Apagar?' })).toHaveTextContent('Não dá para desfazer.');
    await user.click(screen.getByRole('button', { name: 'Apagar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('desabilita a ação principal enquanto não pode confirmar', () => {
    render(<ModalActions onCancel={vi.fn()} confirmLabel="Salvar" onConfirm={vi.fn()} disabled extra={<button type="button">Extra</button>} />);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
  });
});

describe('IdentityFields', () => {
  it('edita nome e foto e respeita o obrigatório', async () => {
    const user = userEvent.setup();
    const onName = vi.fn();
    const onImageUrl = vi.fn();
    const { rerender } = render(<IdentityFields name="" imageUrl="" onName={onName} onImageUrl={onImageUrl} namePlaceholder="Ex.: Lady Morag" />);
    expect(screen.getByLabelText('Nome')).toBeRequired();
    expect(screen.getByPlaceholderText('Ex.: Lady Morag')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome'), 'A');
    await user.type(screen.getByLabelText('Link da imagem'), 'h');
    expect(onName).toHaveBeenCalledWith('A');
    expect(onImageUrl).toHaveBeenCalledWith('h');

    rerender(<IdentityFields name="Ana" imageUrl="" onName={onName} onImageUrl={onImageUrl} nameLabel="Seu nome" imageLabel="Sua foto" required={false} />);
    expect(screen.getByLabelText('Seu nome')).not.toBeRequired();
    expect(screen.getByLabelText('Sua foto')).toHaveAttribute('type', 'url');
  });
});
