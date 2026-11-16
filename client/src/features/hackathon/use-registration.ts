import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authErrorMessage } from '../../lib/auth-error';
import { pushMessage } from '../messages/message-store';
import {
  getRegistrationStatus,
  registerForEvent,
  registrationKeys,
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
 * Registering writes one row, so it reports through the global message queue
 * and then refreshes the status query the button is rendered from.
 */
export function useRegisterForEvent(eventId: string, eventTitle: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => registerForEvent(eventId),
    onSuccess: async () => {
      pushMessage({
        tone: 'success',
        title: 'You are registered',
        body: `Your place at ${eventTitle} is held.`,
      });
      await queryClient.invalidateQueries({
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
