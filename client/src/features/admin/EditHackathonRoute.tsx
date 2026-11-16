import { Suspense, lazy } from 'react';
import { StatusScreen } from '../../components/StatusScreen';

/**
 * Same reasoning as the create route: the form carries cmdk and Radix, so it
 * loads only when an admin opens it.
 */
const EditHackathonPage = lazy(() =>
  import('./EditHackathonPage').then((module) => ({
    default: module.EditHackathonPage,
  })),
);

export function EditHackathonRoute() {
  return (
    <Suspense fallback={<StatusScreen busy title="Opening the event" />}>
      <EditHackathonPage />
    </Suspense>
  );
}
