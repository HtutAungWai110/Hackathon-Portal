import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authErrorMessage } from '../../lib/auth-error';
import { pushMessage } from '../messages/message-store';
import {
  getRegistrationStatus,
  registerForEvent,
  registrationKeys,
} from './registration-api';
import type {
  RegistrationInput,
  RegistrationStatus,
} from './registration-api';

/**
 * The signed in participant's place at one event. Disabled until the session
 * and the event are both known, so a signed out visitor never sends a request
 * that can only be a 401.
 */
export function useRegistrationStatus(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: registrationKeys.status(eventId),
    queryFn: () => getRegistrationStatus(eventId),
    enabled: enabled && eventId.length > 0,
    // A 404 or 401 cannot become a success by asking again.
    retry: false,
  });
}

/**
 * Applying writes one row, so it reports through the global message queue. The
 * status query is updated before it is invalidated: the page switches to the
 * registered state on the same frame instead of flashing the form again while
 * the refetch runs.
 */
export function useRegisterForEvent(eventId: string, eventTitle: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegistrationInput) => registerForEvent(eventId, input),
    onSuccess: (application) => {
      queryClient.setQueryData<RegistrationStatus>(
        registrationKeys.status(eventId),
        (current) =>
          current === undefined
            ? current
            : {
                ...current,
                registered: true,
                registeredAt: application.applicationDate,
              },
      );
      pushMessage({
        tone: 'success',
        title: 'Application sent',
        body: `Your application for ${eventTitle} is with the organiser.`,
      });
      void queryClient.invalidateQueries({
        queryKey: registrationKeys.all,
      });
    },
    onError: (error) => {
      pushMessage({
        tone: 'error',
        title: 'Registration failed',
        body: authErrorMessage(error),
      });
    },
  });
}
