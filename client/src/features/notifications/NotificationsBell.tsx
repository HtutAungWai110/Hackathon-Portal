import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
 * The notice bell in the account area. It reads unread notifications from the
 * server and merges in cached history so old notifications still appear.
 *
 * The panel is drawn in a portal at a fixed position under the button. The nav
 * sits inside the page stages, whose blanket stacking contexts and clipping
 * would otherwise paint the event copy over the panel and cut it off.
 */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  // Anchor the panel under the button and keep it there through scroll and
  // resize, since it no longer travels with the nav in the DOM.
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const button = buttonRef.current;
    if (button === null) {
      return;
    }

    function updatePosition(): void {
      if (button === null) {
        return;
      }
      const rect = button.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

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
        ref={buttonRef}
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

      {open && position !== null
        ? createPortal(
            <div
              className="notifications-bell__menu"
              role="menu"
              aria-label="Notifications"
              style={{ top: position.top, right: position.right }}
            >
              <p className="notifications-bell__menu-label">Notifications</p>

              {items.length === 0 ? (
                <p className="notifications-bell__empty">No notifications yet.</p>
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
