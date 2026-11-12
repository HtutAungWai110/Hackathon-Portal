import { useMutation, useQueryClient } from '@tanstack/react-query';
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
      await queryClient.invalidateQueries({ queryKey: adminEventKeys.all });
    },
  });
}
