import { useMemo } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ToastProvider } from '../components/feedback/ToastProvider';
import { router } from './router';
import { AuthProvider } from './auth';
import { createServices, ServicesProvider } from './services';

export function App() {
  const services = useMemo(() => createServices(), []);
  return (
    <ServicesProvider services={services}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </ServicesProvider>
  );
}
