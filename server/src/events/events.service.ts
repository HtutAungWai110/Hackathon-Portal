import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { PublicUser } from '../auth/session/public-user.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type { CreateRegistrationDto } from './dto/create-registration.dto.js';
import type { CreateSponsorDto } from './dto/create-sponsor.dto.js';
import type { ListRegistrationsQueryDto } from './dto/list-registrations-query.dto.js';
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
 * The console read also carries how many people applied, so a collapsed row
 * can say so before the applications themselves are fetched.
 */
const ADMIN_INCLUDE = {
  ...SPONSORS,
  _count: { select: { applications: true } },
} satisfies Prisma.HackathonEventInclude;

/**
 * One console page of applications. `applicationDate` and then `id` make the
 * order total, so a page boundary never repeats or skips a row.
 */
const APPLICATION_ORDER = [
  { applicationDate: 'desc' },
  { id: 'asc' },
] satisfies Prisma.ApplicationsOrderByWithRelationInput[];

const APPLICATION_SELECT = {
  id: true,
  additionalMessage: true,
  companyName: true,
  companyEmail: true,
  status: true,
  reasonForRejection: true,
  applicationDate: true,
  user: {
    select: { id: true, name: true, email: true, image: true },
  },
} satisfies Prisma.ApplicationsSelect;

export type ConsoleApplication = Prisma.ApplicationsGetPayload<{
  select: typeof APPLICATION_SELECT;
}>;

