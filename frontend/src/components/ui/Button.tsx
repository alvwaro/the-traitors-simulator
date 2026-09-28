import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

type Variant = 'primary' | 'ghost' | 'danger' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  pending?: boolean;
}

export function Button({ variant = 'primary', size = 'md', pending, disabled, className, children, ...rest }: Readonly<ButtonProps>) {
  return (
    <button
      type="button"
      className={cx(styles.button, styles[variant], styles[size], pending && styles.pending, className)}
      disabled={disabled || pending}
      {...rest}
    >
      {children}
    </button>
  );
}
