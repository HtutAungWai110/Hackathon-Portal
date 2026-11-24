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

/** What the participant writes when they apply for a place. */
export type RegistrationInput = {
  additionalMessage: string;
  companyName?: string;
  companyEmail?: string;
};

export type ApplicationStatus = 'IN_PROGRESS' | 'INTERVIEW' | 'ACCEPTED' | 'REJECTED';

/** The application row the API returns after the caller applies. */
export type EventApplication = {
  id: string;
  eventId: string;
  applier: string;
  additionalMessage: string;
  companyName: string | null;
  companyEmail: string | null;
  status: ApplicationStatus;
  applicationDate: string;
};

/** The current user's application detail for an event (from the details endpoint). */
export type MyApplication = {
  id: string;
  additionalMessage: string;
  companyName: string | null;
  companyEmail: string | null;
  status: ApplicationStatus;
  /** The admin's note when the application was rejected, otherwise null. */
  reasonForRejection: string | null;
  applicationDate: string;
};

export const registrationKeys = {
  all: ['event-registrations'] as const,
  status: (eventId: string) =>
    ['event-registrations', eventId, 'status'] as const,
  details: (eventId: string) =>
    ['event-registrations', eventId, 'details'] as const,
};

export function getRegistrationStatus(
  eventId: string,
): Promise<RegistrationStatus> {
  return apiFetch<RegistrationStatus>(
    `/events/${encodeURIComponent(eventId)}/registration`,
  );
}

export function getMyApplication(
  eventId: string,
): Promise<MyApplication | null> {
  return apiFetch<MyApplication | null>(
    `/events/${encodeURIComponent(eventId)}/registration/details`,
  );
}

/** Applies for a place at the event. A second application is a 409. */
export function registerForEvent(
  eventId: string,
  input: RegistrationInput,
): Promise<EventApplication> {
  return apiFetch<EventApplication>(
    `/events/${encodeURIComponent(eventId)}/registrations`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
