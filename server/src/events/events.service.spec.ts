import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { CreateSponsorDto } from './dto/create-sponsor.dto.js';
import type { ReplaceEventDto } from './dto/replace-event.dto.js';
import { EventsService } from './events.service.js';

const STARTS_AT = '2026-12-01T09:00:00.000Z';
const ENDS_AT = '2026-12-03T18:00:00.000Z';

function eventInput(overrides: Partial<CreateEventDto> = {}): CreateEventDto {
  return {
    title: '  Winter Jam  ',
    description: '  A weekend of building things.  ',
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    ...overrides,
  };
}

function sponsorInput(
  overrides: Partial<CreateSponsorDto> = {},
): CreateSponsorDto {
  return {
    company: { name: 'Acme' },
    ...overrides,
  };
}

/** A complete body, because PUT states the whole event. */
function replaceInput(
  overrides: Partial<ReplaceEventDto> = {},
): ReplaceEventDto {
  return {
    title: '  Winter Jam  ',
    description: '  A weekend of building things.  ',
    startsAt: STARTS_AT,
    endsAt: ENDS_AT,
    registrationDeadline: null,
    location: null,
    imageUrls: [],
    backgroundUrl: null,
    status: 'PUBLISHED',
    ...overrides,
  };
}

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.10.1',
  });
}

