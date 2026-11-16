import { authErrorMessage } from '../../lib/auth-error';
import { HackathonCard } from './HackathonCard';
import type { PublicHackathon } from './hackathon-api';
import { useHackathons } from './use-hackathons';
import './hackathon.css';

function startTime(event: PublicHackathon): number {
  return new Date(event.startsAt).getTime();
}

/**
 * The public calendar on the home page. The API returns soonest first, which is
 * already the right order for events still to come; completed ones are moved
 * behind them, newest first, so the page opens on what is still ahead.
 */
export function HackathonCalendar() {
  const events = useHackathons();
  const all = events.data ?? [];
  const ahead = all.filter((event) => event.status !== 'COMPLETED');
  const past = all
    .filter((event) => event.status === 'COMPLETED')
    .sort((a, b) => startTime(b) - startTime(a));
  const ordered = [...ahead, ...past];

  return (
    <section className="home-calendar" aria-labelledby="home-calendar-title">
      <header className="home-calendar__head">
        <p className="home-eyebrow">Calendar</p>
        <h2 className="home-section__title" id="home-calendar-title">
          Hackathons
        </h2>
        <p className="home-calendar__lede">
          What is coming up, and what already happened. Open an event for the
          full brief, its schedule, and the sponsors behind it.
        </p>
      </header>

      {events.isPending ? (
        <p className="home-calendar__note" role="status">
          Loading the calendar…
        </p>
      ) : null}

      {events.error !== null ? (
        <div className="home-calendar__error" role="alert">
          <h3 className="home-calendar__error-title">
            The calendar could not be loaded.
          </h3>
          <p>{authErrorMessage(events.error)}</p>
          <button
            className="button button--ghost"
            type="button"
            onClick={() => void events.refetch()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {events.isSuccess && ordered.length === 0 ? (
        <p className="home-calendar__empty">
          Nothing is on the calendar yet. Events appear here once an organiser
          publishes them.
        </p>
      ) : null}

      {ordered.length > 0 ? (
        <ul className="event-grid">
          {ordered.map((event) => (
            <HackathonCard key={event.id} event={event} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
