import { formatMoment } from '../../lib/event-display';
import type {
  AdminRegistration,
  ApplicationStatus,
} from './events-api';

type RegistrationCardProps = {
  registration: AdminRegistration;
  /** True for the row a `registrationId` deep link points at. */
  focused?: boolean;
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  IN_PROGRESS: 'In review',
  INTERVIEW: 'Interview',
  REJECTED: 'Not selected',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join('');
}

/**
 * One application wrapper. The message is the reason the row exists, so it
 * gets the full width; the company is optional and only appears when the
 * participant gave one. The email is a mail link because the console's next
 * move is usually writing to that person.
 */
export function RegistrationCard({
  registration,
  focused = false,
}: RegistrationCardProps) {
  const name = registration.user.name.trim();
  const when = formatMoment(registration.applicationDate);
  const companyName = registration.companyName?.trim() ?? '';
  const companyEmail = registration.companyEmail?.trim() ?? '';

  return (
    <li
      className={
        focused ? 'registration-card registration-card--focused' : 'registration-card'
      }
    >
      <span className="registration-card__avatar" aria-hidden="true">
        {initials(name) || '?'}
      </span>
      <span className="registration-card__body">
        <span className="registration-card__name">{name}</span>
        <a
          className="registration-card__email"
          href={`mailto:${registration.user.email}`}
        >
          {registration.user.email}
        </a>
      </span>
      <span className="registration-card__side">
        <span className="registration-card__when">{when ?? 'Applied'}</span>
        <span
          className="registration-card__status"
          data-status={registration.status}
        >
          {STATUS_LABELS[registration.status]}
        </span>
      </span>

      <p className="registration-card__message">
        {registration.additionalMessage}
      </p>

      {companyName.length > 0 || companyEmail.length > 0 ? (
        <p className="registration-card__company">
          {companyName.length > 0 ? (
            <span className="registration-card__company-name">
              {companyName}
            </span>
          ) : null}
          {companyEmail.length > 0 ? (
            <a
              className="registration-card__company-email"
              href={`mailto:${companyEmail}`}
            >
              {companyEmail}
            </a>
          ) : null}
        </p>
      ) : null}
    </li>
  );
}
