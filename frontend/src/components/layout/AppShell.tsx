import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/auth';
import { fireAndForget } from '../../lib/async';
import { cx } from '../../lib/cx';
import styles from './AppShell.module.css';

const LINKS = [
  { to: '/', label: 'Início', end: true },
  { to: '/biblioteca', label: 'Biblioteca', end: false },
  { to: '/guia', label: 'Guia das temporadas', end: false },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/entrar', { replace: true });
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.crest}>
            <span className={styles.crestTitle}>The Traitors</span>
            <span className={styles.crestSub}>Registro do Castelo</span>
          </Link>
          <nav className={styles.nav} aria-label="Principal">
            {LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => cx(styles.link, isActive && styles.active)}>
                {link.label}
              </NavLink>
            ))}
            {user && (
              <span className={styles.account}>
                <NavLink to="/minha-area" className={({ isActive }) => cx(styles.link, isActive && styles.active)}>
                  {user.username}
                  {user.role === 'OWNER' && <span className={styles.ownerBadge}>dono</span>}
                </NavLink>
                <button type="button" className={styles.logout} onClick={fireAndForget(handleLogout)}>
                  Sair
                </button>
              </span>
            )}
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>Não confie em ninguém · Highlands da Escócia</footer>
    </div>
  );
}
