import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchUnreadNotifications,
  markNotificationRead,
  notificationKeys,
} from './notifications-api';
import { saveReadIds } from './read-marks';
import { markCachedNotificationsRead, readCachedNotifications, saveNotificationsToCache } from './notification-cache';
import type { Notification, NotificationsPage } from './notifications-api';

/** The rows the page returns at once. */
export const UNREAD_PAGE_SIZE = 50;

/** Unread notifications from the server, merged with cached read history for display. */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: async () => {
      const page = await fetchUnreadNotifications(1, UNREAD_PAGE_SIZE);
      saveNotificationsToCache(page.items);
      const cached = readCachedNotifications();
      const serverIds = new Set(page.items.map((item: Notification) => item.id));
      const extraFromCache = cached.filter(
        (item: Notification) => item.read && !serverIds.has(item.id),
      );
      const items = [...page.items, ...extraFromCache].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return {
        items,
        unreadCount: page.unreadCount,
      } as NotificationsPage;
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
      saveReadIds([response.id]);
      markCachedNotificationsRead([response.id]);
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
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
  });
}

/**
 * Closing the panel refetches the recent list so the read state stays fresh.
 */
export function useRefreshUnreadNotifications(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
  }, [queryClient]);
}
