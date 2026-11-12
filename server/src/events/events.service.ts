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
import type { UpdateEventDto } from './dto/update-event.dto.js';
import type { UpdateSponsorDto } from './dto/update-sponsor.dto.js';

/** Sponsors always travel with the company that backs them. */
const SPONSORS = {
  sponsors: {
    include: { company: true },
    orderBy: { tier: 'asc' },
  },
} satisfies Prisma.HackathonEventInclude;

/** Statuses a visitor may see. Drafts and cancellations stay internal. */
const PUBLIC_STATUSES = ['PUBLISHED', 'COMPLETED'] as const;

/** An event as the API returns it: always with its sponsors and their companies. */
export type EventWithSponsors = Prisma.HackathonEventGetPayload<{
  include: { sponsors: { include: { company: true } } };
}>;

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
  listAll(): Promise<EventWithSponsors[]> {
    return this.prisma.hackathonEvent.findMany({
      orderBy: { startsAt: 'asc' },
      include: SPONSORS,
    });
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

  async create(input: CreateEventDto, createdById: string) {
    const startsAt = parseDate(input.startsAt, 'startsAt');
    const endsAt = parseDate(input.endsAt, 'endsAt');
    const registrationDeadline =
      input.registrationDeadline === undefined
        ? null
        : parseDate(input.registrationDeadline, 'registrationDeadline');
    assertSchedule(startsAt, endsAt, registrationDeadline);

    return this.prisma.hackathonEvent.create({
      data: {
        title: input.title.trim(),
        description: input.description.trim(),
        startsAt,
        endsAt,
        registrationDeadline,
        location: optionalText(input.location),
        imageUrls: input.imageUrls ?? [],
        status: input.status ?? 'DRAFT',
        createdById,
      },
      include: SPONSORS,
    });
  }

  async update(id: string, input: UpdateEventDto) {
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
        : parseDate(input.registrationDeadline, 'registrationDeadline');
    assertSchedule(startsAt, endsAt, registrationDeadline);

    return this.prisma.hackathonEvent.update({
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
        imageUrls: input.imageUrls,
        status: input.status,
      },
      include: SPONSORS,
    });
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
