import { apiFetch } from '../../lib/api-client';
import { API_URL } from '../../lib/api-config';

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
  status: EventStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  sponsors: EventSponsor[];
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
  status?: EventStatus;
};

/** A row from `/admin/companies`, the sponsor picker's source. */
export type Company = SponsorCompany & {
  createdAt: string;
  updatedAt: string;
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

export const adminEventKeys = {
  all: ['admin', 'events'] as const,
};

export const adminCompanyKeys = {
  all: ['admin', 'companies'] as const,
};

export function listAdminEvents(): Promise<AdminEvent[]> {
  return apiFetch<AdminEvent[]>('/admin/events');
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
 * An absolute URL for an image the API serves. Uploaded files are stored as
 * `/bucket/...`, which is the API's path, not the SPA's.
 */
export function eventImageSrc(url: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(url)) {
    return url;
  }
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
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
