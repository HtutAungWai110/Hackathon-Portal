import { Suspense, lazy } from 'react';
import { StatusScreen } from '../../components/StatusScreen';

/**
 * The console is the only screen that needs cmdk and Radix, so it ships as its
 * own chunk. Participants never download the picker they cannot open.
 */
const AdminDashboardPage = lazy(() =>
  import('./AdminDashboardPage').then((module) => ({
    default: module.AdminDashboardPage,
  })),
);

export function AdminDashboardRoute() {
  return (
    <Suspense fallback={<StatusScreen busy title="Opening the desk" />}>
      <AdminDashboardPage />
    </Suspense>
  );
}
