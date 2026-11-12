import { Suspense, lazy } from 'react';
import { StatusScreen } from '../../components/StatusScreen';

/**
 * Same reasoning as the dashboard route: the form carries cmdk and Radix, so
 * it loads only when an admin opens it.
 */
const CreateHackathonPage = lazy(() =>
  import('./CreateHackathonPage').then((module) => ({
    default: module.CreateHackathonPage,
  })),
);

export function CreateHackathonRoute() {
  return (
    <Suspense fallback={<StatusScreen busy title="Opening the form" />}>
      <CreateHackathonPage />
    </Suspense>
  );
}
