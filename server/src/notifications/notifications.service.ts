import { Inject, Injectable } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { NOTIFICATION_QUEUE } from './notifications.constants.js';
import type {
  NewNotification,
  NotificationRow,
  NotificationsPage,
  NotificationJobData,
} from './notifications.types.js';

/**
 * How long a caller waits for Redis before giving up, the same shape as the
 * mail queue's enqueue: a notification is not worth failing a request over,
 * so the only deadline is one that stops the request from hanging.
 */
const ENQUEUE_DEADLINE_MS = 5_000;

const ROW_SELECT = {
  id: true,
  senderId: true,
  receiverId: true,
  data: true,
  message: true,
  read: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * The producer side: enqueue jobs, and the reader side for the controller
 * and gateway. Writing rows is the processor's job, not the API's, so the
 * question "was it queued" is one method away from "was it delivered".
 */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(getQueueToken(NOTIFICATION_QUEUE))
    private readonly queue: Queue<NotificationJobData>,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueue a job that will create the rows when it is processed. Zero
   * rows is still a call — it stops the caller re-enqueueing the same thing
   * twice — so the queue is skipped only when there is nothing to deliver.
   */
  async notify(notifications: NewNotification[]): Promise<void> {
    if (notifications.length === 0) {
      return;
    }
    await withDeadline(
      this.queue.add('create-notifications', {
        kind: 'create',
        notifications,
      }),
      ENQUEUE_DEADLINE_MS,
    );
  }

  /**
   * Create the rows themselves. Called by the processor, and by nobody else:
   * rows have to exist for a notice to be delivered, and the delivery job
   * is what makes that orderings true.
   */
  async store(notifications: NewNotification[]): Promise<NotificationRow[]> {
    if (notifications.length === 0) {
      return [];
    }
    return this.prisma.notification.createManyAndReturn({
      data: notifications,
      select: ROW_SELECT,
    });
  }

  /** One user's unread rows, newest first, and the unread total for the badge. */
  async listUnread(userId: string, page = 1, limit = 50): Promise<NotificationsPage> {
    const unread = { receiverId: userId, read: false };
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: unread,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: ROW_SELECT,
      }),
      this.prisma.notification.count({ where: unread }),
    ]);
    return { items, unreadCount };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { receiverId: userId, read: false },
    });
  }

  /**
   * Mark unread rows read. Returns the ids that exist for this user. A row
   * already read is not a failure; the caller just gets an id it can
   * re-filter, so idempotent re-sends are fine.
   */
  async markReadByIds(
    userId: string,
    ids: string[],
  ): Promise<{ marked: string[]; unreadCount: number }> {
    if (ids.length === 0) {
      return { marked: [], unreadCount: await this.unreadCount(userId) };
    }
    const { count } = await this.prisma.notification.updateMany({
      where: { id: { in: ids }, receiverId: userId },
      data: { read: true },
    });
    // The caller gets the count back so both channels can carry the same
    // authoritative number to every tab.
    const unreadCount = await this.unreadCount(userId);
    return { marked: count > 0 ? ids : [], unreadCount };
  }

  async markReadAll(userId: string): Promise<number> {
    const { count } = await this.prisma.notification.updateMany({
      where: { receiverId: userId, read: false },
      data: { read: true },
    });
    return count;
  }
}

function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`No response from the notification queue in ${milliseconds}ms.`)),
      milliseconds,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
