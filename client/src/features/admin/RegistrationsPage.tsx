import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AppNav } from '../../components/AppNav';
import { StatusScreen } from '../../components/StatusScreen';
import { ApiError } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error';
import { formatEventRange } from '../../lib/event-display';
import { hackathonPath } from '../hackathon/paths';
import { countLabel } from './event-format';
import {
  ADMIN_DASHBOARD_PATH,
  editHackathonPath,
} from './paths';
import {
  REGISTRATION_PAGE_SIZES,
  type RegistrationPageSize,
  type RegistrationsQuery,
} from './events-api';
import { RegistrationCard } from './RegistrationCard';
import { useAdminEvent } from './use-admin-event';
import { useEventRegistrations } from './use-event-registrations';
import './admin.css';

/**
 * The console's full registrations screen for one event. The ledger drawer is
 * the quick look beside a row; this page is the address an admin can share or
 * return to, with the event's own facts around the list.
 *
 * It reads the same cached queries as the drawer, so opening the page after
 * expanding a row answers from the cache instead of asking twice. The list is
 * one page at a time, and `?registrationId=` hands the page an address for one
 * row.
 */
export function RegistrationsPage() {
  const [search, setSearch] = useSearchParams();
  const id = (search.get('id') ?? '').trim();
  const registrationId = (search.get('registrationId') ?? '').trim();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<RegistrationPageSize>(10);

  const event = useAdminEvent(id);
  const query: RegistrationsQuery = registrationId
    ? { registrationId }
    : { page, limit };
  const applications = useEventRegistrations(id, id.length > 0, query);
  const rows = applications.data?.items ?? [];
  const data = event.data;
  const missing = event.error instanceof ApiError && event.error.status === 404;

  if (id.length === 0) {
    return (
      <StatusScreen
        title="No event selected"
        description="Open an event from the season, then choose Show registrations."
        action={
          <Link className="button button--primary" to={ADMIN_DASHBOARD_PATH}>
            Back to the season
          </Link>
        }
      />
    );
  }

  const envelope = applications.data;
  const isDeepLink = registrationId.length > 0;
  const focusedRegistration =
    registrationId.length > 0
      ? (rows.find((row) => row.id === registrationId) ?? null)
      : null;
  const total = envelope?.total ?? 0;
  const totalPages = envelope?.totalPages ?? 1;
  const currentPage = envelope?.page ?? page;
  const activeLimit = envelope?.limit ?? limit;

  /**
   * Paging is a choice about the whole list, so it also drops the deep link.
   * The server already answered with the page holding that application, which
   * is the page to stay on when the highlight is cleared.
   */
  function showPage(nextPage: number) {
    setPage(nextPage);
    if (registrationId.length === 0) {
      return;
    }
    const next = new URLSearchParams(search);
    next.delete('registrationId');
    setSearch(next, { replace: true });
  }

  const lede =
    data === undefined
      ? 'Fetching the event from the calendar.'
      : formatEventRange(data.startsAt, data.endsAt);

  return (
    <div className="admin">
      <section className="admin-stage">
        <AppNav />
        <div className="admin-stage__inner">
          <div>
            <p className="admin-eyebrow admin-eyebrow--beam">Operations</p>
            <h1 className="admin-title">{data?.title ?? 'Registrations'}</h1>
            <p className="admin-lede">{lede}</p>
          </div>

          {data !== undefined ? (
            <div className="admin-stage__aside">
              <Link className="button button--quiet" to={hackathonPath(data.id)}>
                View event page
              </Link>
              <Link className="button button--primary" to={editHackathonPath(data.id)}>
                Manage event
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <main className="admin-main">
        <div className="admin-create registrations-page">
          <Link className="admin-create__back" to={ADMIN_DASHBOARD_PATH}>
            <span aria-hidden="true">←</span>
            Back to the season
          </Link>

          {event.error !== null ? (
            <div className="alert" role="alert">
              <p>
                {missing
                  ? 'That id does not match an event. It may have been deleted.'
                  : authErrorMessage(event.error)}
              </p>
              {!missing ? (
                <button
                  className="text-link"
                  type="button"
                  onClick={() => void event.refetch()}
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}

          {applications.error !== null ? (
            <div className="alert" role="alert">
              <p>
                {applications.error instanceof ApiError &&
                applications.error.status === 404
                  ? 'That application is not on this event.'
                  : authErrorMessage(applications.error)}
              </p>
              <button
                className="text-link"
                type="button"
                onClick={() => void applications.refetch()}
              >
                Try again
              </button>
            </div>
          ) : null}

          <section
            className="admin-compose admin-create__sheet"
            aria-labelledby="registrations-title"
          >
            <div className="admin-ledger__head">
              <div>
                <p className="admin-eyebrow">Applications</p>
                <h2 className="admin-section__title" id="registrations-title">
                  Registrations
                </h2>
              </div>
              {applications.isSuccess ? (
                <span className="admin-count">
                  {countLabel(total, 'application')}
                </span>
              ) : null}
            </div>

            {applications.isPending ? (
              <p className="admin-state" role="status">
                Reading applications…
              </p>
            ) : null}

            {applications.isSuccess &&
            isDeepLink &&
            focusedRegistration === null ? (
              <p className="admin-state">No application with that id.</p>
            ) : null}

            {!isDeepLink && applications.isSuccess && rows.length === 0 ? (
              <p className="admin-state">No one has applied yet.</p>
            ) : null}

            {rows.length > 0 ? (
              <ul className="registration-list">
                {rows.map((registration) => (
                  <RegistrationCard
                    key={registration.id}
                    registration={registration}
                    focused={registration.id === registrationId}
                  />
                ))}
              </ul>
            ) : null}

            {isDeepLink && focusedRegistration !== null ? (
              <p className="admin-state">
                Showing the page that holds that application.{' '}
                <button
                  className="text-link"
                  type="button"
                  onClick={() => showPage(currentPage)}
                >
                  Clear highlight
                </button>
              </p>
            ) : null}

            {applications.isSuccess && total > 0 ? (
              <div className="admin-registrations__controls">
                <div className="field">
                  <label className="field__label" htmlFor="registrations-limit">
                    Applications per page
                  </label>
                  <select
                    id="registrations-limit"
                    className="field__input"
                    value={activeLimit}
                    onChange={(event) => {
                      setLimit(
                        Number(event.target.value) as RegistrationPageSize,
                      );
                      showPage(1);
                    }}
                  >
                    {REGISTRATION_PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-registrations__pager">
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => showPage(Math.max(1, currentPage - 1))}
                  >
                    Previous
                  </button>
                  <span className="admin-registrations__page">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="button button--quiet"
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      showPage(Math.min(totalPages, currentPage + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
