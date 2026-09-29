import { useCallback, useState, type FormEvent } from 'react';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USERNAME_MAX_LENGTH } from '@traitors/shared';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/auth';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Form';
import { Loading } from '../../components/ui/States';
import { useAction } from '../../hooks/useAction';
import { fireAndForget } from '../../lib/async';
import { safeReturn } from '../../lib/safeReturn';
import styles from './LoginPage.module.css';

type Mode = 'login' | 'register';

/**
 * Porta de entrada do site: só o login (ou cadastro), sem nada do castelo por trás.
 * Depois de entrar, volta para a página que pediu o login.
 */
export function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const back = safeReturn(params.get('voltar'));
  // A tela só serve para entrar: o cursor já começa no usuário (assim que o campo aparece).
  const focusOnMount = useCallback((input: HTMLInputElement | null) => input?.focus(), []);

  const submit = useAction((m: Mode) => (m === 'login' ? login({ username, password }) : register({ username, password })), {
    success: (u) => `Bem-vindo(a) ao castelo, ${u.username}`,
  });

  if (user === undefined) return <Loading />;
  if (user) return <Navigate to={back} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (await submit.run(mode)) navigate(back, { replace: true });
  }

  const registering = mode === 'register';
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <header className={styles.brand}>
          <p className={styles.title}>The Traitors</p>
          <p className={styles.subtitle}>Registro do Castelo</p>
        </header>

        <h1 className={styles.heading}>{registering ? 'Criar conta' : 'Entrar'}</h1>
        <form className={styles.form} onSubmit={fireAndForget(handleSubmit)}>
          <Field label="Usuário" hint={registering ? 'De 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.' : undefined}>
            {(id) => <Input ref={focusOnMount} id={id} value={username} autoComplete="username" maxLength={USERNAME_MAX_LENGTH} required onChange={(e) => setUsername(e.target.value)} />}
          </Field>
          <Field label="Senha" hint={registering ? `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` : undefined}>
            {(id) => (
              <Input
                id={id}
                type="password"
                value={password}
                autoComplete={registering ? 'new-password' : 'current-password'}
                minLength={registering ? PASSWORD_MIN_LENGTH : undefined}
                maxLength={PASSWORD_MAX_LENGTH}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" size="lg" pending={submit.pending}>
            {registering ? 'Criar conta' : 'Entrar'}
          </Button>
        </form>

        <p className={styles.switch}>
          {registering ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
          <button type="button" className={styles.switchButton} onClick={() => setMode(registering ? 'login' : 'register')}>
            {registering ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </div>
      <p className={styles.footer}>Não confie em ninguém · Highlands da Escócia</p>
    </main>
  );
}
