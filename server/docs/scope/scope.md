# Scope: Hackathon project API

A NestJS API where people create accounts, sign in, and apply for positions, with admins reviewing applications. The product surface is small for now: identity, applications, and the guards that protect them.

**Build approach:** Tracer Bullet (each feature is built end to end through every layer and left working before the next one starts).
**Workflow:** Beta (after `/develop`, run `/check verify` then `/test`). The project default level of rigor. `/architect` is the first stop for a feature with a real decision, and skippable when you already know the build. Any feature can carry its own tag (e.g. `· GA`) to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | App scaffold | Foundation | existing |
| B | Arcjet protection | Foundation | existing |
| C | Prisma data layer | Foundation | existing |
| D | Mail queue & SMTP | Foundation | existing |
| 1 | Authentication & roles | Slice 1 | in-progress |
| 2 | Hackathon events & sponsors | Slice 2 | in-progress |

## Foundations

### A. App scaffold · existing
NestJS 12 on Node 24, ESM, strict TypeScript, Vitest, lint, and format, with one public route.
**Done when:** the app boots, builds, and answers `GET /`.
Code in `src/`

### B. Arcjet protection · existing
Global guard that applies Shield, bot detection, and a 100 requests per 60 seconds fixed window to every application route.
**Done when:** a denied request returns the Arcjet error and an allowed one reaches the handler.
Code in `src/arcjet-protection.guard.ts`

### C. Prisma data layer · existing
Prisma 7 with the `PrismaPg` driver adapter, a global `PrismaModule`, and the generated client.
**Done when:** services can inject `PrismaService` and query PostgreSQL.
Code in `src/prisma/`

### D. Mail queue & SMTP · existing
Verification and reset mail is stored on a BullMQ queue in Redis and sent by a worker over SMTP with nodemailer, with a log sink when no credentials are configured.
**Done when:** a queued job is rendered and delivered, and a failed send is retried.
Code in `src/mail/`, spec [0004](specs/0004-async-email-delivery.md)

## Slice 1: Identity

### 1. Authentication & roles · in-progress
Google sign in and email plus password sign in, sessions, email verification, password reset, and the `participant` and `admin` roles, with every application route protected by default.
**Done when:** a new user can sign up or sign in and reach a protected route, a participant is refused an admin route, and the first admin is granted by a repeatable seed script.
- [x] Design it (spec): `/architect authentication & roles`
- [ ] Build it: `/develop authentication & roles`
   - [x] Schema, two migrations, generated client (AC-11)
   - [x] Auth config, mail service, module wiring, guard order (AC-1..6, 10, 13, 17)
   - [x] Async delivery of verification and reset mail (spec 0004, AC-3, AC-4)
   - [x] Public and admin routes (AC-7, 8)
   - [x] Admin seed script (AC-9)
   - [x] Access and refresh tokens for app routes (spec 0002, AC-1..10)
   - [ ] Tests plus live Google check (AC-1..17)
- [ ] Verify it: `/check verify authentication & roles`
- [ ] Test it: `/test authentication & roles`

Spec 0001 in `docs/specs/0001-add-better-auth-with-roles.md` · token layer (amends 0001) in
`docs/specs/0002-mint-api-tokens.md` · code in `src/auth/`, `src/admin/`,
`src/config/env.validation.ts`, `prisma/schema.prisma`, `prisma/seed.ts`

## Slice 2: Event catalogue

### 2. Hackathon events & sponsors · in-progress
Admins create hackathon events and attach companies as main sponsors or co-sponsors. Events
are public to read once published, and every admin route is behind the `admin` role.
Applications are the registration: one row per account and event, carrying the participant's
introduction plus optional company details.
**Done when:** an admin can create an event with sponsors and a visitor can list published
events without an account.
- [x] Design it (spec): `/architect hackathon events & sponsors`
- [ ] Build it: `/develop hackathon events & sponsors`
   - [x] Schema, migration, generated client (AC-1, 2)
   - [x] Events module, DTOs, service rules (AC-2..5, 7, 8)
   - [x] Admin routes behind class level `@Roles(['admin'])` (AC-6)
   - [x] Admin promotion via the seed script (AC-9)
   - [x] Admin dashboard: event ledger, one-click publish
   - [x] Event creation screen at `/admin/dashboard/hackathon/create` with visibility and
     sponsor comboboxes (AC-11)
   - [x] Event images: `imageUrls` column, multer upload endpoint, `bucket/event_images` served
     at `/bucket` (AC-12); the create form uploads on pick and shows removable thumbnails
   - [x] Event header image: `backgroundUrl` column, single-file upload endpoint, shown behind
     the public hero (AC-13)
   - [x] Event edit as `PUT` with a required full body, `PATCH` kept for the publish toggle
     (AC-14)
   - [x] Client: public event list and event page
   - [x] Participant registration: an `Applications` row per account and event with a required
     introduction, Register on the public page, a per-event admin applications drawer fetched
     on open, and a full registrations page linked from the event page (spec 0005)
- [ ] Verify it: `/check verify hackathon events & sponsors`
- [ ] Test it: `/test hackathon events & sponsors`

Spec 0003 in `docs/specs/0003-hackathon-events-and-sponsors.md` · registrations (amends 0003) in
`docs/specs/0005-event-registrations.md` · code in `src/events/`,
`src/admin/admin-events.controller.ts`, `prisma/schema.prisma`

## Deferred

Out of scope for the current pass, kept so the plan stays honest.
- **Job applications**: apply, list, and track application status · needs a decision
- **Admin review console**: list and triage applications · needs a decision
- **Real email delivery**: replace the logging mail service before any public deploy · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Every other box is an execution box.

**Feature lifecycle**: `planned` → `in-progress` → `done`, plus `existing` (built before this workflow) and `dropped` (de-scoped, kept for history).

- **Next step** = the first unticked box, always a command or a tracked milestone.
- **Atomic build tasks live in the spec's `## Build plan`**, never here. This file carries only the milestone rollup.
- **Workflow** (header line) is the project default, what runs after `/develop`: **Prototype** = nothing; **Alpha** = `/check verify`; **Beta** = `/check verify` then `/test`; **GA** = adds a fresh model `/check review` then `/document`.
