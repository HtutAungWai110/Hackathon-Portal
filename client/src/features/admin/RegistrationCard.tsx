import { formatMoment } from '../../lib/event-display';
import type { AdminRegistration } from './events-api';

type RegistrationCardProps = {
  registration: AdminRegistration;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join('');
}

/**
 * One registration wrapper: who holds the place, how to reach them, and when
 * they took it. The email is a mail link because the console's next move is
 * usually writing to that person.
 */
export function RegistrationCard({ registration }: RegistrationCardProps) {
  const name = registration.user.name.trim();
  const when = formatMoment(registration.createdAt);

  return (
    <li className="registration-card">
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
      <span className="registration-card__when">
        {when ?? 'Registered'}
      </span>
    </li>
  );
}
