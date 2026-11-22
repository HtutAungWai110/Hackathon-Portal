import { Suspense, lazy } from 'react';
import { StatusScreen } from '../../components/StatusScreen';

/**
 * The console keeps its screens in their own chunk, so participants never
 * download the admin list they cannot open.
 */
const RegistrationsPage = lazy(() =>
  import('./RegistrationsPage').then((module) => ({
    default: module.RegistrationsPage,
  })),
);

export function RegistrationsRoute() {
  return (
    <Suspense fallback={<StatusScreen busy title="Reading registrations" />}>
      <RegistrationsPage />
    </Suspense>
  );
}
