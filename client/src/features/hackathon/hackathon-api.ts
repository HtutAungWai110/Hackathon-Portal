import { apiFetch } from '../../lib/api-client';

export type HackathonTier = 'MAIN' | 'CO_SPONSOR';

/** The public read answers for two of these; an admin preview may see any. */
export type HackathonStatus = 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';

/** The company fields the API includes with every sponsorship. */
export type HackathonSponsor = {
  id: string;
  tier: HackathonTier;
  contribution: string | null;
  company: {
    id: string;
    name: string;
    website: string | null;
    logoUrl: string | null;
    industry: string | null;
  };
};

/**
 * An event as `GET /events/:id` returns it. The public read only answers for
 * `PUBLISHED` and `COMPLETED`; a draft is a `404`, not a hidden row.
 */
export type PublicHackathon = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string | null;
  location: string | null;
  /** Public paths such as `/bucket/event_images/<file>`, in stored order. */
  imageUrls: string[];
  /** The one wide image behind the header, or null for a plain header. */
  backgroundUrl: string | null;
  status: HackathonStatus;
  sponsors: HackathonSponsor[];
};

export const hackathonKeys = {
  all: ['hackathon'] as const,
  list: ['hackathon', 'list'] as const,
  detail: (id: string, admin: boolean) =>
    ['hackathon', id, admin ? 'admin' : 'public'] as const,
};

/**
 * The public calendar: published and finished events, soonest first, with
 * sponsors. Drafts and cancellations never appear here.
 */
export function listHackathons(): Promise<PublicHackathon[]> {
  return apiFetch<PublicHackathon[]>('/events');
}

export function getHackathon(id: string): Promise<PublicHackathon> {
  return apiFetch<PublicHackathon>(`/events/${encodeURIComponent(id)}`);
}
