import { useId, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { Link } from 'react-router';
import { authErrorMessage } from '../../lib/auth-error';
import { useEventRegistrations } from './use-event-registrations';
import { RegistrationCard } from './RegistrationCard';
import { registrationsPath } from './paths';

type EventRegistrationsProps = {
  eventId: string;
  eventTitle: string;
  count: number;
};

/**
 * The console's registrations drawer for one event. The list is fetched only
 * once the drawer is opened, and the height animation is the one deliberate
 * motion here: it shows where the rows came from without moving the page.
 */
export function EventRegistrations({
  eventId,
  eventTitle,
  count,
}: EventRegistrationsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  // The drawer is a preview: page one, the console's default page size. The
  // full screen next to it owns paging, and it is one link away.
  const applications = useEventRegistrations(eventId, open);
  const rows = applications.data?.items ?? [];
  const total = applications.data?.total ?? count;

  return (
    <div className="event-registrations">
      <button
        className={
          open
            ? 'button button--quiet event-registrations__toggle event-registrations__toggle--open'
            : 'button button--quiet event-registrations__toggle'
        }
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide applications' : 'Show applications'}
        <span className="event-registrations__count" aria-hidden="true">
          {total}
        </span>
      </button>

      <MotionConfig reducedMotion="user">
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id={panelId}
              className="event-registrations__panel"
              key="registrations"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="event-registrations__inner">
                <p className="event-registrations__label">
                  Applications for {eventTitle}
                </p>

                {applications.isPending ? (
                  <p
                    className="event-registrations__note"
                    role="status"
                  >
                    Reading applications…
                  </p>
                ) : null}

                {applications.error !== null ? (
                  <div className="event-registrations__error" role="alert">
                    <p>{authErrorMessage(applications.error)}</p>
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => void applications.refetch()}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}

                {applications.isSuccess && rows.length === 0 ? (
                  <p className="event-registrations__note">
                    No one has applied yet.
                  </p>
                ) : null}

                {rows.length > 0 ? (
                  <ul className="registration-list">
                    {rows.map((registration) => (
                      <RegistrationCard
                        key={registration.id}
                        registration={registration}
                      />
                    ))}
                  </ul>
                ) : null}

                {applications.isSuccess && total > rows.length ? (
                  <p className="event-registrations__note">
                    Showing the newest {rows.length} of {total}.{' '}
                    <Link
                      className="text-link"
                      to={registrationsPath(eventId)}
                    >
                      See all applications
                    </Link>
                  </p>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
