import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FeelingMeters, FeelingsEditor, NEUTRAL_FEELINGS } from './FeelingsEditor';

describe('FeelingsEditor', () => {
  it('ajusta os sentimentos e salva só eles (sem os ids do par)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <FeelingsEditor
        from={{ name: 'Ana' }}
        to={{ name: 'Bia' }}
        initial={{ fromId: 'a', toId: 'b', ...NEUTRAL_FEELINGS } as typeof NEUTRAL_FEELINGS}
        pending={false}
        onClose={vi.fn()}
        onSave={onSave}
        extra={<button type="button">Voltar a sortear</button>}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'O que Ana sente por Bia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar a sortear' })).toBeInTheDocument();

    const [trust, liking, hatred] = screen.getAllByRole('slider');
    fireEvent.change(trust, { target: { value: '90' } });
    fireEvent.change(liking, { target: { value: '70' } });
    fireEvent.change(hatred, { target: { value: '5' } });
    await user.click(screen.getByRole('checkbox', { name: /Aliança entre Ana e Bia/ }));
    expect(screen.getByText('90%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSave).toHaveBeenCalledWith({ trust: 90, liking: 70, hatred: 5, allied: true });
  });

  it('cancela sem salvar', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(<FeelingsEditor from={{ name: 'Ana' }} to={{ name: 'Bia' }} initial={NEUTRAL_FEELINGS} pending={false} onClose={onClose} onSave={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('FeelingMeters', () => {
  it('mostra confiança, simpatia e ódio', () => {
    render(<FeelingMeters feelings={{ trust: 10, liking: 20, hatred: 30, allied: false }} />);
    expect(screen.getByTitle('Confiança: 10')).toBeInTheDocument();
    expect(screen.getByTitle('Simpatia: 20')).toBeInTheDocument();
    expect(screen.getByTitle('Ódio: 30')).toBeInTheDocument();
  });
});
