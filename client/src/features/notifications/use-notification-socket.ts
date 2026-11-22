import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { currentAccessToken, refreshSession } from '../../lib/api-client';
import { API_URL } from '../../lib/api-config';
import {
  notificationKeys,
  type Notification,
  type NotificationsPage,
} from './notifications-api';
import { readNotificationIds, saveReadIds } from './read-marks';
import { markRowsRead } from './use-notifications';

/**
 * The realtime half of the inbox: while the user is online, new rows arrive
 * here the moment the server creates them, and marking them read on one tab
 * marks them read on every tab (the server broadcasts the change back).
 *
 * While there is no user the effect is off; the REST query in
 * `useUnreadNotifications` is the backstop. The token for the handshake is
 * read fresh from the cookie on every reconnect attempt, and a stale one is
 * refreshed through the normal rotation path first.
 */
export function useNotificationSocket(userId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (userId === null) {
      return;
    }

    const socket = io(API_URL, {
      withCredentials: true,
      auth: (cb) => {
        void (async () => {
          let token = currentAccessToken();
          if (token === null) {
            await refreshSession();
            token = currentAccessToken();
          }
          cb({ token });
        })();
      },
    });

    socket.on('notification:new', (row: Notification) => {
      queryClient.setQueriesData<NotificationsPage>(
        { queryKey: notificationKeys.unread() },
        (old) => {
          if (old === undefined) {
            // The page was never asked for: the new row alone would not show
            // anywhere, so fall back to fetching the list.
            void queryClient.invalidateQueries({
              queryKey: notificationKeys.unread(),
            });
            return old;
          }
          // A row the user already read on another tab still arrives here;
          // it lands read and does not bump the count.
          const alreadyRead = readNotificationIds().has(row.id);
          return {
            ...old,
            items: [{ ...row, read: alreadyRead || row.read }, ...old.items],
            unreadCount: alreadyRead ? old.unreadCount : old.unreadCount + 1,
          };
        },
      );
    });

    socket.on('notification:read', ({ ids, unreadCount }: { ids: string[]; unreadCount: number }) => {
      saveReadIds(ids);
      queryClient.setQueriesData<NotificationsPage>(
        { queryKey: notificationKeys.unread() },
        (old) =>
          old === undefined
            ? old
            : { ...old, items: markRowsRead(old.items, ids), unreadCount },
      );
    });

    socket.on('notification:unreadCount', ({ count }: { count: number }) => {
      queryClient.setQueriesData<NotificationsPage>(
        { queryKey: notificationKeys.unread() },
        (old) => (old === undefined ? old : { ...old, unreadCount: count }),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, queryClient]);
}
