import { Link, type LinkProps } from 'react-router-dom';
import { cx } from '../../lib/cx';
import styles from './Button.module.css';

interface ButtonLinkProps extends LinkProps {
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

/** Link de navegação com a aparência de botão. */
export function ButtonLink({ variant = 'primary', size = 'md', className, ...props }: Readonly<ButtonLinkProps>) {
  return <Link className={cx(styles.button, styles[variant], styles[size], styles.link, className)} {...props} />;
}
