import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { fireAndForget } from '../../lib/async';
import { Button } from './Button';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  dramatic?: boolean;
  /** Largo: para conteúdo em colunas. */
  wide?: boolean;
  children: ReactNode;
}

/**
 * Diálogo modal acessível: ao abrir, o foco vai para o campo marcado com `data-autofocus` (ou para o próprio
 * diálogo) e, ao fechar, volta para quem abriu. Fecha pelo Esc ou clicando fora (um botão nativo cobre o fundo).
 */
export function Modal({ open, title, onClose, footer, dramatic, wide, children }: Readonly<ModalProps>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // O último onClose recebido: o efeito abaixo só roda ao abrir/fechar, não a cada nova função do pai.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    (dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog)?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={styles.backdrop}>
      <button type="button" className={styles.dismiss} aria-label="Fechar" tabIndex={-1} onClick={() => onCloseRef.current()} />
      <div
        ref={dialogRef}
        className={cx(styles.dialog, dramatic && styles.dramatic, wide && styles.wide)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        {title && (
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ModalActionsProps {
  onCancel: () => void;
  confirmLabel: ReactNode;
  onConfirm: () => unknown;
  pending?: boolean;
  disabled?: boolean;
  /** Ação destrutiva (apagar, remover): botão vermelho. */
  danger?: boolean;
  /** Ações extras antes do "Cancelar" (ex.: "Voltar a sortear"). */
  extra?: ReactNode;
}

/** Rodapé padrão dos diálogos: Cancelar e a ação principal. */
export function ModalActions({ onCancel, confirmLabel, onConfirm, pending, disabled, danger, extra }: Readonly<ModalActionsProps>) {
  return (
    <>
      {extra}
      <Button variant="quiet" onClick={onCancel}>
        Cancelar
      </Button>
      <Button variant={danger ? 'danger' : 'primary'} pending={pending} disabled={disabled} onClick={fireAndForget(async () => onConfirm())}>
        {confirmLabel}
      </Button>
    </>
  );
}

interface ConfirmModalProps extends Omit<ModalActionsProps, 'onCancel' | 'extra'> {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Diálogo de confirmação: título, a explicação e Cancelar/confirmar. */
export function ConfirmModal({ open, title, onClose, children, ...actions }: Readonly<ConfirmModalProps>) {
  return (
    <Modal open={open} title={title} onClose={onClose} footer={<ModalActions onCancel={onClose} {...actions} />}>
      {children}
    </Modal>
  );
}
