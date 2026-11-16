import { useMutation, useQueryClient } from '@tanstack/react-query';
import { hackathonKeys } from '../hackathon/hackathon-api';
import {
  adminEventKeys,
  publishAdminEvent,
} from './events-api';

/** Moves one draft onto the public calendar. */
export function usePublishEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => publishAdminEvent(id),
    onSuccess: async () => {
      // Publishing is the moment the event becomes visible on the home page,
      // so the public list has to forget its cached copy.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminEventKeys.all }),
        queryClient.invalidateQueries({ queryKey: hackathonKeys.all }),
      ]);
    },
  });
}
