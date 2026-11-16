import { apiFetch } from '../../lib/api-client';

/**
 * What the event page needs to choose between Register, Registered, and
 * Closed. `open` is decided by the server's clock, so the button does not
 * depend on the visitor's device time.
 */
export type RegistrationStatus = {
  registered: boolean;
  registeredAt: string | null;
  open: boolean;
};

export type EventRegistration = {
  id: string;
  eventId: string;
  userId: string;
  createdAt: string;
};

export const registrationKeys = {
  all: ['event-registrations'] as const,
  status: (eventId: string) =>
    ['event-registrations', eventId, 'status'] as const,
};

export function getRegistrationStatus(
  eventId: string,
): Promise<RegistrationStatus> {
  return apiFetch<RegistrationStatus>(
    `/events/${encodeURIComponent(eventId)}/registration`,
  );
}

/** Takes a place at the event. A second call is a server-side 409. */
export function registerForEvent(eventId: string): Promise<EventRegistration> {
  return apiFetch<EventRegistration>(
    `/events/${encodeURIComponent(eventId)}/registrations`,
    { method: 'POST' },
  );
}
