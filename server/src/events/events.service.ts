import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { CreateSponsorDto } from './dto/create-sponsor.dto.js';
import type { ReplaceEventDto } from './dto/replace-event.dto.js';
import type { UpdateEventDto } from './dto/update-event.dto.js';
import type { UpdateSponsorDto } from './dto/update-sponsor.dto.js';

/** Sponsors always travel with the company that backs them. */
const SPONSORS = {
  sponsors: {
    include: { company: true },
    orderBy: { tier: 'asc' },
  },
} satisfies Prisma.HackathonEventInclude;

/**
 * The console read also carries how many people registered, so a collapsed row
 * can say so before the registrations themselves are fetched.
 */
const ADMIN_INCLUDE = {
  ...SPONSORS,
  _count: { select: { registrations: true } },
} satisfies Prisma.HackathonEventInclude;

/** Statuses a visitor may see. Drafts and cancellations stay internal. */
const PUBLIC_STATUSES = ['PUBLISHED', 'COMPLETED'] as const;

/** An event as the API returns it: always with its sponsors and their companies. */
export type EventWithSponsors = Prisma.HackathonEventGetPayload<{
  include: { sponsors: { include: { company: true } } };
}>;

type AdminEventRow = Prisma.HackathonEventGetPayload<{
  include: typeof ADMIN_INCLUDE;
}>;

/**
 * An event as the console reads it. `_count` is Prisma's shape; the API says
 * `registrationCount`, which is what the client actually needs.
 */
export type AdminEvent = Omit<AdminEventRow, '_count'> & {
  registrationCount: number;
};

function toAdminEvent(row: AdminEventRow): AdminEvent {
  const { _count, ...event } = row;
  return { ...event, registrationCount: _count.registrations };
}

function parseDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid date.`);
  }
  return date;
}

/**
 * The schedule is the only rule that needs more than one field to check, so it
 * lives here rather than in the DTOs: a single field can be valid while the
 * pair is not.
 */
function assertSchedule(
  startsAt: Date,
  endsAt: Date,
  registrationDeadline: Date | null,
): void {
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new BadRequestException('An event has to end after it starts.');
  }
  if (
    registrationDeadline !== null &&
    registrationDeadline.getTime() > startsAt.getTime()
  ) {
    throw new BadRequestException(
      'Registration has to close on or before the event starts.',
    );
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function optionalText(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The public calendar: published and finished events, soonest first. */
  list(): Promise<EventWithSponsors[]> {
    return this.prisma.hackathonEvent.findMany({
      where: { status: { in: [...PUBLIC_STATUSES] } },
      orderBy: { startsAt: 'asc' },
      include: SPONSORS,
    });
  }

  /**
   * The admin view: every event whatever its status, so a draft is visible
   * while it is being prepared. Not paginated yet; hackathon seasons are small.
   */
  async listAll(): Promise<AdminEvent[]> {
    const events = await this.prisma.hackathonEvent.findMany({
      orderBy: { startsAt: 'asc' },
      include: ADMIN_INCLUDE,
    });
    return events.map(toAdminEvent);
  }

  /**
   * The sponsor picker's source. Alphabetical, because an admin looks a
   * company up by name rather than by when it was added.
   */
  listCompanies() {
    return this.prisma.company.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const event = await this.prisma.hackathonEvent.findFirst({
      where: { id, status: { in: [...PUBLIC_STATUSES] } },
      include: SPONSORS,
    });
    if (event === null) {
      throw new NotFoundException('No event with that id.');
    }
    return event;
  }

  /**
   * One event whatever its status. The console reads drafts through here so an
   * organiser can preview the page before it is public; `findOne` is still the
   * only door a visitor has.
   */
  async findOneForAdmin(id: string): Promise<AdminEvent> {
    const event = await this.prisma.hackathonEvent.findUnique({
      where: { id },
      include: ADMIN_INCLUDE,
    });
    if (event === null) {
      throw new NotFoundException('No event with that id.');
    }
    return toAdminEvent(event);
  }

  /**
   * What the public page needs to decide between Register, Registered, and
   * Closed. Opening is judged on the server's clock so every visitor sees the
   * same answer, and a draft is a 404 just like it is everywhere else public.
   */
  async registrationStatus(eventId: string, userId: string) {
    const event = await this.prisma.hackathonEvent.findFirst({
      where: { id: eventId, status: { in: [...PUBLIC_STATUSES] } },
      select: { status: true, startsAt: true, registrationDeadline: true },
    });
    if (event === null) {
      throw new NotFoundException('No event with that id.');
    }

    const registration = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { createdAt: true },
    });

    const now = Date.now();
    const deadlinePassed =
      event.registrationDeadline !== null &&
      event.registrationDeadline.getTime() <= now;
    return {
      registered: registration !== null,
      registeredAt: registration?.createdAt ?? null,
      // The event page promises "open until the event starts" when no deadline
      // is set, so the start is the closing time in that case.
      open:
        event.status === 'PUBLISHED' &&
        !deadlinePassed &&
        event.startsAt.getTime() > now,
    };
  }

  /**
   * A participant takes a place at an event. The unique pair makes a repeated
   * click a conflict rather than a second registration, which is also what
   * protects against two tabs racing.
   */
  async register(eventId: string, userId: string) {
    const event = await this.prisma.hackathonEvent.findUnique({
      where: { id: eventId },
      select: { status: true, startsAt: true, registrationDeadline: true },
    });
    if (event === null) {
      throw new NotFoundException('No event with that id.');
    }
    if (event.status !== 'PUBLISHED') {
      throw new BadRequestException('This event is not open for registration.');
    }

    const now = Date.now();
    const closed =
      event.startsAt.getTime() <= now ||
      (event.registrationDeadline !== null &&
        event.registrationDeadline.getTime() <= now);
    if (closed) {
      throw new BadRequestException('Registration for this event has closed.');
    }

    try {
      return await this.prisma.eventRegistration.create({
        data: { eventId, userId },
        select: { id: true, eventId: true, userId: true, createdAt: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'You are already registered for this event.',
        );
      }
      throw error;
    }
  }

  /**
   * The console's registrations list for one event. The participant's name and
   * email are the point of it; nothing else about the account is exposed.
   */
  async listRegistrations(eventId: string) {
    await this.requireEvent(eventId);
    return this.prisma.eventRegistration.findMany({
      where: { eventId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });
  }

  async create(input: CreateEventDto, createdById: string): Promise<AdminEvent> {
    const schedule = this.parseSchedule(input);

    const event = await this.prisma.hackathonEvent.create({
      data: {
        title: input.title.trim(),
        description: input.description.trim(),
        ...schedule,
        location: optionalText(input.location),
        backgroundUrl: optionalText(input.backgroundUrl),
        imageUrls: input.imageUrls ?? [],
        status: input.status ?? 'DRAFT',
        createdById,
      },
      include: ADMIN_INCLUDE,
    });
    return toAdminEvent(event);
  }

  /**
   * `PUT /admin/events/:id`: the body states the whole event, so every column
   * is written, and an absent optional column is cleared rather than kept.
   * Sponsors are not part of this resource and are untouched.
   */
  async replace(id: string, input: ReplaceEventDto): Promise<AdminEvent> {
    await this.requireEvent(id);
    const schedule = this.parseSchedule(input);

    const event = await this.prisma.hackathonEvent.update({
      where: { id },
      data: {
        title: input.title.trim(),
        description: input.description.trim(),
        ...schedule,
        location: optionalText(input.location ?? undefined),
        backgroundUrl: optionalText(input.backgroundUrl ?? undefined),
        imageUrls: input.imageUrls,
        status: input.status,
      },
      include: ADMIN_INCLUDE,
    });
    return toAdminEvent(event);
  }

  async update(id: string, input: UpdateEventDto): Promise<AdminEvent> {
    const existing = await this.prisma.hackathonEvent.findUnique({
      where: { id },
    });
    if (existing === null) {
      throw new NotFoundException('No event with that id.');
    }

    const startsAt =
      input.startsAt === undefined
        ? existing.startsAt
        : parseDate(input.startsAt, 'startsAt');
    const endsAt =
      input.endsAt === undefined
        ? existing.endsAt
        : parseDate(input.endsAt, 'endsAt');
    const registrationDeadline =
      input.registrationDeadline === undefined
        ? existing.registrationDeadline
        : input.registrationDeadline === null
          ? null // Explicit null clears the deadline; omission keeps it.
          : parseDate(input.registrationDeadline, 'registrationDeadline');
    assertSchedule(startsAt, endsAt, registrationDeadline);

    const event = await this.prisma.hackathonEvent.update({
      where: { id },
      data: {
        title: input.title?.trim(),
        description: input.description?.trim(),
        startsAt,
        endsAt,
        registrationDeadline,
        location:
          input.location === undefined
            ? undefined
            : optionalText(input.location),
        backgroundUrl:
          input.backgroundUrl === undefined
            ? undefined
            : optionalText(input.backgroundUrl ?? undefined),
        imageUrls: input.imageUrls,
        status: input.status,
      },
      include: ADMIN_INCLUDE,
    });
    return toAdminEvent(event);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.hackathonEvent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (existing === null) {
      throw new NotFoundException('No event with that id.');
    }
    // Sponsorships go with the event; the companies themselves stay.
    await this.prisma.hackathonEvent.delete({ where: { id } });
  }

  async addSponsor(eventId: string, input: CreateSponsorDto) {
    await this.requireEvent(eventId);
    const company = await this.findOrCreateCompany(input);

    try {
      return await this.prisma.sponsor.create({
        data: {
          eventId,
          companyId: company.id,
          tier: input.tier ?? 'CO_SPONSOR',
          contribution: optionalText(input.contribution),
        },
        include: { company: true },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `${company.name} already sponsors this event.`,
        );
      }
      throw error;
    }
  }

  async updateSponsor(
    eventId: string,
    sponsorId: string,
    input: UpdateSponsorDto,
  ) {
    await this.requireSponsor(eventId, sponsorId);
    return this.prisma.sponsor.update({
      where: { id: sponsorId },
      data: {
        tier: input.tier,
        contribution:
          input.contribution === undefined
            ? undefined
            : optionalText(input.contribution),
      },
      include: { company: true },
    });
  }

  async removeSponsor(eventId: string, sponsorId: string): Promise<void> {
    await this.requireSponsor(eventId, sponsorId);
    await this.prisma.sponsor.delete({ where: { id: sponsorId } });
  }

  /**
   * Parses the schedule columns and checks them as a set. Creation and
   * replacement both state the whole schedule, so they share this; a partial
   * edit still merges the stored values first and checks the result.
   */
  private parseSchedule(input: {
    startsAt: string;
    endsAt: string;
    registrationDeadline?: string | null;
  }): { startsAt: Date; endsAt: Date; registrationDeadline: Date | null } {
    const startsAt = parseDate(input.startsAt, 'startsAt');
    const endsAt = parseDate(input.endsAt, 'endsAt');
    const registrationDeadline =
      input.registrationDeadline === undefined ||
      input.registrationDeadline === null
        ? null
        : parseDate(input.registrationDeadline, 'registrationDeadline');
    assertSchedule(startsAt, endsAt, registrationDeadline);
    return { startsAt, endsAt, registrationDeadline };
  }

  private async requireEvent(id: string): Promise<void> {
    const event = await this.prisma.hackathonEvent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (event === null) {
      throw new NotFoundException('No event with that id.');
    }
  }

  private async requireSponsor(eventId: string, sponsorId: string): Promise<void> {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: { id: sponsorId, eventId },
      select: { id: true },
    });
    if (sponsor === null) {
      throw new NotFoundException('No sponsor with that id on this event.');
    }
  }

  /**
   * A company is entered once, then reused. Matching is case insensitive so
   * "Acme" and "ACME" do not become two rows.
   */
  private async findOrCreateCompany(input: CreateSponsorDto) {
    const name = input.company.name.trim();
    const existing = await this.prisma.company.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing !== null) {
      return existing;
    }

    try {
      return await this.prisma.company.create({
        data: {
          name,
          website: optionalText(input.company.website),
          logoUrl: optionalText(input.company.logoUrl),
          industry: optionalText(input.company.industry),
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Two admins entered the same company at once; the second one reuses it.
      const raced = await this.prisma.company.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });
      if (raced === null) {
        throw error;
      }
      return raced;
    }
  }
}
