import { useEffect, useState } from 'react';
import { BellIcon, CheckIcon } from 'lucide-react';
import { formatMoment } from '../../lib/event-display';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useUnreadNotifications,
} from './use-notifications';
import type { Notification } from './notifications-api';
import './NotificationsBell.css';

/**
 * The notice bell in the account area. It reads the unread page from the
 * cache, and while the socket is connected it gets every new row as it is
 * created. Clicking the badge or any row marks rows read; the server
 * broadcasts the change back so other tabs follow along.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const { data } = useUnreadNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="notifications-bell">
      <button
        className="notifications-bell__button"
        type="button"
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon className="notifications-bell__icon" aria-hidden />
        {unreadCount > 0 ? (
          <span className="notifications-bell__dot" aria-hidden>
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="notifications-bell__menu"
          role="menu"
          aria-label="Notifications"
        >
          <p className="notifications-bell__menu-label">Notifications</p>

          {items.length === 0 ? (
            <p className="notifications-bell__empty">No new notifications.</p>
          ) : (
            <ul className="notifications-bell__items">
              {items.map((row: Notification) => (
                <li className="notifications-bell__item" key={row.id}>
                  <button
                    className={
                      row.read
                        ? 'notifications-bell__item-button notifications-bell__item-button--read'
                        : 'notifications-bell__item-button'
                    }
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      markRead.mutate(row.id);
                      setOpen(false);
                    }}
                  >
                    <span className="notifications-bell__message">{row.message}</span>
                    <span className="notifications-bell__time">
                      {formatMoment(row.createdAt) ?? 'Recently'}
                    </span>
                    {!row.read ? (
                      <CheckIcon className="notifications-bell__unread" aria-hidden />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {unreadCount > 0 ? (
            <button
              className="notifications-bell__mark-all"
              type="button"
              role="menuitem"
              onClick={() => {
                markAll.mutate();
                setOpen(false);
              }}
            >
              Mark all as read
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
