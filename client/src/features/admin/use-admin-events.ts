import { useQuery } from '@tanstack/react-query';
import { adminEventKeys, listAdminEvents } from './events-api';

/** The console's list: every status, drafts included. */
export function useAdminEvents() {
  return useQuery({
    queryKey: adminEventKeys.all,
    queryFn: listAdminEvents,
    staleTime: 30_000,
  });
}
