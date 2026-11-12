import { Link } from 'react-router';
import { authErrorMessage } from '../../lib/auth-error';
import { EventRow } from './EventRow';
import type { AdminEvent } from './events-api';
import { CREATE_HACKATHON_PATH } from './paths';
import { usePublishEvent } from './use-publish-event';

type EventLedgerProps = {
  events: AdminEvent[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
};

const SKELETON_ROWS = ['one', 'two', 'three'];

/**
 * The list owns publishing, because that is the only write aimed at a single
 * row; creating is a link to its own screen. Loading, empty, and failure each
 * get their own state instead of an empty list standing in for all three.
 */
export function EventLedger({
  events,
  isPending,
  error,
  onRetry,
}: EventLedgerProps) {
  const publish = usePublishEvent();
  const entries = events ?? [];
  const publishingId = publish.isPending ? (publish.variables ?? null) : null;

  if (isPending) {
    return (
      <div aria-busy="true">
        <span className="visually-hidden" role="status">
          Reading the calendar.
        </span>
        <ul className="ledger ledger--loading" aria-hidden="true">
          {SKELETON_ROWS.map((row) => (
            <li className="ledger-row ledger-row--skeleton" key={row}>
              <span className="ledger-row__date">
                <span className="skeleton-bar skeleton-bar--month" />
                <span className="skeleton-bar skeleton-bar--day" />
              </span>
              <span className="ledger-row__body">
                <span className="skeleton-bar skeleton-bar--title" />
                <span className="skeleton-bar skeleton-bar--meta" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (error !== null && entries.length === 0) {
    return (
      <div className="ledger-empty">
        <p className="admin-eyebrow">Read failed</p>
        <h3 className="ledger-empty__title">The calendar could not be read.</h3>
        <p className="ledger-empty__body" role="alert">
          {authErrorMessage(error)}
        </p>
        <button className="button button--ghost" type="button" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="ledger-empty">
        <p className="admin-eyebrow">Nothing yet</p>
        <h3 className="ledger-empty__title">Open the first event.</h3>
        <p className="ledger-empty__body">
          Drafts live here until you publish them. The public calendar only
          shows what you make live.
        </p>
        <Link className="button button--ghost" to={CREATE_HACKATHON_PATH}>
          Open an event
        </Link>
      </div>
    );
  }

  return (
    <>
      {error !== null ? (
        <div className="ledger__stale">
          <p className="alert" role="alert">
            {authErrorMessage(error)}
          </p>
          <button className="button button--quiet" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}

      <ul className="ledger">
        {entries.map((event) => (
          <EventRow
            event={event}
            key={event.id}
            onPublish={(id) => publish.mutate(id)}
            publishing={publishingId === event.id}
            publishError={
              publish.error !== null && publish.variables === event.id
                ? authErrorMessage(publish.error)
                : null
            }
          />
        ))}
      </ul>

      {publish.isSuccess ? (
        <p className="visually-hidden" role="status">
          Event published.
        </p>
      ) : null}
    </>
  );
}
