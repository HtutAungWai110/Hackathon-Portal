import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppNav } from '../../components/AppNav';
import { StatusScreen } from '../../components/StatusScreen';
import { ApiError } from '../../lib/api-client';
import { apiAssetUrl } from '../../lib/api-config';
import { authErrorMessage } from '../../lib/auth-error';
import { formatDeadline, formatEventRange } from '../../lib/event-display';
import { editHackathonPath, registrationsPath } from '../admin/paths';
import { useSession } from '../auth/session';
import { DescriptionText } from './DescriptionText';
import { EventRegistrationAction } from './EventRegistrationAction';
import { HackathonLightbox } from './HackathonLightbox';
import type { PublicHackathon } from './hackathon-api';
import { useHackathon } from './use-hackathon';
import './hackathon.css';
/** Extra copy for the statuses a visitor would not normally reach. */
const STATUS_NOTES: Record<PublicHackathon['status'], string | null> = {
  PUBLISHED: null,
  DRAFT: 'Draft preview',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function heroLine(event: PublicHackathon): string {
  const when = formatEventRange(event.startsAt, event.endsAt);
  const line = `${when} · ${event.location ?? 'Online'}`;
  const note = STATUS_NOTES[event.status];
  return note === null ? line : `${line} · ${note}`;
}

/**
 * The public event page. It reads one event by the `id` query parameter, which
 * is how a shared link names the event without needing a path segment per row.
 *
 * A visitor reads the public endpoint, which serves published and finished
 * events only, so a draft answers 404. A signed in admin reads the console
 * endpoint instead and can preview a draft or a cancelled event. The session
 * decides the route once it is known, so a draft link opens correctly from the
 * admin ledger without a wasted public request.
 */
export function HackathonDetailPage() {
  const [search] = useSearchParams();
  const id = (search.get('id') ?? '').trim();
  const session = useSession();
  const isAdmin = session.data?.user.role === 'admin';
  const event = useHackathon(id, { admin: isAdmin, enabled: session.isFetched });
  const [viewer, setViewer] = useState<number | null>(null);
  const viewerTrigger = useRef<HTMLButtonElement | null>(null);
  const data = event.data;
  const isParticipant = session.data?.user.role === 'participant';
  // A signed out visitor is offered a way in; the register control itself only
  // exists for an account that can actually hold a place.
  const promptedToSignIn =
    session.isFetched &&
    session.data === null &&
    data?.status === 'PUBLISHED';

  function closeViewer() {
    setViewer(null);
    // The thumbnail is still mounted behind the dialog, so focus can go back
    // to the image the visitor opened rather than to the top of the page.
    viewerTrigger.current?.focus();
  }

  if (id.length === 0) {
    return (
      <StatusScreen
        title="No event selected"
        description="This page needs an event id. Open an event from the calendar instead."
        action={
          <Link className="button button--primary" to="/">
            Go to the workspace
          </Link>
        }
      />
    );
  }

  const missing = event.error instanceof ApiError && event.error.status === 404;
  // A different event may have fewer images; never index past the end.
  const viewerIndex =
    viewer !== null && data !== undefined && viewer < data.imageUrls.length
      ? viewer
      : null;
  const mainSponsors =
    data?.sponsors.filter((sponsor) => sponsor.tier === 'MAIN') ?? [];
  const coSponsors =
    data?.sponsors.filter((sponsor) => sponsor.tier === 'CO_SPONSOR') ?? [];

  return (
    <div className="hackathon">
      <section
        className={
          data?.backgroundUrl
            ? 'hackathon-stage hackathon-stage--with-image'
            : 'hackathon-stage'
        }
      >
        {data?.backgroundUrl ? (
          <div className="hackathon-stage__backdrop" aria-hidden="true">
            <img
              src={apiAssetUrl(data.backgroundUrl)}
              alt=""
              decoding="async"
              fetchPriority="high"
            />
          </div>
        ) : null}
        <AppNav />
        <div className="hackathon-stage__inner">
          <p className="hackathon-eyebrow">Hackathon</p>
          <h1 className="hackathon-title">{data?.title ?? 'Event details'}</h1>
          {data !== undefined ? (
            <p className="hackathon-lede">{heroLine(data)}</p>
          ) : null}
          {isAdmin && data !== undefined ? (
            <div className="hackathon-stage__actions">
              <Link
                className="button button--primary"
                to={editHackathonPath(data.id)}
              >
                Manage event
              </Link>
              <Link
                className="button button--ghost"
                to={registrationsPath(data.id)}
              >
                Show registrations
              </Link>
            </div>
          ) : null}
          {data !== undefined &&
          !isAdmin &&
          ((isParticipant && data.status === 'PUBLISHED') ||
            promptedToSignIn) ? (
            <div className="hackathon-stage__actions">
              {isParticipant && data.status === 'PUBLISHED' ? (
                <EventRegistrationAction
                  eventId={data.id}
                  eventTitle={data.title}
                />
              ) : (
                <Link className="button button--primary" to="/login">
                  Sign in to register
                </Link>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <main className="hackathon-main">
        {event.isPending ? (
          <p className="hackathon-note" role="status">
            Loading the event…
          </p>
        ) : null}

        {event.error !== null ? (
          <div className="hackathon-error" role="alert">
            <h2 className="hackathon-error__title">
              {missing
                ? 'This event is not public.'
                : 'The event could not be loaded.'}
            </h2>
            <p className="hackathon-error__body">
              {missing
                ? isAdmin
                  ? 'That id does not match an event. Check the link in the admin console.'
                  : 'The link may be out of date, or this event has not been published yet.'
                : authErrorMessage(event.error)}
            </p>
            <div className="hackathon-error__actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={() => void event.refetch()}
              >
                Try again
              </button>
              <Link className="text-link" to="/">
                Back to the workspace
              </Link>
            </div>
          </div>
        ) : null}

        {data !== undefined ? (
          <article className="hackathon-article">
            {data.imageUrls.length > 0 ? (
              <ul className="hackathon-gallery">
                {data.imageUrls.map((url, index) => (
                  <li className="hackathon-gallery__frame" key={url}>
                    <button
                      className="hackathon-gallery__open"
                      type="button"
                      onClick={(clickEvent) => {
                        viewerTrigger.current = clickEvent.currentTarget;
                        setViewer(index);
                      }}
                      aria-label={`View image ${index + 1} of ${data.imageUrls.length} in full view`}
                    >
                      <img
                        src={apiAssetUrl(url)}
                        alt={`${data.title}, image ${index + 1}`}
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="hackathon-body">
              <section
                className="hackathon-story"
                aria-labelledby="hackathon-about"
              >
                <h2
                  className="hackathon-section__title"
                  id="hackathon-about"
                >
                  About this event
                </h2>
                <DescriptionText
                  className="hackathon-description"
                  text={data.description}
                />
              </section>

              <aside className="hackathon-aside" aria-label="Event details">
                <dl className="hackathon-facts">
                  <div className="hackathon-fact">
                    <dt>When</dt>
                    <dd>{formatEventRange(data.startsAt, data.endsAt)}</dd>
                  </div>
                  <div className="hackathon-fact">
                    <dt>Where</dt>
                    <dd>{data.location ?? 'Online'}</dd>
                  </div>
                  <div className="hackathon-fact">
                    <dt>Registration</dt>
                    <dd>
                      {formatDeadline(data.registrationDeadline) ??
                        'Open until the event starts'}
                    </dd>
                  </div>
                </dl>

                {data.sponsors.length > 0 ? (
                  <section
                    className="hackathon-sponsors"
                    aria-labelledby="hackathon-sponsors-title"
                  >
                    <h2
                      className="hackathon-section__title"
                      id="hackathon-sponsors-title"
                    >
                      Backed by
                    </h2>
                    <ul className="hackathon-sponsor-list">
                      {mainSponsors.map((sponsor) => (
                        <li
                          className="hackathon-sponsor hackathon-sponsor--main"
                          key={sponsor.id}
                        >
                          <span className="hackathon-sponsor__name">
                            {sponsor.company.name}
                          </span>
                          <span className="hackathon-sponsor__tier">
                            Main sponsor
                          </span>
                        </li>
                      ))}
                      {coSponsors.map((sponsor) => (
                        <li className="hackathon-sponsor" key={sponsor.id}>
                          <span className="hackathon-sponsor__name">
                            {sponsor.company.name}
                          </span>
                          <span className="hackathon-sponsor__tier">
                            Co-sponsor
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </aside>
            </div>
          </article>
        ) : null}
      </main>

      {viewerIndex !== null && data !== undefined ? (
        <HackathonLightbox
          images={data.imageUrls}
          index={viewerIndex}
          title={data.title}
          onClose={closeViewer}
          onNavigate={setViewer}
        />
      ) : null}
    </div>
  );
}
