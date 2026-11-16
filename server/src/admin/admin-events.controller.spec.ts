import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../auth/session/jwt-auth.guard.js';
import { SessionService } from '../auth/session/session.service.js';
import { EventsController } from '../events/events.controller.js';
import { EventsService } from '../events/events.service.js';
import { UploadsController } from '../uploads/uploads.controller.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { eventImagesDirectory } from '../uploads/uploads.config.js';
import { AdminEventsController } from './admin-events.controller.js';

const ACCESS_SECRET = 'a'.repeat(64);
const REFRESH_SECRET = 'b'.repeat(64);

const config = {
  getOrThrow: (key: string): string => {
    if (key === 'JWT_ACCESS_SECRET') {
      return ACCESS_SECRET;
    }
    if (key === 'JWT_REFRESH_SECRET') {
      return REFRESH_SECRET;
    }
    throw new Error(`Unexpected key ${key}`);
  },
  get: (): string | undefined => undefined,
};

function userRecord(role: string) {
  return {
    id: 'user_1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    emailVerified: true,
    image: null,
    role,
    banned: false,
    banExpires: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

const EVENT_BODY = {
  title: 'Winter Jam',
  description: 'A weekend of building things.',
  startsAt: '2026-12-01T09:00:00.000Z',
  endsAt: '2026-12-03T18:00:00.000Z',
};

/** PUT states the whole event, so the gaps that PATCH may omit are spelled out. */
const REPLACE_BODY = {
  ...EVENT_BODY,
  registrationDeadline: null,
  location: null,
  imageUrls: [],
  backgroundUrl: null,
  status: 'PUBLISHED',
};

const SPONSOR_BODY = {
  company: { name: 'Acme' },
  tier: 'MAIN',
  contribution: 'Cloud credits',
};

type EventsMock = {
  list: ReturnType<typeof vi.fn>;
  listAll: ReturnType<typeof vi.fn>;
  listCompanies: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  addSponsor: ReturnType<typeof vi.fn>;
  updateSponsor: ReturnType<typeof vi.fn>;
  removeSponsor: ReturnType<typeof vi.fn>;
  listRegistrations: ReturnType<typeof vi.fn>;
  registrationStatus: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
};

describe('AdminEventsController (HTTP)', () => {
  let app: INestApplication;
  let events: EventsMock;
  let sessions: SessionService;
  let prisma: { user: { findUnique: ReturnType<typeof vi.fn> } };

  beforeEach(async () => {
    events = {
      list: vi.fn().mockResolvedValue([]),
      listAll: vi.fn().mockResolvedValue([]),
      listCompanies: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue({ id: 'event_1' }),
      findOneForAdmin: vi.fn().mockResolvedValue({ id: 'event_1', status: 'DRAFT' }),
      create: vi.fn().mockResolvedValue({ id: 'event_1' }),
      update: vi.fn().mockResolvedValue({ id: 'event_1' }),
      replace: vi.fn().mockResolvedValue({ id: 'event_1' }),
      remove: vi.fn().mockResolvedValue(undefined),
      addSponsor: vi.fn().mockResolvedValue({ id: 'sponsor_1' }),
      updateSponsor: vi.fn().mockResolvedValue({ id: 'sponsor_1' }),
      removeSponsor: vi.fn().mockResolvedValue(undefined),
      listRegistrations: vi.fn().mockResolvedValue([]),
      registrationStatus: vi
        .fn()
        .mockResolvedValue({ registered: false, registeredAt: null, open: true }),
      register: vi.fn().mockResolvedValue({ id: 'reg_1' }),
    };
    prisma = { user: { findUnique: vi.fn().mockResolvedValue(userRecord('admin')) } };

    const moduleRef = await Test.createTestingModule({
      // EventsController is here to prove the public calendar stays anonymous.
      controllers: [AdminEventsController, UploadsController, EventsController],
      providers: [
        SessionService,
        UploadsService,
        { provide: EventsService, useValue: events },
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    sessions = moduleRef.get<SessionService>(SessionService);
    app = moduleRef.createNestApplication();
    // main.ts installs this pipe; without it a spec would accept bodies the
    // real server rejects.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function tokenFor(role: 'admin' | 'participant'): Promise<string> {
    const pair = await sessions.issue({ id: 'user_1', role });
    return pair.accessToken;
  }

  describe('authorization', () => {
    it('rejects an anonymous write', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/events')
        .send(EVENT_BODY);

      expect(response.status).toBe(401);
      expect(events.create).not.toHaveBeenCalled();
    });

    it('rejects a signed in participant', async () => {
      prisma.user.findUnique.mockResolvedValue(userRecord('participant'));
      const token = await tokenFor('participant');

      const response = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${token}`)
        .send(EVENT_BODY);

      expect(response.status).toBe(403);
      expect(events.create).not.toHaveBeenCalled();
    });

    it('guards every admin route, not only the ones with an explicit role', async () => {
      const token = await tokenFor('participant');
      prisma.user.findUnique.mockResolvedValue(userRecord('participant'));

      const responses = await Promise.all([
        request(app.getHttpServer())
          .get('/admin/events')
          .set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .get('/admin/companies')
          .set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .get('/admin/events/event_1')
          .set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .patch('/admin/events/event_1')
          .set('Authorization', `Bearer ${token}`)
          .send({ title: 'Renamed' }),
        request(app.getHttpServer())
          .put('/admin/events/event_1')
          .set('Authorization', `Bearer ${token}`)
          .send(REPLACE_BODY),
        request(app.getHttpServer())
          .delete('/admin/events/event_1')
          .set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .post('/admin/events/event_1/sponsors')
          .set('Authorization', `Bearer ${token}`)
          .send(SPONSOR_BODY),
        request(app.getHttpServer())
          .patch('/admin/events/event_1/sponsors/sponsor_1')
          .set('Authorization', `Bearer ${token}`)
          .send({ tier: 'CO_SPONSOR' }),
        request(app.getHttpServer())
          .delete('/admin/events/event_1/sponsors/sponsor_1')
          .set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .get('/admin/events/event_1/registrations')
          .set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .post('/admin/uploads/event-images')
          .set('Authorization', `Bearer ${token}`)
          .attach('images', Buffer.from('not really a png'), 'photo.png'),
        request(app.getHttpServer())
          .post('/admin/uploads/event-background')
          .set('Authorization', `Bearer ${token}`)
          .attach('image', Buffer.from('not really a png'), 'wide.png'),
      ]);

      expect(responses.map((response) => response.status)).toEqual([
        403, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403, 403,
      ]);
    });
  });

  describe('events', () => {
    it('lists every event, drafts included, for an admin', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .get('/admin/events')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(events.listAll).toHaveBeenCalledTimes(1);
    });

    it('reads one event by id for the console, drafts included', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .get('/admin/events/event_1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 'event_1', status: 'DRAFT' });
      expect(events.findOneForAdmin).toHaveBeenCalledWith('event_1');
    });

    it('creates an event and records the admin who created it', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${token}`)
        .send(EVENT_BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 'event_1' });
      expect(events.create).toHaveBeenCalledTimes(1);
      const [body, userId] = events.create.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ];
      expect(userId).toBe('user_1');
      expect(body).toMatchObject(EVENT_BODY);
    });

    it('rejects a body that fails validation', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...EVENT_BODY, title: 'x' });

      expect(response.status).toBe(400);
      expect(events.create).not.toHaveBeenCalled();
    });

    it('rejects a field the DTO does not declare', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...EVENT_BODY, createdById: 'someone_else' });

      expect(response.status).toBe(400);
      expect(events.create).not.toHaveBeenCalled();
    });

    it('updates an event', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .patch('/admin/events/event_1')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Winter Jam 2027' });

      expect(response.status).toBe(200);
      expect(events.update).toHaveBeenCalledWith('event_1', {
        title: 'Winter Jam 2027',
      });
    });

    it('replaces an event through PUT', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .put('/admin/events/event_1')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...REPLACE_BODY, backgroundUrl: '/bucket/event_images/wide.jpg' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 'event_1' });
      expect(events.replace).toHaveBeenCalledWith('event_1', {
        ...REPLACE_BODY,
        backgroundUrl: '/bucket/event_images/wide.jpg',
      });
    });

    it('rejects a PUT that leaves out a column the editor owns', async () => {
      const token = await tokenFor('admin');
      const { backgroundUrl: _omitted, ...incomplete } = REPLACE_BODY;

      const response = await request(app.getHttpServer())
        .put('/admin/events/event_1')
        .set('Authorization', `Bearer ${token}`)
        .send(incomplete);

      expect(response.status).toBe(400);
      expect(events.replace).not.toHaveBeenCalled();
    });

    it('carries the background image URL through creation', async () => {
      const token = await tokenFor('admin');
      const backgroundUrl = '/bucket/event_images/wide.jpg';

      const response = await request(app.getHttpServer())
        .post('/admin/events')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...EVENT_BODY, backgroundUrl });

      expect(response.status).toBe(201);
      const [body] = events.create.mock.calls[0] as [Record<string, unknown>];
      expect(body.backgroundUrl).toBe(backgroundUrl);
    });

    it('deletes an event with no body', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .delete('/admin/events/event_1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
      expect(events.remove).toHaveBeenCalledWith('event_1');
    });

    it('lists the registrations for one event', async () => {
      const token = await tokenFor('admin');
      const registrations = [
        {
          id: 'reg_1',
          createdAt: '2026-11-16T10:00:00.000Z',
          user: { id: 'user_2', name: 'Ada', email: 'ada@example.com', image: null },
        },
      ];
      events.listRegistrations.mockResolvedValue(registrations);

      const response = await request(app.getHttpServer())
        .get('/admin/events/event_1/registrations')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(registrations);
      expect(events.listRegistrations).toHaveBeenCalledWith('event_1');
    });
  });

  describe('companies', () => {
    it('lists companies for the sponsor picker', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .get('/admin/companies')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
      expect(events.listCompanies).toHaveBeenCalledTimes(1);
    });
  });

  describe('sponsors', () => {
    it('attaches a company as a sponsor', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .post('/admin/events/event_1/sponsors')
        .set('Authorization', `Bearer ${token}`)
        .send(SPONSOR_BODY);

      expect(response.status).toBe(201);
      expect(events.addSponsor).toHaveBeenCalledTimes(1);
      const [eventId, body] = events.addSponsor.mock.calls[0] as [
        string,
        { company: { name: string }; tier: string; contribution: string },
      ];
      expect(eventId).toBe('event_1');
      expect(body.company.name).toBe('Acme');
      expect(body.tier).toBe('MAIN');
      expect(body.contribution).toBe('Cloud credits');
    });

    it('moves a sponsor between tiers', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .patch('/admin/events/event_1/sponsors/sponsor_1')
        .set('Authorization', `Bearer ${token}`)
        .send({ tier: 'CO_SPONSOR' });

      expect(response.status).toBe(200);
      expect(events.updateSponsor).toHaveBeenCalledWith('event_1', 'sponsor_1', {
        tier: 'CO_SPONSOR',
      });
    });

    it('removes a sponsorship', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .delete('/admin/events/event_1/sponsors/sponsor_1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
      expect(events.removeSponsor).toHaveBeenCalledWith('event_1', 'sponsor_1');
    });
  });

  describe('uploads', () => {
    const imagesDir = eventImagesDirectory();
    let before: string[] = [];

    beforeEach(async () => {
      await mkdir(imagesDir, { recursive: true });
      before = await readdir(imagesDir);
    });

    afterEach(async () => {
      // The spec writes into the real bucket, so take back only what it made.
      const created = (await readdir(imagesDir)).filter(
        (name) => !before.includes(name),
      );
      await Promise.all(created.map((name) => rm(join(imagesDir, name))));
    });

    it('writes each image into the bucket and answers with stored URLs', async () => {
      const token = await tokenFor('admin');
      const bytes = Buffer.from('89504e470d0a1a0a', 'hex');

      const response = await request(app.getHttpServer())
        .post('/admin/uploads/event-images')
        .set('Authorization', `Bearer ${token}`)
        .attach('images', bytes, 'photo.png')
        .attach('images', bytes, 'banner.jpg');

      expect(response.status).toBe(201);
      const { urls } = response.body as { urls: string[] };
      expect(urls).toHaveLength(2);
      expect(urls[0]).toMatch(/^\/bucket\/event_images\/\d+-[0-9a-f-]+\.png$/);
      expect(urls[1]).toMatch(/^\/bucket\/event_images\/\d+-[0-9a-f-]+\.jpg$/);

      const stored = await readFile(join(imagesDir, basename(urls[0])));
      expect(stored.equals(bytes)).toBe(true);
    });

    it('rejects an SVG rather than storing a script container', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .post('/admin/uploads/event-images')
        .set('Authorization', `Bearer ${token}`)
        .attach('images', Buffer.from('<svg onload="alert(1)"/>'), 'art.svg');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Unsupported image type');
    });

    it('stores nothing when the type is rejected', async () => {
      const token = await tokenFor('admin');

      await request(app.getHttpServer())
        .post('/admin/uploads/event-images')
        .set('Authorization', `Bearer ${token}`)
        .attach('images', Buffer.from('plain text'), 'notes.txt');

      expect(await readdir(imagesDir)).toEqual(before);
    });

    it('rejects a request with no file attached', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .post('/admin/uploads/event-images')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Attach at least one image.');
    });

    it('stores one background image and answers its URL', async () => {
      const token = await tokenFor('admin');
      const bytes = Buffer.from('ffd8ffe000104a464946', 'hex');

      const response = await request(app.getHttpServer())
        .post('/admin/uploads/event-background')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', bytes, 'wide.jpg');

      expect(response.status).toBe(201);
      const { url } = response.body as { url: string };
      expect(url).toMatch(/^\/bucket\/event_images\/\d+-[0-9a-f-]+\.jpg$/);

      const stored = await readFile(join(imagesDir, basename(url)));
      expect(stored.equals(bytes)).toBe(true);
    });

    it('rejects a background upload with no file', async () => {
      const token = await tokenFor('admin');

      const response = await request(app.getHttpServer())
        .post('/admin/uploads/event-background')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Attach an image.');
    });
  });

  describe('GET /events', () => {
    it('lists events for a visitor with no token', async () => {
      const response = await request(app.getHttpServer()).get('/events');

      expect(response.status).toBe(200);
      expect(events.list).toHaveBeenCalledTimes(1);
    });

    it('returns one event by id', async () => {
      const response = await request(app.getHttpServer()).get('/events/event_1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 'event_1' });
    });
  });

  describe('registrations', () => {
    it('answers registration status for the signed in participant', async () => {
      prisma.user.findUnique.mockResolvedValue(userRecord('participant'));
      const token = await tokenFor('participant');

      const response = await request(app.getHttpServer())
        .get('/events/event_1/registration')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        registered: false,
        registeredAt: null,
        open: true,
      });
      expect(events.registrationStatus).toHaveBeenCalledWith(
        'event_1',
        'user_1',
      );
    });

    it('registers the signed in participant', async () => {
      prisma.user.findUnique.mockResolvedValue(userRecord('participant'));
      const token = await tokenFor('participant');

      const response = await request(app.getHttpServer())
        .post('/events/event_1/registrations')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ id: 'reg_1' });
      expect(events.register).toHaveBeenCalledWith('event_1', 'user_1');
    });

    it('rejects an anonymous read of registration status', async () => {
      const response = await request(app.getHttpServer()).get(
        '/events/event_1/registration',
      );

      expect(response.status).toBe(401);
      expect(events.registrationStatus).not.toHaveBeenCalled();
    });

    it('rejects an anonymous registration', async () => {
      const response = await request(app.getHttpServer()).post(
        '/events/event_1/registrations',
      );

      expect(response.status).toBe(401);
      expect(events.register).not.toHaveBeenCalled();
    });
  });
});
