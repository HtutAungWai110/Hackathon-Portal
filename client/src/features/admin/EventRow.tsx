import { Link } from 'react-router';
import type { AdminEvent } from './events-api';
import { apiAssetUrl } from '../../lib/api-config';
import { descriptionPreview } from '../../lib/description';
import { formatDeadline, formatEventRange } from '../../lib/event-display';
import { hackathonPath } from '../hackathon/paths';
import { STATUS_LABELS, dateTab } from './event-format';
import { EventRegistrations } from './EventRegistrations';

type EventRowProps = {
  event: AdminEvent;
  publishing: boolean;
  publishError: string | null;
  onPublish: (id: string) => void;
};

const MAX_VISIBLE_SPONSORS = 3;
const MAX_VISIBLE_IMAGES = 3;

/**
 * One call sheet row: the date tab on the rail, the event, and its status.
 * Sponsors are the only detail that can grow without bound, so they are
 * capped and the rest become a count.
 */
export function EventRow({
  event,
  publishing,
  publishError,
  onPublish,
}: EventRowProps) {
  const tab = dateTab(event.startsAt);
  const deadline = formatDeadline(event.registrationDeadline);
  const visibleSponsors = event.sponsors.slice(0, MAX_VISIBLE_SPONSORS);
  const hiddenSponsors = event.sponsors.length - visibleSponsors.length;
  const visibleImages = event.imageUrls.slice(0, MAX_VISIBLE_IMAGES);
  const hiddenImages = event.imageUrls.length - visibleImages.length;

  return (
    <li className="ledger-row" data-status={event.status}>
      <time className="ledger-row__date" dateTime={event.startsAt} aria-hidden="true">
        <span className="ledger-row__month">{tab.month}</span>
        <span className="ledger-row__day">{tab.day}</span>
        <span className="ledger-row__year">{tab.year}</span>
      </time>

      <div className="ledger-row__body">
        <h3 className="ledger-row__title">
          <Link
            className="ledger-row__title-link"
            to={hackathonPath(event.id)}
          >
            {event.title}
          </Link>
        </h3>

        <p className="ledger-row__meta">
          <time dateTime={event.startsAt}>
            {formatEventRange(event.startsAt, event.endsAt)}
          </time>
          <span aria-hidden="true"> · </span>
          {event.location ?? 'Online'}
          {deadline !== null ? (
            <>
              <span aria-hidden="true"> · </span>
              {deadline}
            </>
          ) : null}
        </p>

        <p className="ledger-row__description">
          {descriptionPreview(event.description)}
        </p>

        {event.imageUrls.length > 0 ? (
          <ul className="ledger-row__images">
            {visibleImages.map((url, index) => (
              <li className="ledger-row__image" key={url}>
                <img
                  src={apiAssetUrl(url)}
                  alt={`${event.title}, image ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                />
              </li>
            ))}
            {hiddenImages > 0 ? (
              <li className="ledger-row__image ledger-row__image--more">
                <span aria-hidden="true">+{hiddenImages}</span>
                <span className="visually-hidden">
                  {hiddenImages} more images
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}

        {event.sponsors.length > 0 ? (
          <div className="ledger-row__sponsors">
            <span className="ledger-row__sponsor-label">Sponsors</span>
            {visibleSponsors.map((sponsor) => (
              <span
                className={
                  sponsor.tier === 'MAIN'
                    ? 'sponsor-chip sponsor-chip--main'
                    : 'sponsor-chip'
                }
                key={sponsor.id}
              >
                {sponsor.tier === 'MAIN' ? (
                  <span className="sponsor-chip__tier">Main</span>
                ) : null}
                {sponsor.company.name}
              </span>
            ))}
            {hiddenSponsors > 0 ? (
              <span className="sponsor-chip sponsor-chip--more">
                +{hiddenSponsors}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="ledger-row__no-sponsors">No sponsors yet</p>
        )}

        <EventRegistrations
          eventId={event.id}
          eventTitle={event.title}
          count={event.registrationCount}
        />

        {publishError !== null ? (
          <p className="ledger-row__error" role="alert">
            {publishError}
          </p>
        ) : null}
      </div>

      <div className="ledger-row__side">
        <span className="status-stamp" data-status={event.status}>
          {STATUS_LABELS[event.status]}
        </span>
        {event.status === 'DRAFT' ? (
          <button
            className="button button--quiet ledger-row__publish"
            type="button"
            disabled={publishing}
            onClick={() => onPublish(event.id)}
          >
            {publishing ? 'Publishing' : 'Publish'}
          </button>
        ) : null}
      </div>
    </li>
  );
}
