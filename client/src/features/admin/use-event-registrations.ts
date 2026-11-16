import { useQuery } from '@tanstack/react-query';
import {
  adminEventKeys,
  listEventRegistrations,
} from './events-api';

/**
 * One event's registrations, fetched the first time its row is opened. The
 * cache keeps the answer, so collapsing and reopening the panel is instant
 * rather than a second request.
 */
export function useEventRegistrations(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: adminEventKeys.registrations(eventId),
    queryFn: () => listEventRegistrations(eventId),
    enabled,
    staleTime: 15_000,
    // A 404 on the event cannot turn into a registration by retrying.
    retry: false,
  });
}
