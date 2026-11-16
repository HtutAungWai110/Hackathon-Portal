import { Link } from 'react-router';
import { AppNav } from '../../components/AppNav';
import { LightRays } from '../../components/LightRays';
import { EventLedger } from './EventLedger';
import { countLabel } from './event-format';
import type { AdminEvent } from './events-api';
import { CREATE_HACKATHON_PATH } from './paths';
import { useAdminEvents } from './use-admin-events';
import './admin.css';

function summarise(events: AdminEvent[]): string {
  const live = events.filter((event) => event.status === 'PUBLISHED').length;
  const drafts = events.filter((event) => event.status === 'DRAFT').length;
  return `${countLabel(events.length, 'event')} · ${live} live · ${drafts} in draft`;
}

/**
 * The operations desk: the season at a glance, and the one click that moves a
 * row onto the public calendar. Creating lives on its own screen, so the list
 * is never pushed below a form.
 */
export function AdminDashboardPage() {
  const eventsQuery = useAdminEvents();
  const events = eventsQuery.data ?? [];

  const summary = eventsQuery.isPending
    ? 'Reading the calendar…'
    : eventsQuery.error !== null && events.length === 0
      ? 'The calendar is out of reach.'
      : summarise(events);

  return (
    <div className="admin">
      <section className="admin-stage">
        <div className="admin-stage__rays">
          <LightRays
            raysOrigin="top-center"
            raysColor="#29f0ff"
            raysSpeed={0.5}
            lightSpread={0.55}
            rayLength={2.6}
            rayDensity={1}
            raySharpness={0.5}
            glow={0.4}
            haze={0.25}
            atmosphere={0.55}
            intensity={0.55}
            fadeDistance={1.1}
            saturation={1.05}
            followMouse
            mouseInfluence={0.06}
            cursorShadow
            clickPulse={false}
            noiseAmount={0.02}
            distortion={0.05}
            opacity={0.45}
            maxDevicePixelRatio={1.5}
          />
        </div>

        <AppNav />
        <div className="admin-stage__inner">
          <div>
            <p className="admin-eyebrow admin-eyebrow--beam">Operations</p>
            <h1 className="admin-title">The season.</h1>
            <p className="admin-lede">
              Every event on the calendar, drafts included. Publishing is what
              puts one on the public page.
            </p>
          </div>

          <div className="admin-stage__aside">
            <p className="admin-summary">{summary}</p>
            <Link className="button button--primary" to={CREATE_HACKATHON_PATH}>
              Open an event
            </Link>
          </div>
        </div>
      </section>

      <main className="admin-main">
        <div className="admin-ledger-wrap">
          <section className="admin-ledger" aria-labelledby="ledger-title">
            <div className="admin-ledger__head">
              <div>
                <p className="admin-eyebrow">On the calendar</p>
                <h2 className="admin-section__title" id="ledger-title">
                  Your events
                </h2>
              </div>
              {!eventsQuery.isPending && eventsQuery.error === null ? (
                <span className="admin-count">
                  {countLabel(events.length, 'event')}
                </span>
              ) : null}
            </div>

            <EventLedger
              events={eventsQuery.data}
              isPending={eventsQuery.isPending}
              error={eventsQuery.error}
              onRetry={() => {
                void eventsQuery.refetch();
              }}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