/** One page of an event's applications, with enough to render a pager. */
export type PaginatedApplications = {
  items: ConsoleApplication[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Echoed back when the caller asked for a specific row's page. */
  registrationId: string | null;
};

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
  return { ...event, registrationCount: _count.applications };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

    const application = await this.prisma.applications.findUnique({
      where: { eventId_applier: { eventId, applier: userId } },
      select: { applicationDate: true },
    });

    const now = Date.now();
    const deadlinePassed =
      event.registrationDeadline !== null &&
      event.registrationDeadline.getTime() <= now;
    return {
      registered: application !== null,
      registeredAt: application?.applicationDate ?? null,
      // The event page promises "open until the event starts" when no deadline
      // is set, so the start is the closing time in that case.
      open:
        event.status === 'PUBLISHED' &&
        !deadlinePassed &&
        event.startsAt.getTime() > now,
    };
  }

  /** The current user's full application for this event, or null if none. */
  async getMyApplication(eventId: string, userId: string) {
    const event = await this.prisma.hackathonEvent.findFirst({
      where: { id: eventId, status: { in: [...PUBLIC_STATUSES] } },
      select: { id: true },
    });
    if (event === null) {
      throw new NotFoundException('No event with that id.');
    }
    return this.prisma.applications.findUnique({
      where: { eventId_applier: { eventId, applier: userId } },
      select: {
        id: true,
        additionalMessage: true,
        companyName: true,
        companyEmail: true,
        status: true,
        reasonForRejection: true,
        applicationDate: true,
      },
    });
  }

  /**
   * A participant applies for a place at an event. The unique pair makes a
   * repeated submission a conflict rather than a second application, which is
   * also what protects against two tabs racing.
   */
  async register(
    eventId: string,
    user: PublicUser,
    input: CreateRegistrationDto,
  ) {
    const event = await this.prisma.hackathonEvent.findUnique({
      where: { id: eventId },
      select: { status: true, startsAt: true, registrationDeadline: true, title: true },
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

    const additionalMessage = input.additionalMessage.trim();
    if (additionalMessage.length === 0) {
      throw new BadRequestException(
        'Tell the organiser why you are a capable member for the team.',
      );
    }

    try {
      const created = await this.prisma.applications.create({
        data: {
          eventId,
          applier: user.id,
          additionalMessage,
          companyName: optionalText(input.companyName),
          companyEmail: optionalText(input.companyEmail),
        },
        select: {
          id: true,
          eventId: true,
          applier: true,
          additionalMessage: true,
          companyName: true,
          companyEmail: true,
          status: true,
          applicationDate: true,
        },
      });

      // A queued notice is a best-effort side of the API: the application
      // stands on its own, so a Redis hiccup logs instead of turning a
      // successful registration into a failure.
      try {
        await this.announceRegistration(
          user,
          { id: eventId, title: event.title },
          created.id,
        );
      } catch (error) {
        this.logger.error(
          `Could not queue registrations notification for ${eventId}: ${describeError(error)}`,
        );
      }
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'You have already applied for this event.',
        );
      }
      throw error;
    }
  }

  /**
   * The application created its row; tell every admin who can review it so
   * the inbox fills from the portal, not from someone's inbox.
   */
  private async announceRegistration(
    user: Pick<PublicUser, 'id' | 'name'>,
    event: { id: string; title: string },
    applicationId: string,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin' },
      select: { id: true },
    });
    if (admins.length === 0) {
      return;
    }
    await this.notifications.notify(
      admins.map((admin) => ({
        senderId: user.id,
        receiverId: admin.id,
        message: `${user.name} applied to ${event.title}`,
        data: {
          kind: 'event.registration',
          eventId: event.id,
          applicationId,
          // The deep link into the console: same shape as the public edit
          // link — `?id=` for the event, and `registrationId` for the row,
          // so the admin lands on the page holding this application.
          link: `/admin/dashboard/hackathon/registrations?id=${encodeURIComponent(event.id)}&registrationId=${applicationId}`,
        },
      })),
    );
  }

  /**
   * One page of the console's applications list for an event. The message is
   * the point of it: it is where the participant argues they belong on a team.
   *
   * With `registrationId` the caller is returning to a row it already knows.
   * The service finds that row's position in the same order the pages use and
   * answers the page holding it, so the caller does not have to guess.
   */
  async listRegistrations(
    eventId: string,
    query: ListRegistrationsQueryDto = {},
  ): Promise<PaginatedApplications> {
    await this.requireEvent(eventId);

    const limit = query.limit ?? 10;
    const registrationId = query.registrationId?.trim() || null;
    const total = await this.prisma.applications.count({ where: { eventId } });
    // An event with no applications still has page one; there is nowhere else
    // to land, and the client should not have to special case zero.
    const totalPages = Math.max(1, Math.ceil(total / limit));

    let page: number;
    if (registrationId !== null) {
      const target = await this.prisma.applications.findFirst({
        where: { id: registrationId, eventId },
        select: { applicationDate: true, id: true },
      });
      if (target === null) {
        throw new NotFoundException(
          'No application with that id on this event.',
        );
      }
      // How many rows sort before the target: that many rows then divide into
      // pages tells us which page holds it.
      const before = await this.prisma.applications.count({
        where: {
          eventId,
          OR: [
            { applicationDate: { gt: target.applicationDate } },
            { applicationDate: target.applicationDate, id: { lt: target.id } },
          ],
        },
      });
      page = Math.floor(before / limit) + 1;
    } else {
      // A row can disappear between reads; land on the last page rather than
      // answer an empty page past the end.
      page = Math.min(query.page ?? 1, totalPages);
    }

    const items = await this.prisma.applications.findMany({
      where: { eventId },
      orderBy: APPLICATION_ORDER,
      skip: (page - 1) * limit,
      take: limit,
      select: APPLICATION_SELECT,
    });

    return {
      items,
      page,
      limit,
      total,
      totalPages,
      registrationId,
    };
  }

  /**
   * The one decision route behind both buttons. Accepting and rejecting are
   * the same write: the status changes, a rejection may carry the admin's
   * optional reason, and the applicant is told which way it went. The row is
   * never deleted, so the application page can always read it back.
   */
  async decideRegistration(
    eventId: string,
    registrationId: string,
    decision: { action: 'accept' | 'reject'; reason?: string },
  ): Promise<ConsoleApplication> {
    await this.requireEvent(eventId);
    const application = await this.prisma.applications.findFirst({
      where: { id: registrationId, eventId },
      select: { ...APPLICATION_SELECT, applier: true },
    });
    if (application === null) {
      throw new NotFoundException('No application with that id on this event.');
    }

    const accepted = decision.action === 'accept';
    const reason = decision.reason?.trim() ?? '';
    const rejectionReason =
      !accepted && reason.length > 0 ? reason : null;

    const updated = await this.prisma.applications.update({
      where: { id: registrationId },
      data: {
        status: accepted ? 'ACCEPTED' : 'REJECTED',
        reasonForRejection: rejectionReason,
      },
      select: APPLICATION_SELECT,
    });

    try {
      await this.notifications.notify([
        {
          senderId: null,
          receiverId: application.applier,
          message: accepted
            ? 'Your application was accepted.'
            : 'Your application was rejected.',
          data: {
            kind: accepted
              ? 'event.applicationAccepted'
              : 'event.applicationRejected',
            eventId,
            applicationId: registrationId,
            ...(accepted ? {} : { reason: rejectionReason }),
            link: `/hackathon/your-application?id=${encodeURIComponent(eventId)}`,
          },
        },
      ]);
    } catch (error) {
      this.logger.error(
        `Could not notify applicant of the decision: ${describeError(error)}`,
      );
    }
    return updated;
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
