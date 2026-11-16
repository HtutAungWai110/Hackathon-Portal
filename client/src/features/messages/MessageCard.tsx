import { useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import type { QueuedMessage } from './message-store';

type MessageCardProps = {
  message: QueuedMessage;
  onDismiss: (id: string) => void;
};

/**
 * One message in the stack. The card owns its own timer so an error that
 * arrives while a success is still on screen keeps a full lifetime, instead of
 * inheriting whatever was left of the one above it.
 */
export function MessageCard({ message, onDismiss }: MessageCardProps) {
  const success = message.tone === 'success';

  useEffect(() => {
    if (message.duration <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      onDismiss(message.id);
    }, message.duration);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message.id, message.duration, onDismiss]);

  return (
    <motion.li
      layout
      className="message-card"
      data-tone={message.tone}
      // Enters from the right edge and travels left into the stack.
      initial={{ opacity: 0, x: 72, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.98 }}
      transition={{
        x: { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 },
        scale: { type: 'spring', stiffness: 420, damping: 34 },
        opacity: { duration: 0.18, ease: 'easeOut' },
        layout: { type: 'spring', stiffness: 520, damping: 42 },
      }}
    >
      <span className="message-card__mark" aria-hidden="true">
        {success ? <CheckIcon /> : <TriangleAlertIcon />}
      </span>

      <div className="message-card__text">
        <p className="message-card__title">{message.title}</p>
        {message.body !== null ? (
          <p className="message-card__body">{message.body}</p>
        ) : null}
      </div>

      <button
        className="message-card__close"
        type="button"
        aria-label={`Dismiss message: ${message.title}`}
        onClick={() => onDismiss(message.id)}
      >
        <XIcon aria-hidden="true" />
      </button>
    </motion.li>
  );
}
