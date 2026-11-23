import { Outlet } from 'react-router';
import { useSession } from '../features/auth/session';
import { NotificationToaster } from '../features/notifications/NotificationToaster';
import { useNotificationSocket } from '../features/notifications/use-notification-socket';

/**
 * The frame every route renders inside. The socket lives here rather than in
 * the nav, so a navigation neither drops the connection nor cuts a toast
 * short; the bell and the toaster both read what it writes.
 */
export function AppShell() {
  const session = useSession();
  useNotificationSocket(session.data?.user?.id ?? null);

  return (
    <>
      <Outlet />
      <NotificationToaster />
    </>
  );
}
