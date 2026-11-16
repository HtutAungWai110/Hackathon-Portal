import { useQuery } from '@tanstack/react-query';
import { adminEventKeys, getAdminEvent } from './events-api';

/**
 * One event for the edit screen. It shares `adminEventKeys.detail` with the
 * admin preview on the public page, so both reads answer from one cache entry.
 */
export function useAdminEvent(id: string) {
  return useQuery({
    queryKey: adminEventKeys.detail(id),
    queryFn: () => getAdminEvent(id),
    enabled: id.length > 0,
    retry: false,
    staleTime: 30_000,
  });
}
