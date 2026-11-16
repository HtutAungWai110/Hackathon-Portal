import { apiFetch } from '../../lib/api-client';

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';
export type SponsorTier = 'MAIN' | 'CO_SPONSOR';

/**
 * Mirrors the server's upload contract so the form can turn away an obviously
 * wrong file before spending a request on it. The server re-checks all of it.
 */
export const MAX_EVENT_IMAGES = 8;
export const MAX_EVENT_IMAGE_BYTES = 5 * 1024 * 1024;
export const EVENT_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;
/** The `accept` attribute for the file input. */
export const EVENT_IMAGE_ACCEPT = EVENT_IMAGE_TYPES.join(',');

/** The company fields the API includes with every sponsorship. */
export type SponsorCompany = {
  id: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  industry: string | null;
};

export type EventSponsor = {
  id: string;
  tier: SponsorTier;
  contribution: string | null;
  company: SponsorCompany;
};

/**
 * An event as `/admin/events` returns it. Drafts are included, which is the
 * whole point of the admin read: the public calendar filters them out.
 */
export type AdminEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string | null;
  location: string | null;
  /** Public paths such as `/bucket/event_images/<file>`, in stored order. */
  imageUrls: string[];
  /** The one wide image behind the event header, or null for a plain header. */
  backgroundUrl: string | null;
  status: EventStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  sponsors: EventSponsor[];
  /** How many people hold a place, so a collapsed row can say so. */
  registrationCount: number;
};

/** The subset of the server's `CreateEventDto` the form fills in. */
export type CreateEventPayload = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline?: string;
  location?: string;
  /** URLs returned by `uploadEventImages`, in the order they were attached. */
  imageUrls?: string[];
  /** The URL returned by `uploadEventBackground`. */
  backgroundUrl?: string;
  status?: EventStatus;
};

/** A row from `/admin/companies`, the sponsor picker's source. */
export type Company = SponsorCompany & {
  createdAt: string;
  updatedAt: string;
};

/**
 * The whole event, as the edit form holds it. The form saves with PUT, so every
 * column the editor owns is present and an empty optional one is `null`, not
 * omitted. Sponsors travel through their own routes.
 */
export type ReplaceEventPayload = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string | null;
  location: string | null;
  imageUrls: string[];
  backgroundUrl: string | null;
  status: EventStatus;
};

export type SponsorSelection = {
  companyName: string;
  tier: SponsorTier;
};

export type CreateEventWithSponsors = {
  event: CreateEventPayload;
  sponsors: SponsorSelection[];
};

/**
 * The event is saved even when a sponsor fails to attach. The mutation says
 * which ones failed so the form can report the half that succeeded.
 */
export type FailedSponsor = {
  companyName: string;
  message: string;
};

export type CreateEventResult = {
  event: AdminEvent;
  attachedSponsors: EventSponsor[];
  failedSponsors: FailedSponsor[];
};

/** One participant holding a place, as the console lists them. */
export type AdminRegistration = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

export const adminEventKeys = {
  all: ['admin', 'events'] as const,
  detail: (id: string) => ['admin', 'events', id] as const,
  registrations: (id: string) =>
    ['admin', 'events', id, 'registrations'] as const,
};

export const adminCompanyKeys = {
  all: ['admin', 'companies'] as const,
};

export function listAdminEvents(): Promise<AdminEvent[]> {
  return apiFetch<AdminEvent[]>('/admin/events');
}

/**
 * One event whatever its status. The public page uses this for a signed in
 * admin so a draft can be previewed before it is published.
 */
export function getAdminEvent(id: string): Promise<AdminEvent> {
  return apiFetch<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`);
}

export function listAdminCompanies(): Promise<Company[]> {
  return apiFetch<Company[]>('/admin/companies');
}

/**
 * Uploads the picked files and answers the URLs to store on the event. It is a
 * separate request from the create call, so the event body stays plain JSON.
 * `apiFetch` leaves `FormData` alone: the browser sets the multipart boundary.
 */
export function uploadEventImages(
  files: readonly File[],
): Promise<{ urls: string[] }> {
  const body = new FormData();
  for (const file of files) {
    body.append('images', file);
  }
  return apiFetch<{ urls: string[] }>('/admin/uploads/event-images', {
    method: 'POST',
    body,
  });
}

/**
 * Uploads the event header's one image into the same bucket. A separate route
 * from the gallery because a background is replaced rather than accumulated.
 */
export function uploadEventBackground(file: File): Promise<{ url: string }> {
  const body = new FormData();
  body.append('image', file);
  return apiFetch<{ url: string }>('/admin/uploads/event-background', {
    method: 'POST',
    body,
  });
}

export function createAdminEvent(
  input: CreateEventPayload,
): Promise<AdminEvent> {
  return apiFetch<AdminEvent>('/admin/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function attachEventSponsor(
  eventId: string,
  input: { company: { name: string }; tier: SponsorTier },
): Promise<EventSponsor> {
  return apiFetch<EventSponsor>(
    `/admin/events/${encodeURIComponent(eventId)}/sponsors`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function publishAdminEvent(id: string): Promise<AdminEvent> {
  return apiFetch<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'PUBLISHED' }),
  });
}

/** The form's save: the body states the whole event, so the route is PUT. */
export function replaceAdminEvent(
  id: string,
  input: ReplaceEventPayload,
): Promise<AdminEvent> {
  return apiFetch<AdminEvent>(`/admin/events/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function updateEventSponsorTier(
  eventId: string,
  sponsorId: string,
  tier: SponsorTier,
): Promise<EventSponsor> {
  return apiFetch<EventSponsor>(
    `/admin/events/${encodeURIComponent(eventId)}/sponsors/${encodeURIComponent(sponsorId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ tier }),
    },
  );
}

export function removeEventSponsor(
  eventId: string,
  sponsorId: string,
): Promise<void> {
  return apiFetch<void>(
    `/admin/events/${encodeURIComponent(eventId)}/sponsors/${encodeURIComponent(sponsorId)}`,
    { method: 'DELETE' },
  );
}

export function deleteAdminEvent(id: string): Promise<void> {
  return apiFetch<void>(`/admin/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

/**
 * The people who hold a place at one event. It is its own request because the
 * console fetches it only when a row expands, not with every event.
 */
export function listEventRegistrations(
  eventId: string,
): Promise<AdminRegistration[]> {
  return apiFetch<AdminRegistration[]>(
    `/admin/events/${encodeURIComponent(eventId)}/registrations`,
  );
}
