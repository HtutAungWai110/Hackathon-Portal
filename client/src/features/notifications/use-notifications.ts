import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchUnreadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
} from './notifications-api';
import { readNotificationIds, saveReadIds } from './read-marks';
import type { Notification, NotificationsPage } from './notifications-api';

/**
 * The rows the page returns at once. The bell only needs the first batch;
 * more rows arrive through the socket.
 */
export const UNREAD_PAGE_SIZE = 50;

/**
 * The unread rows for one user, newest first. The REST list is unread-only;
 * anything the user already read on this device but the server has not caught
 * up with is filtered out, so the page still answers only unread rows.
 */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async () => {
      const page = await fetchUnreadNotifications(1, UNREAD_PAGE_SIZE);
      const read = readNotificationIds();
      const alreadyRead = page.items.filter((row) => read.has(row.id));
      return {
        ...page,
        items: page.items.filter((row) => !read.has(row.id)),
        unreadCount: Math.max(0, page.unreadCount - alreadyRead.length),
      };
    },
    staleTime: 30_000,
    retry: false,
  });
}

/** Sets `read` on every row with one of these ids; the socket broadcasts the same change to other tabs. */
export function markRowsRead(
  rows: Notification[],
  ids: string[],
): Notification[] {
  const read = new Set(ids);
  return rows.map((row) => (read.has(row.id) ? { ...row, read: true } : row));
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (response) => {
      // The read mark is saved the moment it happens, not on the next refetch.
      saveReadIds([response.id]);
      queryClient.setQueriesData<NotificationsPage>(
        { queryKey: notificationKeys.unread() },
        (old) =>
          old === undefined
            ? old
            : {
                ...old,
                items: markRowsRead(old.items, [response.id]),
                unreadCount: response.unreadCount,
              },
      );
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      const old = queryClient.getQueryData<NotificationsPage>(
        notificationKeys.unread(),
      );
      saveReadIds(old?.items.filter((row) => row.read === false).map((row) => row.id) ?? []);
      queryClient.setQueriesData<NotificationsPage>(
        { queryKey: notificationKeys.unread() },
        (old) =>
          old === undefined
            ? old
            : {
                ...old,
                items: old.items.map((row) => ({ ...row, read: true })),
                unreadCount: 0,
              },
      );
    },
  });
}
