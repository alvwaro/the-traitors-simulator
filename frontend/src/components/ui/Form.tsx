import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Form.module.css';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}

/** Rótulo + controle; o id é gerado e repassado ao controle. */
export function Field({ label, hint, className, children }: Readonly<FieldProps>) {
  const id = useId();
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id)}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

export function Input({ className, ...props }: Readonly<InputHTMLAttributes<HTMLInputElement>>) {
  return <input className={cx(styles.control, className)} {...props} />;
}

export function TextArea({ className, ...props }: Readonly<TextareaHTMLAttributes<HTMLTextAreaElement>>) {
  return <textarea className={cx(styles.control, styles.textarea, className)} {...props} />;
}

export function Select({ className, children, ...props }: Readonly<SelectHTMLAttributes<HTMLSelectElement>>) {
  return (
    <select className={cx(styles.control, styles.select, className)} {...props}>
      {children}
    </select>
  );
}

interface CheckProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  type?: 'checkbox' | 'radio';
}

export function Check({ label, className, type = 'checkbox', ...props }: Readonly<CheckProps>) {
  return (
    <label className={cx(styles.check, className)}>
      <input type={type} {...props} />
      <span>{label}</span>
    </label>
  );
}

export function FormRow({ children }: Readonly<{ children: ReactNode }>) {
  return <div className={styles.row}>{children}</div>;
}
