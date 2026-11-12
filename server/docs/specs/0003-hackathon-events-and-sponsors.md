# 0003. Host hackathon events backed by company sponsors

**Date**: 2026-11-12
**Status**: In Progress

## Summary

The portal becomes a place that hosts hackathons, not only one that takes applications. Admins
create `HackathonEvent` rows and attach sponsors to them. A sponsor is a `Company` plus the
`Sponsor` row that says which event it backs and at what tier (main sponsor or co-sponsor). The
public calendar reads events without a token; writing the catalogue stays behind
`@Roles(['admin'])`. The existing `Applications` table is untouched.

## Context

The product brief is an online hackathon hosting site with two roles, `participant` and
`admin`. The database already had `User`, `Session`, `Account`, and `Applications`, but no
concept of an event and no way to record who pays for one. Sponsorship matters because a
company usually backs several events, and the same company can be a main sponsor at one and a
co-sponsor at another.

The admin role already existed in the schema and the JWT guard already enforced `@Roles`, but
the only admin route was `/admin/ping`. The seed script promotes whoever `ADMIN_EMAIL` names,
and it was run with `lmaohtutaungwai@gmail.com`.

## Requirements

**User stories**:
- As an admin, I want to create and edit hackathon events so that the site has something to
  show.
- As an admin, I want to attach a company as a main sponsor or a co-sponsor, without first
  creating the company in a separate screen.
- As an admin, I want a company that already sponsored something to be reused rather than
  duplicated.
- As a visitor, I want to browse published events without an account.
- As a participant, I want the admin routes to refuse me even if I know their paths.

**Acceptance criteria**:
- **AC-1**: The schema has `HackathonEvent`, `Company`, and `Sponsor`, plus `EventStatus`
  (`DRAFT`, `PUBLISHED`, `COMPLETED`, `CANCELLED`) and `SponsorTier` (`MAIN`, `CO_SPONSOR`).
  A company appears at most once per event.
- **AC-2**: An admin can create, update, and delete an event. The event records the admin who
  created it, and deleting that account keeps the event.
- **AC-3**: An admin can attach a sponsor by sending the company inline. An existing company is
  matched case insensitively and reused; a second sponsorship of the same event returns `409`.
- **AC-4**: An admin can move a sponsor between tiers, correct its contribution, and remove the
  sponsorship. Deleting an event deletes its sponsorships but not the companies.
- **AC-5**: `GET /events` and `GET /events/:id` answer without a token and expose only
  `PUBLISHED` and `COMPLETED` events.
- **AC-6**: Every `/admin/*` route returns `401` without a token and `403` for a participant.
  The role is declared on the controller, so a new handler is admin only by default.
- **AC-7**: An event that ends before it starts, or whose registration closes after it starts,
  is rejected with `400`.
- **AC-8**: A body field the DTO does not declare is rejected with `400`, not silently ignored.
- **AC-9**: `npm run prisma:seed` promotes the user matching `ADMIN_EMAIL`.
- **AC-10**: `npm run prisma:seed` also ensures 15 sample companies exist, matched by
  case-insensitive unique name, without overwriting a company an organiser has edited. The
  sample block is skipped when `NODE_ENV` is `production`.
- **AC-11**: `GET /admin/companies` returns every company alphabetically for the event form's
  sponsor picker. It is admin only like the rest of `/admin/*`.
- **AC-12**: `POST /admin/uploads/event-images` stores each accepted file under
  `server/bucket/event_images/` with a generated name and answers `{ urls }`. Only JPEG, PNG,
  WebP, AVIF, and GIF are accepted; SVG is rejected. The bucket is served at `/bucket`, so an
  event's stored `imageUrls` resolve without a token. `imageUrls` is capped at 8 on both create
  and update.

## Options considered

### Option 1: One event table with sponsor names as strings

**Pros**: Smallest schema; one insert per event.

**Cons**: A company that sponsors three events is typed three times; its logo and website
drift; there is no way to ask "which events does this company back?".

### Option 2: Event, Company, and a sponsorship join (**chosen**)

**Pros**: The company is entered once and reused. The tier belongs to the sponsorship, so the
same company can be main sponsor at one event and co-sponsor at another. Deleting an event
does not delete the company.

**Cons**: Two tables and a nested create; an admin can still create a near duplicate company by
misspelling the name.

### Option 3: Separate company administration screen first

**Pros**: Clean master data.

**Cons**: Admins have to leave the event they are editing, create a company, come back, and
copy an id. The usual case is one new company while creating one event.

## Decision

**Chosen option**: Option 2. `Sponsor` is the join row, with a unique `(eventId, companyId)`
pair so promoting a company from co-sponsor to main sponsor is an update, not a second row.
`CreateSponsorDto` carries the company inline and the service matches it case insensitively, so
the admin never handles a company id.

