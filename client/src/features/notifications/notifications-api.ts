import { apiFetch } from '../../lib/api-client';

/**
 * One unread-or-arrived notice. `data` is a small JSON object the console
 * acts on; new kinds ship inside it, so the server may add a field without a
 * new route.
 */
export type Notification = {
  id: string;
  senderId: string | null;
  receiverId: string;
  data: Record<string, unknown>;
  message: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NotificationsPage = {
  items: Notification[];
  unreadCount: number;
};

/**
 * The in-app address a notice points at, if it has one. Only a single-slash
 * path is accepted: a stored value can never send the app to another origin.
 */
export function notificationLink(row: Notification): string | null {
  const link = row.data.link;
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//')) {
    return null;
  }
  return link;
}

export const notificationKeys = {
  all: ['notifications'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
};

/** The unread list for the bell, newest first. */
export async function fetchUnreadNotifications(
  page = 1,
  limit = 50,
): Promise<NotificationsPage> {
  const search = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiFetch<NotificationsPage>(`/notifications?${search.toString()}`);
}

export async function markNotificationRead(id: string): Promise<{
  id: string;
  read: true;
  unreadCount: number;
}> {
  return apiFetch<{ id: string; read: true; unreadCount: number }>(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  );
}
