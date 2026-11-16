import { Link } from 'react-router';
import { AppNav } from '../../components/AppNav';
import { EventForm } from './EventForm';
import { ADMIN_DASHBOARD_PATH } from './paths';
import { useReturnAfterSave } from './use-return-after-save';
import './admin.css';

/**
 * Opening an event is its own screen rather than a sheet beside the ledger:
 * the form is the whole job here, and the season is one quiet link away.
 * A clean save returns to the screen this one was opened from.
 */
export function CreateHackathonPage() {
  const returnAfterSave = useReturnAfterSave();

  return (
    <div className="admin">
      <section className="admin-stage">
        <AppNav />
        <div className="admin-stage__inner">
          <div>
            <p className="admin-eyebrow admin-eyebrow--beam">Operations</p>
            <h1 className="admin-title">Open an event.</h1>
            <p className="admin-lede">
              Name it, schedule it, and say who backs it. Every finer edit can
              wait until it is saved.
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

          <section
            className="admin-compose admin-create__sheet"
            aria-labelledby="new-event-title"
          >
            <p className="admin-eyebrow">New event</p>
            <h2 className="admin-section__title" id="new-event-title">
              Event details
            </h2>
            <EventForm
              onSaved={returnAfterSave}
              successAction={
                <Link className="text-link" to={ADMIN_DASHBOARD_PATH}>
                  View the season
                </Link>
              }
            />
          </section>
        </div>
      </main>
    </div>
  );
}
