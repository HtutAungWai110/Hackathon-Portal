import type { Prisma } from '../generated/prisma/client.js';

/** One row of the Notification table as the API answers it. Dates arrive as
 *  ISO strings because this shape crosses the wire. */
export type NotificationRow = {
  id: string;
  senderId: string | null;
  receiverId: string;
  /** The action the console takes on it. New kinds ship inside `data`. */
  data: Prisma.JsonValue;
  message: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** One message the producer asks for. `senderId` is null for the system. */
export type NewNotification = {
  senderId: string | null;
  receiverId: string;
  message: string;
  data: Prisma.InputJsonValue;
};

/** The shape on the queue. One row per receiver: fan-out is decided at the
 *  producer, so callers can enqueue one job for one event. */
export type NotificationJobData = {
  kind: 'create';
  notifications: NewNotification[];
};

/** The page the REST list returns: unread rows, oldest... newest first, plus
 *  the total unread count for the bell's badge. */
export type NotificationsPage = {
  items: NotificationRow[];
  unreadCount: number;
};
