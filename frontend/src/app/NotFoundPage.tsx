import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/States';

export function NotFoundPage() {
  return (
    <EmptyState title="Este corredor não leva a lugar algum">
      <Link to="/">Voltar ao salão principal</Link>
    </EmptyState>
  );
}
