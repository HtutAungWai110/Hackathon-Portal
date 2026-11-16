import { useId, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { authErrorMessage } from '../../lib/auth-error';
import { useEventRegistrations } from './use-event-registrations';
import { RegistrationCard } from './RegistrationCard';

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
  const registrations = useEventRegistrations(eventId, open);
  const rows = registrations.data ?? [];

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
        {open ? 'Hide registrations' : 'Show registrations'}
        <span className="event-registrations__count" aria-hidden="true">
          {rows.length > 0 ? rows.length : count}
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
                  Registrations for {eventTitle}
                </p>

                {registrations.isPending ? (
                  <p
                    className="event-registrations__note"
                    role="status"
                  >
                    Reading registrations…
                  </p>
                ) : null}

                {registrations.error !== null ? (
                  <div className="event-registrations__error" role="alert">
                    <p>{authErrorMessage(registrations.error)}</p>
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => void registrations.refetch()}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}

                {registrations.isSuccess && rows.length === 0 ? (
                  <p className="event-registrations__note">
                    No one has registered yet.
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
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
