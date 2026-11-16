import { Link } from 'react-router';
import { apiAssetUrl } from '../../lib/api-config';
import { descriptionPreview } from '../../lib/description';
import { formatEventRange } from '../../lib/event-display';
import type { PublicHackathon } from './hackathon-api';
import { hackathonPath } from './paths';

type EventPhase = 'upcoming' | 'past';

const PHASE_LABELS: Record<EventPhase, string> = {
  upcoming: 'Upcoming',
  past: 'Completed',
};

const MAX_VISIBLE_SPONSORS = 3;

type HackathonCardProps = {
  event: PublicHackathon;
};

/**
 * The phase comes from the status the organiser set, not from the clock. That
 * keeps rendering pure, and it means an event is listed as finished when its
 * organiser says it is, not when a device's clock happens to pass a date.
 *
 * The whole card is one link, so there is no second target inside it.
 */
export function HackathonCard({ event }: HackathonCardProps) {
  const phase: EventPhase =
    event.status === 'COMPLETED' ? 'past' : 'upcoming';
  const cover = event.backgroundUrl ?? event.imageUrls[0] ?? null;
  const preview = descriptionPreview(event.description);
  const sponsors = event.sponsors.slice(0, MAX_VISIBLE_SPONSORS);
  const hiddenSponsors = event.sponsors.length - sponsors.length;

  return (
    <li className="event-card" data-phase={phase}>
      <Link className="event-card__link" to={hackathonPath(event.id)}>
        <span className="event-card__media">
          {cover !== null ? (
            <img
              src={apiAssetUrl(cover)}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="event-card__monogram" aria-hidden="true">
              {event.title.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="event-card__phase">{PHASE_LABELS[phase]}</span>
        </span>

        <span className="event-card__body">
          <span className="event-card__when">
            {formatEventRange(event.startsAt, event.endsAt)}
          </span>
          <h3 className="event-card__title">{event.title}</h3>
          <span className="event-card__place">
            {event.location ?? 'Online'}
          </span>

          {preview.length > 0 ? (
            <span className="event-card__description">{preview}</span>
          ) : null}

          {sponsors.length > 0 ? (
            <span className="event-card__sponsors">
              {sponsors.map((sponsor) => (
                <span className="event-card__sponsor" key={sponsor.id}>
                  {sponsor.tier === 'MAIN' ? (
                    <span className="event-card__sponsor-tier">Main</span>
                  ) : null}
                  {sponsor.company.name}
                </span>
              ))}
              {hiddenSponsors > 0 ? (
                <span className="event-card__sponsor event-card__sponsor--more">
                  +{hiddenSponsors}
                </span>
              ) : null}
            </span>
          ) : null}

          <span className="event-card__cta">
            View event <span aria-hidden="true">→</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
