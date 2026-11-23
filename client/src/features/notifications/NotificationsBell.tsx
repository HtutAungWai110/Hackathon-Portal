import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { BellIcon } from 'lucide-react';
import {
  useMarkNotificationRead,
  useRefreshUnreadNotifications,
  useUnreadNotifications,
} from './use-notifications';
import { NotificationBellRow } from './NotificationBellRow';
import { notificationLink, type Notification } from './notifications-api';
import './NotificationsBell.css';

/**
 * The notice bell in the account area. It reads the unread page from the
 * cache, and while the socket is connected it gets every new row as it is
 * created.
 *
 * Opening the panel is what reads the notices: each row marks itself read when
 * it is actually visible, so there is no second "mark as read" click. Closing
 * the panel refetches the unread page, which drops the rows the server now
 * considers read. A row with a stored link is also a way into the screen it
 * came from.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useUnreadNotifications();
  const markRead = useMarkNotificationRead();
  const refreshUnread = useRefreshUnreadNotifications();
  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  function close(): void {
    setOpen(false);
    refreshUnread();
  }

  function openNotification(notification: Notification): void {
    const link = notificationLink(notification);
    if (link !== null) {
      navigate(link);
    }
    close();
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
        refreshUnread();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, refreshUnread]);

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
        onClick={() => {
          if (open) {
            close();
          } else {
            setOpen(true);
          }
        }}
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
                <NotificationBellRow
                  key={row.id}
                  notification={row}
                  onSeen={markRead.mutate}
                  onOpen={openNotification}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
