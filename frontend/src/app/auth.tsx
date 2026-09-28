import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '../domain/models';
import type { Credentials } from '../services/api/AuthService';
import { useServices } from './services';

interface AuthValue {
  /** undefined = ainda carregando; null = visitante. */
  user: User | null | undefined;
  isOwner: boolean;
  login(credentials: Credentials): Promise<User>;
  register(credentials: Credentials): Promise<User>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Quem está logado, para toda a interface (a sessão em si fica no cookie do servidor). */
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { auth } = useServices();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    auth.me().then(setUser, () => setUser(null));
  }, [auth]);

  const login = useCallback(async (credentials: Credentials) => {
    const next = await auth.login(credentials);
    setUser(next);
    return next;
  }, [auth]);

  const register = useCallback(async (credentials: Credentials) => {
    const next = await auth.register(credentials);
    setUser(next);
    return next;
  }, [auth]);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, [auth]);

  const value = useMemo(() => ({ user, isOwner: user?.role === 'OWNER', login, register, logout }), [user, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return value;
}
