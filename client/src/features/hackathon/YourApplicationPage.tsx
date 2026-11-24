import { Link, useSearchParams } from 'react-router';
import { AppNav } from '../../components/AppNav';
import { StatusScreen } from '../../components/StatusScreen';
import { authErrorMessage } from '../../lib/auth-error';
import { formatMoment } from '../../lib/event-display';
import { useSession } from '../auth/session';
import { useMyApplication } from './use-registration';
import { useHackathon } from './use-hackathon';
import { hackathonPath } from './paths';
import './hackathon.css';

export function YourApplicationPage() {
  const [search] = useSearchParams();
  const id = (search.get('id') ?? '').trim();
  const session = useSession();
  const event = useHackathon(id, { admin: false, enabled: session.isFetched && id.length > 0 });
  const app = useMyApplication(id, session.isFetched && id.length > 0 && session.data !== null);

  if (id.length === 0) {
    return (
      <StatusScreen
        title="No event selected"
        description="This page needs an event id."
        action={
          <Link className="button button--primary" to="/">
            Go home
          </Link>
        }
      />
    );
  }

  if (!session.isFetched) {
    return (
      <StatusScreen
        title="Checking your session…"
        description="Just a moment."
      />
    );
  }

  if (session.data === null) {
    return (
      <StatusScreen
        title="Sign in required"
        description="You need to sign in to view your application."
        action={
          <Link className="button button--primary" to="/login">
            Sign in
          </Link>
        }
      />
    );
  }

  const statusLabel = (s?: string) => {
    if (s === 'ACCEPTED') return 'Accepted';
    if (s === 'REJECTED') return 'Not selected';
    if (s === 'INTERVIEW') return 'Interview';
    return 'In review';
  };
  const statusClass = (s?: string) => {
    if (s === 'ACCEPTED') return 'hackathon-status hackathon-status--accepted';
    if (s === 'REJECTED') return 'hackathon-status hackathon-status--rejected';
    if (s === 'INTERVIEW') return 'hackathon-status hackathon-status--interview';
    return 'hackathon-status hackathon-status--pending';
  };

  return (
    <div className="hackathon">
      <section className="hackathon-stage">
        <AppNav />
        <div className="hackathon-stage__inner">
          <p className="hackathon-eyebrow">Your application</p>
          <h1 className="hackathon-title">{event.data?.title ?? 'Application details'}</h1>
          <p className="hackathon-lede">Details of your application for this event.</p>
        </div>
      </section>
      <main className="hackathon-main">
        {app.isPending || event.isPending ? (
          <p className="hackathon-note" role="status">Loading…</p>
        ) : null}
        {app.error !== null ? (
          <div className="hackathon-error" role="alert">
            <h2 className="hackathon-error__title">Could not load your application</h2>
            <p className="hackathon-error__body">{authErrorMessage(app.error)}</p>
            <div className="hackathon-error__actions">
              <button className="button button--ghost" type="button" onClick={() => void app.refetch()}>
                Try again
              </button>
              <Link className="text-link" to={hackathonPath(id)}>Back to event</Link>
            </div>
          </div>
        ) : null}
        {app.data === null && !app.isPending && app.error === null ? (
          <div className="hackathon-note">
            <p>You have not applied to this event yet.</p>
            <Link className="text-link" to={hackathonPath(id)}>View event</Link>
          </div>
        ) : null}
        {app.data !== null && app.data !== undefined ? (
          <article className="hackathon-article">
            <div className="hackathon-body">
              <section className="hackathon-story">
                <h2 className="hackathon-section__title">Application</h2>
                <p><strong>Status:</strong> <span className={statusClass(app.data.status)}>{statusLabel(app.data.status)}</span></p>
                {app.data.reasonForRejection === null ? null : (
                  <p><strong>Reason:</strong> {app.data.reasonForRejection}</p>
                )}
                <p><strong>Applied on:</strong> {formatMoment(app.data.applicationDate) ?? 'Unknown'}</p>
                <p><strong>Your message:</strong></p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{app.data.additionalMessage}</p>
                {app.data.companyName ? <p><strong>Company:</strong> {app.data.companyName}</p> : null}
                {app.data.companyEmail ? <p><strong>Company email:</strong> {app.data.companyEmail}</p> : null}
                <div style={{ marginTop: '1rem' }}>
                  <Link className="button button--ghost" to={hackathonPath(id)}>Back to event</Link>
                </div>
              </section>
            </div>
          </article>
        ) : null}
      </main>
    </div>
  );
}
