import { useQuery } from '@tanstack/react-query';
import { hackathonKeys, listHackathons } from './hackathon-api';

/**
 * The public calendar on the home page. The API already filters drafts out and
 * orders by start date; the card section decides how to present past events.
 *
 * The admin mutations invalidate `hackathonKeys.all`, which is a prefix of this
 * key, so publishing or deleting an event refreshes this list without a reload.
 */
export function useHackathons() {
  return useQuery({
    queryKey: hackathonKeys.list,
    queryFn: listHackathons,
    staleTime: 60_000,
  });
}
