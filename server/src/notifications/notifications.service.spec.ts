import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATION_QUEUE } from './notifications.constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { NotificationRow, NewNotification } from './notifications.types.js';

const MESSAGE = 'Avery Jumps applied to Winter Jam';
const DATA = { kind: 'event.registration', eventId: 'event_1', applicationId: 'app_1' };

function newNotification(overrides: Partial<NewNotification> = {}): NewNotification {
  return {
    senderId: 'user_1',
    receiverId: 'admin_1',
    message: MESSAGE,
    data: DATA,
    ...overrides,
  };
}

const ROW: NotificationRow = {
  id: 'n_1',
  senderId: 'user_1',
  receiverId: 'admin_1',
  data: DATA,
  message: MESSAGE,
  read: false,
  createdAt: new Date('2026-11-22T10:00:00.000Z'),
  updatedAt: new Date('2026-11-22T10:00:00.000Z'),
};

type NotificationMock = {
  createManyAndReturn: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

type PrismaMock = {
  notification: NotificationMock;
};

async function buildService(): Promise<{
  service: NotificationsService;
  prisma: PrismaMock;
  queue: { add: ReturnType<typeof vi.fn> };
}> {
  const prisma: PrismaMock = {
    notification: {
      createManyAndReturn: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  const queue = { add: vi.fn().mockResolvedValue({ id: 'job_1' }) };

  const module = await Test.createTestingModule({
    providers: [
      NotificationsService,
      { provide: PrismaService, useValue: prisma },
      { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: queue },
    ],
  }).compile();

  const service = module.get<NotificationsService>(NotificationsService);
  return { service, prisma, queue };
}

describe('NotificationsService', () => {
  describe('notify', () => {
    it('enqueues one job for the rows', async () => {
      const { service, queue } = await buildService();
      const rows = [newNotification()];

      await service.notify(rows);

      expect(queue.add).toHaveBeenCalledWith('create-notifications', {
        kind: 'create',
        notifications: rows,
      });
    });

    it('does not enqueue an empty batch', async () => {
      const { service, queue } = await buildService();

      await service.notify([]);

      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('store', () => {
    it('creates the rows and returns them', async () => {
      const { service, prisma } = await buildService();
      prisma.notification.createManyAndReturn.mockResolvedValue([ROW]);

      const rows = await service.store([newNotification()]);

      expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [newNotification()],
          select: expect.objectContaining({ id: true, read: true }),
        }),
      );
      expect(rows).toEqual([ROW]);
    });

    it('answers an empty array for no rows', async () => {
      const { service, prisma } = await buildService();

      await expect(service.store([])).resolves.toEqual([]);
      expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe('listUnread', () => {
    it('answers the page and the unread total', async () => {
      const { service, prisma } = await buildService();
      prisma.notification.findMany.mockResolvedValue([ROW]);
      prisma.notification.count.mockResolvedValue(7);

      const page = await service.listUnread('admin_1', 2, 20);

      expect(page).toEqual({ items: [ROW], unreadCount: 7 });
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { receiverId: 'admin_1', read: false },
          skip: 20,
          take: 20,
        }),
      );
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { receiverId: 'admin_1', read: false },
      });
    });
  });

  describe('markReadByIds', () => {
    it('marks the rows read and reports what exists for the user with the new count', async () => {
      const { service, prisma } = await buildService();
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });
      prisma.notification.count.mockResolvedValue(3);

      await expect(service.markReadByIds('admin_1', ['n_1'])).resolves.toEqual({
        marked: ['n_1'],
        unreadCount: 3,
      });
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['n_1'] }, receiverId: 'admin_1' },
        data: { read: true },
      });
    });

    it('reports an empty mark when the rows belong to someone else', async () => {
      const { service, prisma } = await buildService();
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });
      prisma.notification.count.mockResolvedValue(0);

      await expect(service.markReadByIds('admin_1', ['n_1'])).resolves.toEqual({
        marked: [],
        unreadCount: 0,
      });
    });

    it('takes an empty list without a write and answers the current count', async () => {
      const { service, prisma } = await buildService();
      prisma.notification.count.mockResolvedValue(2);

      await expect(service.markReadByIds('admin_1', [])).resolves.toEqual({
        marked: [],
        unreadCount: 2,
      });
      expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('markReadAll', () => {
    it('marks every row of the user and returns how many', async () => {
      const { service, prisma } = await buildService();
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });

      await expect(service.markReadAll('admin_1')).resolves.toBe(4);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { receiverId: 'admin_1', read: false },
        data: { read: true },
      });
    });
  });
});
