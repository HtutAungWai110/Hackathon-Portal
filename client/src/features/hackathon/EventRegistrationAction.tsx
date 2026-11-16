import { formatMoment } from '../../lib/event-display';
import { authErrorMessage } from '../../lib/auth-error';
import { useRegisterForEvent, useRegistrationStatus } from './use-registration';

type EventRegistrationActionProps = {
  eventId: string;
  eventTitle: string;
};

/**
 * The public page's registration control. It owns the status read and the
 * write, so the page only decides whether a visitor may see it at all: an
 * admin gets Manage event, and a signed out visitor gets the sign in link.
 */
export function EventRegistrationAction({
  eventId,
  eventTitle,
}: EventRegistrationActionProps) {
  const status = useRegistrationStatus(eventId, true);
  const register = useRegisterForEvent(eventId, eventTitle);

  if (status.isPending) {
    return (
      <p className="hackathon-registration-note" role="status">
        Checking your registration…
      </p>
    );
  }

  if (status.error !== null) {
    return (
      <div
        className="hackathon-registration-note hackathon-registration-note--error"
        role="alert"
      >
        <span>We could not check your registration.</span>
        <button
          className="text-link"
          type="button"
          onClick={() => void status.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  const registeredAt = status.data.registeredAt;
  if (status.data.registered) {
    const when = registeredAt === null ? null : formatMoment(registeredAt);
    return (
      <p className="hackathon-registration-note hackathon-registration-note--done">
        You are registered{when === null ? '.' : ` since ${when}.`}
      </p>
    );
  }

  if (!status.data.open) {
    return (
      <p className="hackathon-registration-note">Registration is closed.</p>
    );
  }

  return (
    <div className="hackathon-registration-action">
      <button
        className="button button--primary"
        type="button"
        disabled={register.isPending}
        onClick={() => register.mutate()}
      >
        {register.isPending ? 'Registering…' : 'Register'}
      </button>
      <p className="hackathon-registration-hint">
        Holding a place is one click. You can come back to this page any time.
      </p>
      {register.error !== null ? (
        <p className="hackathon-registration-note" role="alert">
          {authErrorMessage(register.error)}
        </p>
      ) : null}
    </div>
  );
}
