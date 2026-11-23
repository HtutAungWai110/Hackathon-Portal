import { create } from 'zustand';
import { notificationLink, type Notification } from './notifications-api';

/**
 * A notice that arrived while the user was online, reduced to what the card
 * needs. The `Notification` itself stays in the query cache; the toast is a
 * preview of it, not a second copy of the inbox.
 */
export type NotificationToast = {
  id: string;
  message: string;
  createdAt: string;
  link: string | null;
  actionLabel: string;
};

/** Three slips at once is a nudge; more is a wall over the page. */
const MAX_TOASTS = 3;

type NotificationToastState = {
  /** Newest first, so the newest card is the one nearest the bottom edge. */
  toasts: NotificationToast[];
  push: (toast: NotificationToast) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

/**
 * The stack is drawn once, above the router's pages, so a notice raised on one
 * screen survives a navigation. It is not persisted: a toast is about what is
 * happening now, and the bell is where the inbox lives.
 */
export const useNotificationToastStore = create<NotificationToastState>()(
  (set) => ({
    toasts: [],

    push: (toast) => {
      set((state) => {
        if (state.toasts.some((existing) => existing.id === toast.id)) {
          return state;
        }
        return { toasts: [toast, ...state.toasts].slice(0, MAX_TOASTS) };
      });
    },

    dismiss: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }));
    },

    clear: () => {
      set({ toasts: [] });
    },
  }),
);

/**
 * The way the socket reaches the stack without subscribing to it. The action
 * label is content, so it is chosen from the notice's kind rather than left as
 * a generic "Open".
 */
export function pushNotificationToast(row: Notification): void {
  const link = notificationLink(row);
  useNotificationToastStore.getState().push({
    id: row.id,
    message: row.message,
    createdAt: row.createdAt,
    link,
    actionLabel:
      row.data.kind === 'event.registration'
        ? 'Review application'
        : 'Open notification',
  });
}

/** Used when the session ends: another account's notices are not this one's. */
export function clearNotificationToasts(): void {
  useNotificationToastStore.getState().clear();
}

/** A row that is read no longer needs its slip on screen. */
export function dismissNotificationToasts(ids: string[]): void {
  const { dismiss } = useNotificationToastStore.getState();
  for (const id of ids) {
    dismiss(id);
  }
}
