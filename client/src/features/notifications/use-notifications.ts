import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchUnreadNotifications,
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
    onError: () => {
      // The row is still unread on the server; refetching puts the truth back
      // instead of leaving a notice that silently disappeared from the panel.
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
    },
  });
}

/**
 * `stale` is not the same as empty: a row marked read while the panel was open
 * is still in the cache. Closing the panel asks the server for the unread page
 * again, which is what makes the read rows actually leave.
 */
export function useRefreshUnreadNotifications(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.unread() });
  }, [queryClient]);
}
