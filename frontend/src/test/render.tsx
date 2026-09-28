import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider } from '../app/auth';
import { routes } from '../app/router';
import { createServices, ServicesProvider } from '../app/services';
import { ToastProvider } from '../components/feedback/ToastProvider';
import { FakeApi } from './fakeApi';

/** Monta o site inteiro numa rota, com a API falsa (gravada). */
export function renderApp(path: string, api = new FakeApi()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const view = render(
    <ServicesProvider services={createServices(api)}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </ServicesProvider>,
  );
  return { ...view, api, router, user };
}

/** Espera a tela sair do "carregando". */
export async function settled() {
  await waitFor(() => expect(screen.queryByText(/Acendendo as velas/i)).not.toBeInTheDocument());
}
