import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authErrorMessage } from '../../lib/auth-error';
import {
  adminEventKeys,
  attachEventSponsor,
  createAdminEvent,
} from './events-api';
import type {
  CreateEventResult,
  CreateEventWithSponsors,
  EventSponsor,
  FailedSponsor,
} from './events-api';

/**
 * Creating an event and attaching its sponsors is two API calls, so it is one
 * mutation that reports both halves. A sponsor failure never hides the fact
 * that the event itself was saved; retrying the whole form would create it
 * twice.
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CreateEventWithSponsors,
    ): Promise<CreateEventResult> => {
      const event = await createAdminEvent(input.event);
      const attachedSponsors: EventSponsor[] = [];
      const failedSponsors: FailedSponsor[] = [];

      for (const sponsor of input.sponsors) {
        try {
          const attached = await attachEventSponsor(event.id, {
            company: { name: sponsor.companyName },
            tier: sponsor.tier,
          });
          attachedSponsors.push(attached);
        } catch (error) {
          failedSponsors.push({
            companyName: sponsor.companyName,
            message: authErrorMessage(error),
          });
        }
      }

      return { event, attachedSponsors, failedSponsors };
    },
    onSuccess: async () => {
      // The new row belongs to the same list the page is already showing.
      await queryClient.invalidateQueries({ queryKey: adminEventKeys.all });
    },
  });
}
