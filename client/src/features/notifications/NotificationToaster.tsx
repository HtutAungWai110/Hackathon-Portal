import { AnimatePresence, MotionConfig } from 'motion/react';
import { useNavigate } from 'react-router';
import { NotificationToastCard } from './NotificationToastCard';
import {
  useNotificationToastStore,
  type NotificationToast,
} from './notification-toast-store';
import './NotificationToaster.css';

/**
 * The live arrival desk. It sits at the bottom of the screen, away from the
 * nav and the bell that raised it, and draws a slip for each notice the socket
 * delivers while the user is online.
 *
 * It is mounted once, above the router's pages, so a navigation does not cut a
 * notice short; the store is the only thing it knows about.
 */
export function NotificationToaster() {
  const toasts = useNotificationToastStore((state) => state.toasts);
  const dismiss = useNotificationToastStore((state) => state.dismiss);
  const navigate = useNavigate();

  function open(toast: NotificationToast): void {
    dismiss(toast.id);
    if (toast.link !== null) {
      navigate(toast.link);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <ol
        className="notification-toaster"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="New notifications"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <NotificationToastCard
              key={toast.id}
              toast={toast}
              onDismiss={dismiss}
              onOpen={open}
            />
          ))}
        </AnimatePresence>
      </ol>
    </MotionConfig>
  );
}
