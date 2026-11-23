import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FocusEvent } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRightIcon, BellRingIcon, XIcon } from 'lucide-react';
import type { NotificationToast } from './notification-toast-store';

/** Full life of a slip, and the slow tail where it fades out. */
const LIFETIME_MS = 10_400;
const FADE_MS = 2_600;

const CLOCK = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
});

function arrivedAt(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : CLOCK.format(date);
}

type NotificationToastCardProps = {
  toast: NotificationToast;
  onDismiss: (id: string) => void;
  onOpen: (toast: NotificationToast) => void;
};

/**
 * One notice, as a dispatch slip: a perforated stub on the left, the message
 * on the right, and a rail along the bottom that drains while the slip waits.
 *
 * The slip fades on a slow timer rather than vanishing, and the timer stops
 * while the pointer or the keyboard is on it so a notice is never taken away
 * mid-read. The card owns its own clock, so a second notice arriving does not
 * shorten the first one's stay.
 */
export function NotificationToastCard({
  toast,
  onDismiss,
  onOpen,
}: NotificationToastCardProps) {
  const [paused, setPaused] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(LIFETIME_MS);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) {
      return;
    }

    startedAt.current = performance.now();
    const fade = window.setTimeout(
      () => setLeaving(true),
      Math.max(0, remaining.current - FADE_MS),
    );
    const end = window.setTimeout(() => onDismiss(toast.id), remaining.current);

    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(end);
      remaining.current = Math.max(
        0,
        remaining.current - (performance.now() - startedAt.current),
      );
    };
  }, [paused, onDismiss, toast.id]);

  function releaseFocus(event: FocusEvent<HTMLLIElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setPaused(false);
    }
  }

  const time = arrivedAt(toast.createdAt);

  return (
    <motion.li
      layout
      className="notification-toast"
      data-paused={paused ? 'true' : 'false'}
      style={{ '--toast-lifetime': `${LIFETIME_MS}ms` } as CSSProperties}
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: leaving ? 0 : 1, x: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.35, ease: 'easeIn' } }}
      transition={{
        opacity: {
          duration: leaving ? FADE_MS / 1000 : 0.22,
          ease: 'easeOut',
        },
        x: { type: 'spring', stiffness: 420, damping: 36 },
        layout: { type: 'spring', stiffness: 500, damping: 40 },
      }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={releaseFocus}
    >
      <span className="notification-toast__stub" aria-hidden="true">
        <BellRingIcon />
      </span>

      <div className="notification-toast__content">
        <p className="notification-toast__meta">
          <span className="notification-toast__eyebrow">New notice</span>
          {time === null ? null : (
            <time className="notification-toast__time" dateTime={toast.createdAt}>
              {time}
            </time>
          )}
        </p>
        <p className="notification-toast__message">{toast.message}</p>
        {toast.link === null ? null : (
          <button
            className="notification-toast__open"
            type="button"
            onClick={() => onOpen(toast)}
          >
            {toast.actionLabel}
            <ArrowUpRightIcon aria-hidden="true" />
          </button>
        )}
      </div>

      <button
        className="notification-toast__close"
        type="button"
        aria-label={`Dismiss notification: ${toast.message}`}
        onClick={() => onDismiss(toast.id)}
      >
        <XIcon aria-hidden="true" />
      </button>

      <span className="notification-toast__rail" aria-hidden="true" />
    </motion.li>
  );
}
