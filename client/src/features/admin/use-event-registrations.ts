import { useQuery } from '@tanstack/react-query';
import {
  adminEventKeys,
  listEventRegistrations,
} from './events-api';
import type { RegistrationsQuery } from './events-api';

/**
 * One page's applications for one event, fetched the first time the drawer
 * opens or the page loads. The cache keeps the answer, so collapsing and
 * reopening the panel is instant rather than a second request.
 */
export function useEventRegistrations(
  eventId: string,
  enabled: boolean,
  query: RegistrationsQuery = { page: 1, limit: 10 },
) {
  return useQuery({
    queryKey: adminEventKeys.registrations(eventId, query),
    queryFn: () => listEventRegistrations(eventId, query),
    enabled,
    staleTime: 15_000,
    // A 404 on the event cannot turn into an application by retrying.
    retry: false,
  });
}
