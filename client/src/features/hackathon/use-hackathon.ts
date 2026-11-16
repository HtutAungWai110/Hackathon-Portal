import { useQuery } from '@tanstack/react-query';
import { getAdminEvent } from '../admin/events-api';
import {
  getHackathon,
  hackathonKeys,
  type PublicHackathon,
} from './hackathon-api';

type UseHackathonOptions = {
  /** Read the console view, which can return a draft or a cancelled event. */
  admin: boolean;
  /** False until the session is known, so the route is chosen once. */
  enabled: boolean;
};

/**
 * One event. A visitor goes through the public read, a signed in admin through
 * the console read, so a draft can be previewed before it is published.
 *
 * No retry on failure: a `404` means the event is not public or does not
 * exist, and repeating the request cannot change that.
 */
export function useHackathon(
  id: string,
  { admin, enabled }: UseHackathonOptions,
) {
  return useQuery({
    queryKey: hackathonKeys.detail(id, admin),
    queryFn: (): Promise<PublicHackathon> =>
      admin ? getAdminEvent(id) : getHackathon(id),
    enabled: enabled && id.length > 0,
    retry: false,
    staleTime: 60_000,
  });
}
