import { create } from 'zustand';

export type MessageTone = 'success' | 'error';

export type QueuedMessage = {
  id: string;
  tone: MessageTone;
  /** The headline, short enough to read at a glance. */
  title: string;
  /** The detail, usually the event that changed or the server's reason. */
  body: string | null;
  /** Milliseconds on screen before it dismisses itself. */
  duration: number;
};

export type MessageInput = {
  tone: MessageTone;
  title: string;
  body?: string;
  /** Overrides the tone's default lifetime. */
  duration?: number;
};

/** A receipt can go quickly; a failure is worth reading twice. */
const DEFAULT_DURATION: Record<MessageTone, number> = {
  success: 5_000,
  error: 9_000,
};

/** Enough for a burst of actions without covering the page. */
const MAX_MESSAGES = 4;

let nextId = 0;

type MessageState = {
  /** Newest first, because the stack renders from the top down. */
  messages: QueuedMessage[];
  push: (input: MessageInput) => string;
  dismiss: (id: string) => void;
};

/**
 * The global message queue. It lives in a store rather than a context so a
 * mutation hook can report its outcome without being inside a provider, which
 * is exactly where most of these messages are raised.
 *
 * Messages are not deduplicated: two saves that fail for the same reason are
 * two failures, and hiding the second one would be a lie.
 */
export const useMessageStore = create<MessageState>()((set) => ({
  messages: [],

  push: (input) => {
    const id = `message-${(nextId += 1)}`;
    const message: QueuedMessage = {
      id,
      tone: input.tone,
      title: input.title,
      body: input.body ?? null,
      duration: input.duration ?? DEFAULT_DURATION[input.tone],
    };

    // The oldest message leaves when the cap is reached; its card unmounts,
    // which also clears the timer it was holding.
    set((state) => ({
      messages: [message, ...state.messages].slice(0, MAX_MESSAGES),
    }));

    return id;
  },

  dismiss: (id) => {
    set((state) => ({
      messages: state.messages.filter((message) => message.id !== id),
    }));
  },
}));

/**
 * The way a non component reaches the queue: `useMessageStore.getState()` is
 * stable, so a mutation callback or a plain module can push a message without
 * subscribing to the stack.
 */
export function pushMessage(input: MessageInput): string {
  return useMessageStore.getState().push(input);
}
