import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  type AdminRegistration,
  type RegistrationPageSize,
  type RegistrationsQuery,
  decideRegistration,
} from './events-api';
import { ConfirmActionDialog } from './ConfirmActionDialog';
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
  /** The decision waiting on the confirmation box; nothing is sent until then. */
  const [pendingAction, setPendingAction] = useState<{
    kind: 'accept' | 'reject';
    registration: AdminRegistration;
  } | null>(null);
  /** Optional note the admin leaves with a rejection; sent with the delete. */
  const [rejectionReason, setRejectionReason] = useState('');

  const event = useAdminEvent(id);
  const queryClient = useQueryClient();
  const query: RegistrationsQuery = registrationId
    ? { registrationId }
    : { page, limit };
  const applications = useEventRegistrations(id, id.length > 0, query);
  const rows = applications.data?.items ?? [];
  const data = event.data;
  const missing = event.error instanceof ApiError && event.error.status === 404;

  const decisionMutation = useMutation({
    mutationFn: (input: {
      registrationId: string;
      action: 'accept' | 'reject';
      reason?: string;
    }) =>
      decideRegistration(id, input.registrationId, {
        action: input.action,
        reason: input.reason,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'events', id, 'registrations'],
      });
      setPendingAction(null);
      setRejectionReason('');
    },
  });

  const actionPending = decisionMutation.isPending;
  const actionError = decisionMutation.error;

  /** Opening the box is the whole of the button's effect; the API waits. */
  function askToDecide(
    kind: 'accept' | 'reject',
    registration: AdminRegistration,
  ) {
    decisionMutation.reset();
    setRejectionReason('');
    setPendingAction({ kind, registration });
  }

  function closeDialog() {
    if (actionPending) {
      return;
    }
    decisionMutation.reset();
    setRejectionReason('');
    setPendingAction(null);
  }

  function confirmDecision() {
    if (pendingAction === null) {
      return;
    }
    decisionMutation.mutate({
      registrationId: pendingAction.registration.id,
      action: pendingAction.kind,
      reason: pendingAction.kind === 'reject' ? rejectionReason : undefined,
    });
  }

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
                    onAccept={() => askToDecide('accept', registration)}
                    onReject={() => askToDecide('reject', registration)}
                    actionPending={actionPending}
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

      {pendingAction === null ? null : (
        <ConfirmActionDialog
          tone={pendingAction.kind === 'accept' ? 'primary' : 'danger'}
          title={
            pendingAction.kind === 'accept'
              ? 'Accept this application?'
              : 'Reject this application?'
          }
          description={
            pendingAction.kind === 'accept' ? (
              <p>
                <strong>{pendingAction.registration.user.name}</strong>&apos;s
                application will be marked as accepted. They will be notified
                and can see the decision on their application page.
              </p>
            ) : (
              <p>
                <strong>{pendingAction.registration.user.name}</strong>&apos;s
                application will be permanently deleted and they will be
                notified with a copy of what they submitted. This cannot be
                undone.
              </p>
            )
          }
          reasonField={
            pendingAction.kind === 'reject'
              ? {
                  label: 'Reason for rejection (optional)',
                  hint: 'Shared with the applicant in their notification and on their application page.',
                  placeholder:
                    'e.g. The team already has three frontend developers.',
                  value: rejectionReason,
                  maxLength: 500,
                  onChange: setRejectionReason,
                }
              : undefined
          }
          confirmLabel={
            pendingAction.kind === 'accept'
              ? 'Accept application'
              : 'Reject application'
          }
          pendingLabel={
            pendingAction.kind === 'accept' ? 'Accepting…' : 'Rejecting…'
          }
          pending={actionPending}
          error={actionError === null ? null : authErrorMessage(actionError)}
          onConfirm={confirmDecision}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
