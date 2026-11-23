import { useEffect, useRef } from 'react';
import { ArrowUpRightIcon } from 'lucide-react';
import { formatMoment } from '../../lib/event-display';
import { notificationLink, type Notification } from './notifications-api';

type NotificationBellRowProps = {
  notification: Notification;
  onSeen: (id: string) => void;
  onOpen: (notification: Notification) => void;
};

/**
 * One row in the bell's panel. A row counts as read the moment it is actually
 * on screen: the observer watches the row against the clipped panel, so
 * opening the bell clears what the user can see and scrolling clears the rest.
 * There is no separate "mark as read" step to remember.
 */
export function NotificationBellRow({
  notification,
  onSeen,
  onOpen,
}: NotificationBellRowProps) {
  const row = useRef<HTMLLIElement>(null);
  const seen = useRef(false);
  const link = notificationLink(notification);

  useEffect(() => {
    const element = row.current;
    if (element === null || notification.read || seen.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (seen.current || !entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        seen.current = true;
        observer.disconnect();
        onSeen(notification.id);
      },
      // Enough of the row has to be inside the panel's scroll box, so a row
      // half hidden under the edge does not count as read yet.
      { threshold: 0.6 },
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [notification.id, notification.read, onSeen]);

  return (
    <li className="notifications-bell__item" ref={row}>
      <button
        className="notifications-bell__item-button"
        type="button"
        role="menuitem"
        onClick={() => {
          onSeen(notification.id);
          onOpen(notification);
        }}
      >
        <span className="notifications-bell__message">{notification.message}</span>
        <span className="notifications-bell__foot">
          <span className="notifications-bell__time">
            {formatMoment(notification.createdAt) ?? 'Recently'}
          </span>
          {link === null ? null : (
            <ArrowUpRightIcon className="notifications-bell__arrow" aria-hidden="true" />
          )}
        </span>
      </button>
    </li>
  );
}
