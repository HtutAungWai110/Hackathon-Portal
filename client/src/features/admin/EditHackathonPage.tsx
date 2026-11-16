import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AppNav } from '../../components/AppNav';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { StatusScreen } from '../../components/StatusScreen';
import { ApiError } from '../../lib/api-client';
import { authErrorMessage } from '../../lib/auth-error';
import { formatEventRange } from '../../lib/event-display';
import { hackathonPath } from '../hackathon/paths';
import { EventForm } from './EventForm';
import { ADMIN_DASHBOARD_PATH } from './paths';
import { useAdminEvent } from './use-admin-event';
import { useDeleteEvent } from './use-delete-event';
import { useReturnAfterSave } from './use-return-after-save';
import './admin.css';

/**
 * Editing one event. The form is the create form in its edit mode: same fields,
 * same rules, but it saves this event and reconciles its sponsors.
 *
 * Deleting lives here too, behind a confirmation dialog, because it is the one
 * action on this screen that cannot be undone.
 */
export function EditHackathonPage() {
  const [search] = useSearchParams();
  const id = (search.get('id') ?? '').trim();
  const navigate = useNavigate();
  const event = useAdminEvent(id);
  const remove = useDeleteEvent();
  const returnAfterSave = useReturnAfterSave();
  const [confirming, setConfirming] = useState(false);

  if (id.length === 0) {
    return (
      <StatusScreen
        title="No event selected"
        description="Open an event from the season, then choose Edit."
        action={
          <Link className="button button--primary" to={ADMIN_DASHBOARD_PATH}>
            Back to the season
          </Link>
        }
      />
    );
  }

  const data = event.data;
  const missing = event.error instanceof ApiError && event.error.status === 404;

  async function handleDelete(eventId: string, eventTitle: string) {
    try {
      await remove.mutateAsync({ id: eventId, title: eventTitle });
      // The row is gone, so the ledger is the only sensible place to land.
      navigate(ADMIN_DASHBOARD_PATH, { replace: true });
    } catch {
      // The dialog renders the server's message.
    }
  }

  return (
    <div className="admin">
      <section className="admin-stage">
        <AppNav />
        <div className="admin-stage__inner">
          <div>
            <p className="admin-eyebrow admin-eyebrow--beam">Operations</p>
            <h1 className="admin-title">{data?.title ?? 'Edit the event.'}</h1>
            <p className="admin-lede">
              {data !== undefined
                ? formatEventRange(data.startsAt, data.endsAt)
                : 'Fetching the event from the calendar.'}
            </p>
          </div>
        </div>
      </section>

      <main className="admin-main">
        <div className="admin-create">
          <Link className="admin-create__back" to={ADMIN_DASHBOARD_PATH}>
            <span aria-hidden="true">←</span>
            Back to the season
          </Link>

          {event.isPending ? (
            <p className="admin-state" role="status">
              Loading the event…
            </p>
          ) : null}

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

          {data !== undefined ? (
            <>
              <section
                className="admin-compose admin-create__sheet"
                aria-labelledby="edit-event-title"
              >
                <p className="admin-eyebrow">Edit event</p>
                <h2 className="admin-section__title" id="edit-event-title">
                  Event details
                </h2>
                <EventForm
                  key={data.id}
                  event={data}
                  onSaved={returnAfterSave}
                  successAction={
                    <Link className="text-link" to={hackathonPath(data.id)}>
                      View the event page
                    </Link>
                  }
                />
              </section>

              <section
                className="danger-zone"
                aria-labelledby="delete-event-title"
              >
                <h2 className="danger-zone__title" id="delete-event-title">
                  Delete this event
                </h2>
                <p className="danger-zone__body">
                  The event and its sponsorships are removed. The companies stay
                  in the directory. This cannot be undone.
                </p>
                <button
                  className="button button--danger"
                  type="button"
                  onClick={() => {
                    remove.reset();
                    setConfirming(true);
                  }}
                >
                  Delete event
                </button>
              </section>
            </>
          ) : null}
        </div>
      </main>

      {data !== undefined ? (
        <ConfirmDialog
          open={confirming}
          title={`Delete ${data.title}?`}
          description="The event and every sponsorship on it are removed for good. Companies stay in the directory. Anyone with the public link will stop finding it."
          confirmLabel="Delete event"
          busyLabel="Deleting event…"
          busy={remove.isPending}
          error={remove.error !== null ? authErrorMessage(remove.error) : null}
          onCancel={() => {
            remove.reset();
            setConfirming(false);
          }}
          onConfirm={() => void handleDelete(data.id, data.title)}
        />
      ) : null}
    </div>
  );
}
