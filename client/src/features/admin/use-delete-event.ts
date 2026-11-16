import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authErrorMessage } from '../../lib/auth-error';
import { hackathonKeys } from '../hackathon/hackathon-api';
import { pushMessage } from '../messages/message-store';
import { adminEventKeys, deleteAdminEvent } from './events-api';

export type DeleteEventInput = {
  id: string;
  /** Only used to name the event in the message; the API needs the id alone. */
  title: string;
};

/**
 * Deleting an event also deletes its sponsorships; the companies stay. Both
 * caches drop the row so neither the ledger nor a shared public link holds a
 * stale copy. The message is what confirms the deletion after the screen has
 * already navigated away from it.
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DeleteEventInput) => deleteAdminEvent(input.id),
    onSuccess: async (_deleted, input) => {
      pushMessage({
        tone: 'success',
        title: 'Event deleted',
        body: `${input.title} is off the calendar, and its sponsorships are gone.`,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminEventKeys.all }),
        queryClient.invalidateQueries({ queryKey: hackathonKeys.all }),
      ]);
    },
    onError: (error) => {
      pushMessage({
        tone: 'error',
        title: 'Event was not deleted',
        body: authErrorMessage(error),
      });
    },
  });
}