`Applications` gets no event relation in this slice. Where an application belongs is a product
decision that has not been made, and a nullable foreign key would encode a guess.

## Rationale

Two tables are the honest model: a company is an entity with its own identity (name, website,
logo), and a sponsorship is a relationship with attributes (tier, contribution). Folding the
company into the sponsorship would make the second event by the same company a copy. The join
row keeps the tier where it belongs, so the same company can hold different tiers on different
events without a schema change.

A separate company screen was rejected because it adds a step to the common case. The inline
create keeps the admin on one form while still producing a reusable company row.

## Feature design

**Data model**:

| Model | Fields that matter | Rules |
|---|---|---|
| `HackathonEvent` | `title`, `description`, `startsAt`, `endsAt`, `registrationDeadline?`, `location?`, `imageUrls`, `status`, `createdById?` | `endsAt > startsAt`; deadline `<= startsAt`; `location` null means online; `imageUrls` is an ordered list of public paths |
| `Company` | `name` (unique), `website?`, `logoUrl?`, `industry?` | Matched case insensitively on create |
| `Sponsor` | `eventId`, `companyId`, `tier`, `contribution?` | Unique `(eventId, companyId)`; event cascades, company restricts |

`createdById` is nullable with `onDelete: SetNull`: an event outlives the account that created
it. `Sponsor.company` uses `onDelete: Restrict` so a company with history cannot be deleted by
accident; no delete route exists for companies in this slice.

**API surface**:

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/events` | GET | anonymous | `PUBLISHED` and `COMPLETED`, soonest first, sponsors included |
| `/events/:id` | GET | anonymous | `404` when missing, draft, or cancelled |
| `/admin/events` | GET | admin | Every status, drafts included: the console's read |
| `/admin/companies` | GET | admin | Every company, alphabetically: the sponsor picker's source |
| `/admin/events` | POST | admin | Records `createdById` from the verified token |
| `/admin/events/:id` | PATCH | admin | Partial; the schedule is re-checked against stored values |
| `/admin/events/:id` | DELETE | admin | `204`; sponsorships cascade |
| `/admin/events/:id/sponsors` | POST | admin | Nested `company`; `409` on a duplicate |
| `/admin/events/:id/sponsors/:sponsorId` | PATCH | admin | `tier`, `contribution` |
| `/admin/events/:id/sponsors/:sponsorId` | DELETE | admin | `204` |
| `/admin/uploads/event-images` | POST | admin | `multipart/form-data`, field `images` (max 8, 5 MB each); answers `{ urls }` |
| `/bucket/event_images/:file` | GET | anonymous | Static; the path an event stores in `imageUrls` |

**Validation**:
- `class-validator` and `class-transformer` are now installed, and `main.ts` registers
  `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.
  `transform` is what turns the nested `company` object into a `SponsorCompanyDto` instance.
- Enum values come from the generated Prisma enums, so a DTO and the column cannot drift.

**Authorization**:
- `@Roles(['admin'])` sits on both admin controllers, not on individual handlers. The
  `JwtAuthGuard` already reads `ROLES` from the handler then the controller, so class level is
  enough and a route added later inherits it.
- `@CurrentUser()` (new param decorator) reads the `PublicUser` the guard attached, so handlers
  do not repeat the null check.
- `EventsController` is `@AllowAnonymous()` at class level; the service, not the guard, decides
  which statuses are public.

**Key invariants**:
- A sponsorship is unique per event and company.
- Deleting an event never deletes a company.
- Public reads never return a `DRAFT` or `CANCELLED` event.
- The creator id comes from the authenticated user, never from the request body.

## Consequences

**Positive**:
- The catalogue and its sponsors live in normalised tables, ready for a public event page.
- Every admin route is protected by one class level declaration.
- DTO validation now runs for the whole API, not only this feature.

**Negative / tradeoffs**:
- `class-validator` and `class-transformer` had to be installed with `--legacy-peer-deps`
  because `@arcjet/nest` still declares a peer range below Nest 12. This predates the slice.
- Name based company matching means a typo creates a second company. A company id based path
  and an admin company screen would fix that later.
- No pagination on `GET /events`; fine at hackathon scale, wrong at a thousand events.

**Neutral**:
- `Applications` is unchanged, so applications cannot yet be attached to an event.
- Table names stay PascalCase (`HackathonEvent`), matching the existing `User` and
  `Applications` convention rather than the `hackathon_event` spelling in the brief.

## Follow-up

- [ ] Decide whether an `Application` belongs to an event, and add the relation if so.
- [ ] Delete an event's files from `bucket/` when the event is deleted or an image is removed;
      today the rows go and the files stay.
- [ ] Add pagination and filtering (status, date range) to `GET /events`.
- [ ] Add an admin list of drafts, and a route to publish or cancel in bulk.
- [ ] Consider a company admin screen plus a "attach existing company by id" path.
- [ ] Build the participant facing event list and event page in `client/`.