type PrismaMock = {
  hackathonEvent: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  company: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  sponsor: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  eventRegistration: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('EventsService', () => {
  let service: EventsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      hackathonEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      company: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      sponsor: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      eventRegistration: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('list', () => {
    it('asks only for events a visitor may see, soonest first', async () => {
      prisma.hackathonEvent.findMany.mockResolvedValue([]);

      await service.list();

      expect(prisma.hackathonEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['PUBLISHED', 'COMPLETED'] } },
          orderBy: { startsAt: 'asc' },
        }),
      );
    });
  });

  describe('listAll', () => {
    it('returns every status so drafts are visible in the console', async () => {
      prisma.hackathonEvent.findMany.mockResolvedValue([]);

      await service.listAll();

      expect(prisma.hackathonEvent.findMany).toHaveBeenCalledWith({
        orderBy: { startsAt: 'asc' },
        include: expect.objectContaining({ sponsors: expect.anything() }),
      });
    });
  });

  describe('listCompanies', () => {
    it('returns companies alphabetically for the sponsor picker', async () => {
      prisma.company.findMany.mockResolvedValue([]);

      await service.listCompanies();

      expect(prisma.company.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findOneForAdmin', () => {
    it('reads a draft by id, sponsors included', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue({
        id: 'event_1',
        status: 'DRAFT',
        _count: { registrations: 0 },
      });

      await expect(service.findOneForAdmin('event_1')).resolves.toMatchObject({
        status: 'DRAFT',
      });
      expect(prisma.hackathonEvent.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event_1' },
          include: expect.objectContaining({ sponsors: expect.anything() }),
        }),
      );
    });

    it('raises 404 for an id that does not exist', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(null);

      await expect(service.findOneForAdmin('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('registrationStatus', () => {
    it('reports an unregistered visitor and an open event', async () => {
      prisma.hackathonEvent.findFirst.mockResolvedValue({
        status: 'PUBLISHED',
        startsAt: new Date(STARTS_AT),
        registrationDeadline: null,
      });
      prisma.eventRegistration.findUnique.mockResolvedValue(null);

      await expect(
        service.registrationStatus('event_1', 'user_1'),
      ).resolves.toEqual({
        registered: false,
        registeredAt: null,
        open: true,
      });
    });

    it('reports a held place with when it was taken', async () => {
      const registeredAt = new Date('2026-11-10T12:00:00.000Z');
      prisma.hackathonEvent.findFirst.mockResolvedValue({
        status: 'PUBLISHED',
        startsAt: new Date(STARTS_AT),
        registrationDeadline: null,
      });
      prisma.eventRegistration.findUnique.mockResolvedValue({ createdAt: registeredAt });

      await expect(
        service.registrationStatus('event_1', 'user_1'),
      ).resolves.toEqual({
        registered: true,
        registeredAt,
        open: true,
      });
      expect(prisma.eventRegistration.findUnique).toHaveBeenCalledWith({
        where: { eventId_userId: { eventId: 'event_1', userId: 'user_1' } },
        select: { createdAt: true },
      });
    });

    it('closes registration once the deadline has passed', async () => {
      prisma.hackathonEvent.findFirst.mockResolvedValue({
        status: 'PUBLISHED',
        startsAt: new Date(STARTS_AT),
        registrationDeadline: new Date('2020-01-01T00:00:00.000Z'),
      });
      prisma.eventRegistration.findUnique.mockResolvedValue(null);

      await expect(
        service.registrationStatus('event_1', 'user_1'),
      ).resolves.toMatchObject({ open: false });
    });

    it('closes registration once the event has started', async () => {
      prisma.hackathonEvent.findFirst.mockResolvedValue({
        status: 'PUBLISHED',
        startsAt: new Date('2020-01-01T00:00:00.000Z'),
        registrationDeadline: null,
      });
      prisma.eventRegistration.findUnique.mockResolvedValue(null);

      await expect(
        service.registrationStatus('event_1', 'user_1'),
      ).resolves.toMatchObject({ open: false });
    });

    it('raises 404 for an event a visitor cannot see', async () => {
      prisma.hackathonEvent.findFirst.mockResolvedValue(null);

      await expect(
        service.registrationStatus('event_1', 'user_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('register', () => {
    const OPEN_EVENT = {
      status: 'PUBLISHED',
      startsAt: new Date(STARTS_AT),
      registrationDeadline: null,
    };

    it('takes a place and answers the new registration', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(OPEN_EVENT);
      const row = {
        id: 'reg_1',
        eventId: 'event_1',
        userId: 'user_1',
        createdAt: new Date('2026-11-16T10:00:00.000Z'),
      };
      prisma.eventRegistration.create.mockResolvedValue(row);

      await expect(service.register('event_1', 'user_1')).resolves.toBe(row);
      expect(prisma.eventRegistration.create).toHaveBeenCalledWith({
        data: { eventId: 'event_1', userId: 'user_1' },
        select: {
          id: true,
          eventId: true,
          userId: true,
          createdAt: true,
        },
      });
    });

    it('refuses an event that is not published', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue({
        ...OPEN_EVENT,
        status: 'DRAFT',
      });

      await expect(
        service.register('event_1', 'user_1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    });

    it('refuses once registration has closed', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue({
        ...OPEN_EVENT,
        registrationDeadline: new Date('2020-01-01T00:00:00.000Z'),
      });

      await expect(
        service.register('event_1', 'user_1'),
      ).rejects.toThrow('Registration for this event has closed.');
      expect(prisma.eventRegistration.create).not.toHaveBeenCalled();
    });

    it('answers 409 when the place is already taken by this account', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(OPEN_EVENT);
      prisma.eventRegistration.create.mockRejectedValue(uniqueViolation());

      await expect(
        service.register('event_1', 'user_1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('raises 404 for an unknown event', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.register('missing', 'user_1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listRegistrations', () => {
    it('lists the event’s registrations newest first with the participant', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue({ id: 'event_1' });
      prisma.eventRegistration.findMany.mockResolvedValue([]);

      await service.listRegistrations('event_1');

      expect(prisma.eventRegistration.findMany).toHaveBeenCalledWith({
        where: { eventId: 'event_1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      });
    });

    it('raises 404 for an unknown event', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.listRegistrations('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('stores trimmed text, no deadline, and the admin who created it', async () => {
      prisma.hackathonEvent.create.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });

      await service.create(eventInput(), 'user_1');

      expect(prisma.hackathonEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Winter Jam',
            description: 'A weekend of building things.',
            startsAt: new Date(STARTS_AT),
            endsAt: new Date(ENDS_AT),
            registrationDeadline: null,
            location: null,
            imageUrls: [],
            status: 'DRAFT',
            createdById: 'user_1',
          }),
        }),
      );
    });

    it('stores the uploaded image URLs in the order they were attached', async () => {
      prisma.hackathonEvent.create.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });
      const imageUrls = [
        '/bucket/event_images/one.png',
        '/bucket/event_images/two.jpg',
      ];

      await service.create(eventInput({ imageUrls }), 'user_1');

      expect(prisma.hackathonEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrls }),
        }),
      );
    });

    it('stores a trimmed background image URL, or null for none', async () => {
      prisma.hackathonEvent.create.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });

      await service.create(
        eventInput({ backgroundUrl: '  /bucket/event_images/wide.jpg  ' }),
        'user_1',
      );
      expect(prisma.hackathonEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            backgroundUrl: '/bucket/event_images/wide.jpg',
          }),
        }),
      );

      prisma.hackathonEvent.create.mockClear();
      await service.create(eventInput({ backgroundUrl: '   ' }), 'user_1');
      expect(prisma.hackathonEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ backgroundUrl: null }),
        }),
      );
    });

    it('refuses an event that ends before it starts', async () => {
      await expect(
        service.create(eventInput({ endsAt: '2026-11-30T09:00:00.000Z' }), 'user_1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.hackathonEvent.create).not.toHaveBeenCalled();
    });

    it('treats an equal start and end as a bad schedule', async () => {
      await expect(
        service.create(eventInput({ endsAt: STARTS_AT }), 'user_1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses registration that closes after the event starts', async () => {
      await expect(
        service.create(
          eventInput({ registrationDeadline: ENDS_AT }),
          'user_1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.hackathonEvent.findUnique.mockResolvedValue({
        id: 'event_1',
        startsAt: new Date(STARTS_AT),
        endsAt: new Date(ENDS_AT),
        registrationDeadline: new Date('2026-11-20T00:00:00.000Z'),
      });
      prisma.hackathonEvent.update.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });
    });

    it('keeps the stored schedule when only the title changes', async () => {
      await service.update('event_1', { title: 'Winter Jam 2027' });

      expect(prisma.hackathonEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event_1' },
          data: expect.objectContaining({
            startsAt: new Date(STARTS_AT),
            endsAt: new Date(ENDS_AT),
            registrationDeadline: new Date('2026-11-20T00:00:00.000Z'),
          }),
        }),
      );
    });

    it('rejects a new end date that lands before the stored start', async () => {
      await expect(
        service.update('event_1', { endsAt: '2026-11-01T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.hackathonEvent.update).not.toHaveBeenCalled();
    });

    it('leaves the images alone when the body does not mention them', async () => {
      await service.update('event_1', { title: 'Winter Jam 2027' });

      const [call] = prisma.hackathonEvent.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(call.data.imageUrls).toBeUndefined();
    });

    it('replaces the whole image list when one is sent', async () => {
      const imageUrls = ['/bucket/event_images/three.webp'];

      await service.update('event_1', { imageUrls });

      expect(prisma.hackathonEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrls }),
        }),
      );
    });

    it('clears the registration deadline when null is sent', async () => {
      await service.update('event_1', { registrationDeadline: null });

      expect(prisma.hackathonEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ registrationDeadline: null }),
        }),
      );
    });

    it('leaves the background alone when the body does not mention it', async () => {
      await service.update('event_1', { title: 'Winter Jam 2027' });

      const [call] = prisma.hackathonEvent.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(call.data.backgroundUrl).toBeUndefined();
    });

    it('sets and clears the background image URL', async () => {
      const backgroundUrl = '/bucket/event_images/wide.jpg';

      await service.update('event_1', { backgroundUrl });
      expect(prisma.hackathonEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ backgroundUrl }),
        }),
      );

      prisma.hackathonEvent.update.mockClear();
      await service.update('event_1', { backgroundUrl: null });
      expect(prisma.hackathonEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ backgroundUrl: null }),
        }),
      );
    });

    it('reports an unknown event instead of updating it', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.update('event_missing', { title: 'Nothing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('replace', () => {
    beforeEach(() => {
      prisma.hackathonEvent.findUnique.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });
      prisma.hackathonEvent.update.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });
    });

    it('writes every column, trimming the text', async () => {
      const imageUrls = ['/bucket/event_images/one.png'];
      const backgroundUrl = '/bucket/event_images/wide.jpg';

      await service.replace(
        'event_1',
        replaceInput({ imageUrls, backgroundUrl, location: '  Hall 4  ' }),
      );

      expect(prisma.hackathonEvent.update).toHaveBeenCalledWith({
        where: { id: 'event_1' },
        data: {
          title: 'Winter Jam',
          description: 'A weekend of building things.',
          startsAt: new Date(STARTS_AT),
          endsAt: new Date(ENDS_AT),
          registrationDeadline: null,
          location: 'Hall 4',
          backgroundUrl,
          imageUrls,
          status: 'PUBLISHED',
        },
        include: expect.anything(),
      });
    });

    it('clears an optional column that is sent as null', async () => {
      await service.replace(
        'event_1',
        replaceInput({ backgroundUrl: null, location: null }),
      );

      const [call] = prisma.hackathonEvent.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(call.data.backgroundUrl).toBeNull();
      expect(call.data.location).toBeNull();
    });

    it('checks the schedule before writing anything', async () => {
      await expect(
        service.replace('event_1', replaceInput({ endsAt: STARTS_AT })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.hackathonEvent.update).not.toHaveBeenCalled();
    });

    it('reports an unknown event', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.replace('event_missing', replaceInput()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.hackathonEvent.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the event and lets its sponsorships cascade', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });
      prisma.hackathonEvent.delete.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });

      await service.remove('event_1');

      expect(prisma.hackathonEvent.delete).toHaveBeenCalledWith({
        where: { id: 'event_1' },
      });
    });

    it('reports an unknown event', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(null);

      await expect(service.remove('event_missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('addSponsor', () => {
    beforeEach(() => {
      prisma.hackathonEvent.findUnique.mockResolvedValue({ id: 'event_1', _count: { registrations: 0 } });
    });

    it('reuses a company already on file whatever its casing', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: 'company_1',
        name: 'Acme',
      });
      prisma.sponsor.create.mockResolvedValue({ id: 'sponsor_1' });

      await service.addSponsor('event_1', sponsorInput({ company: { name: 'acme' } }));

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { name: { equals: 'acme', mode: 'insensitive' } },
      });
      expect(prisma.company.create).not.toHaveBeenCalled();
      expect(prisma.sponsor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventId: 'event_1',
            companyId: 'company_1',
            tier: 'CO_SPONSOR',
            contribution: null,
          }),
        }),
      );
    });

    it('creates the company the first time it sponsors anything', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      prisma.company.create.mockResolvedValue({ id: 'company_2', name: 'Globex' });
      prisma.sponsor.create.mockResolvedValue({ id: 'sponsor_2' });

      await service.addSponsor(
        'event_1',
        sponsorInput({
          company: { name: ' Globex ', website: 'https://globex.example' },
          tier: 'MAIN',
        }),
      );

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: {
          name: 'Globex',
          website: 'https://globex.example',
          logoUrl: null,
          industry: null,
        },
      });
      expect(prisma.sponsor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'company_2', tier: 'MAIN' }),
        }),
      );
    });

    it('refuses a second sponsorship of the same event by one company', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company_1', name: 'Acme' });
      prisma.sponsor.create.mockRejectedValue(uniqueViolation());

      await expect(
        service.addSponsor('event_1', sponsorInput()),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('reports an unknown event before touching any company', async () => {
      prisma.hackathonEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.addSponsor('event_missing', sponsorInput()),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.company.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('removeSponsor', () => {
    it('reports a sponsor that is not on this event', async () => {
      prisma.sponsor.findFirst.mockResolvedValue(null);

      await expect(
        service.removeSponsor('event_1', 'sponsor_missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.sponsor.delete).not.toHaveBeenCalled();
    });

    it('deletes the sponsorship', async () => {
      prisma.sponsor.findFirst.mockResolvedValue({ id: 'sponsor_1' });
      prisma.sponsor.delete.mockResolvedValue({ id: 'sponsor_1' });

      await service.removeSponsor('event_1', 'sponsor_1');

      expect(prisma.sponsor.delete).toHaveBeenCalledWith({
        where: { id: 'sponsor_1' },
      });
    });
  });
});
