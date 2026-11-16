import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authErrorMessage } from '../../lib/auth-error';
import { pushMessage } from '../messages/message-store';
import { hackathonKeys } from '../hackathon/hackathon-api';
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
    onSuccess: async (result) => {
      const { event, failedSponsors } = result;
      const draft = event.status === 'DRAFT';
      const sponsors =
        failedSponsors.length === 1
          ? 'one sponsor could not be attached'
          : `${failedSponsors.length} sponsors could not be attached`;

      pushMessage({
        tone: 'success',
        title: draft ? 'Event saved as a draft' : 'Event created',
        body:
          failedSponsors.length === 0
            ? `${event.title} is on the calendar${draft ? ' as a draft' : ''}.`
            : `${event.title} is on the calendar, but ${sponsors}.`,
      });

      // The new row belongs to the console list; a published one also belongs
      // to the public calendar on the home page.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminEventKeys.all }),
        queryClient.invalidateQueries({ queryKey: hackathonKeys.all }),
      ]);
    },
    onError: (error) => {
      pushMessage({
        tone: 'error',
        title: 'Event was not created',
        body: authErrorMessage(error),
      });
    },
  });
}
