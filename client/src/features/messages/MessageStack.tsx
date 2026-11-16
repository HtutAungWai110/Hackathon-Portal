import { AnimatePresence, MotionConfig } from 'motion/react';
import { MessageCard } from './MessageCard';
import { useMessageStore } from './message-store';
import './messages.css';

/**
 * The one place messages are drawn. It is mounted once, above the router, so a
 * message raised on the edit screen survives the navigation to the ledger.
 *
 * Newest is first in the store, so it is also the top card: a new message pushes
 * the older ones down rather than appearing under them.
 */
export function MessageStack() {
  const messages = useMessageStore((state) => state.messages);
  const dismiss = useMessageStore((state) => state.dismiss);

  return (
    <MotionConfig reducedMotion="user">
      <ol
        className="message-stack"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              onDismiss={dismiss}
            />
          ))}
        </AnimatePresence>
      </ol>
    </MotionConfig>
  );
}
