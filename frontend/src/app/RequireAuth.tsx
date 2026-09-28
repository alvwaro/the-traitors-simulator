import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '../components/ui/States';
import { useAuth } from './auth';

/** O site inteiro exige login: visitantes vão para a tela de entrada e voltam para cá depois. */
export function RequireAuth({ children }: Readonly<{ children?: ReactNode }>) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Loading />;
  if (!user) return <Navigate to={`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children ?? <Outlet />;
}
