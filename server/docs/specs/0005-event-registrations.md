# 0005. Let participants apply to an event, and let admins read the applications

**Date**: 2026-11-16 (rewritten 2026-11-22)
**Status**: In Progress

## Summary

A signed in participant applies for a place at a published event on the public event page. An
application is an `Applications` row: one per `(eventId, applier)`, carrying the introduction the
organiser reads before accepting someone, plus an optional company name and email. The admin
console shows a "Show applications" control on each event row; opening it animates the drawer into
place and only then fetches that event's applications.

This replaces the first cut of this spec, which added a separate `EventRegistration` table. That
table is dropped. Registrations are applications, so keeping two tables meant two sources of truth
for the same question: who wants to be here, and what did they say.

## Context

Spec [0003](0003-hackathon-events-and-sponsors.md) gave the portal events, sponsors, and a public
event page, but no way for a visitor to join one. The page could say when the event was and who
backed it, and then stop. The role model already distinguishes `participant` from `admin`, and the
JWT guard already attaches the signed in user to a request.

`Applications` already existed and already belonged to a `User` through `applier`. It modelled a
job application, with a company and a position. A hackathon place is the same shape: a person
argues why they belong, optionally names a company or team, and an organiser reviews it. Splitting
those into two tables duplicated the interesting half and left `Applications` unable to say which
event a row was about.

## Requirements

**User stories**:
- As a signed in participant, I want to apply for a published event, describe why I am a capable
  member for a team, and see that my application is in when I come back.
- As a visitor without an account, I want to be offered sign in instead of a form that cannot
  work.
- As an admin, I want to know how many people applied for an event, and open the list to read
  each introduction and reach that person.

**Acceptance criteria**:
- **AC-1**: `Applications` links one `User` (`applier`) to one `HackathonEvent` (`eventId`).
  `(eventId, applier)` is unique; deleting either side deletes the application. `eventId` is
  required, and `position` is gone.
- **AC-2**: `additionalMessage` is required. `companyName` and `companyEmail` are nullable.
- **AC-3**: `POST /events/:id/registrations` requires a token and a body of
  `{ additionalMessage, companyName?, companyEmail? }`. It returns the new application. A second
  application from the same account returns `409`.
- **AC-4**: Applying is refused with `400` when the event is not `PUBLISHED`, when the registration
  deadline has passed, or when the event has already started. A message that is only whitespace is
  also `400`, even though `@MinLength(1)` accepts it.
- **AC-5**: `GET /events/:id/registration` answers `{ registered, registeredAt, open }` for the
  signed in caller. `registeredAt` is the application's `applicationDate`, and `open` is decided on
  the server's clock. A draft or unknown event is `404`.
- **AC-6**: `GET /admin/events` and `GET /admin/events/:id` include `registrationCount`, read from
  `_count.applications`. The console needs it before the drawer is opened.
- **AC-7**: `GET /admin/events/:id/registrations` is admin only. It returns one page of
  applications, newest first, as `{ items, page, limit, total, totalPages, registrationId }`. Each
  item carries `id`, `additionalMessage`, `companyName`, `companyEmail`, `status`,
  `applicationDate`, and the applicant's `id`, `name`, `email`, and `image`.
- **AC-7a**: `page` defaults to 1. `limit` defaults to 10 and accepts only 10, 20, 40, 60, 80, or
  100; anything else is `400`. A page past the last one is clamped to it. `totalPages` is at least
  1, so an empty list still reports one page.
- **AC-7b**: `registrationId` returns the page that holds that application, ignoring `page`. An
  unknown or other-event id is `404`. The envelope echoes the id it resolved.
- **AC-8**: The public event page shows Register when the event is published, the visitor has no
  application yet, and registration is open; the applied state once they have one; Closed when it
  is not open. An anonymous visitor sees Sign in to register; an admin sees Manage event.
- **AC-9**: Register opens an inline form. The message is required and the copy tells the
  participant to describe themselves as a capable member for the team, because the organiser reads
  it first. Company name and email are optional.
- **AC-10**: An admin event row has a "Show applications" control. Opening it animates the panel
  and starts the fetch; closing it unmounts the panel and keeps the cached answer.
- **AC-11**: The panel has loading, empty, and error states, and the animation respects
  `prefers-reduced-motion`.
- **AC-12**: An admin can open a full registrations page for one event at
  `/admin/dashboard/hackathon/registrations?id=<eventId>`. The public event page offers that link
  as "Show registrations", visible to admins only, beside "Manage event". The page pages the list,
  offers the six page sizes, and can be addressed to one application with `registrationId`, which
  is highlighted in place.
- **AC-13**: The drawer stays a preview of page one and links to the full page once there are more
  applications than it shows.

## Decision

**Chosen**: registrations are `Applications` rows, keyed by `(eventId, applier)`. The public page
asks the server whether applying is open rather than judging it from the device clock.

Alternatives rejected:
- A separate `EventRegistration` table (the first cut). Two tables answered the same question, and
  the one with a message, a company, and a review status was not the one counting registrations.
- A registration counter on the event. It loses who applied and what they wrote.
- Matching registrations to events through `position`. That is a string, not a relation, and it
  cannot cascade or be indexed.

## Feature design

**Data model**:

| Model | Fields that matter | Rules |
|---|---|---|
| `Applications` | `id`, `eventId`, `applier`, `additionalMessage`, `companyName?`, `companyEmail?`, `applicationDate`, `lastUpdated`, `status` | Required `eventId` and `applier`; unique `(eventId, applier)`; `(eventId, applicationDate)` and `applier` indexed; both relations cascade. `status` is `ApplicationStatus` and defaults to `IN_PROGRESS` |

`ApplicationStatus` stays `IN_PROGRESS | INTERVIEW | REJECTED`. The console labels them In review,
Interview, and Not selected.

**API surface**:

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/events/:id/registration` | GET | signed in | `{ registered, registeredAt, open }`; natural 404 for a non-public event |
| `/events/:id/registrations` | POST | signed in | Body `{ additionalMessage, companyName?, companyEmail? }`; `409` when the caller already applied |
| `/admin/events/:id/registrations` | GET | admin | Paged application and applicant fields, newest first; `page`, `limit` (10/20/40/60/80/100), `registrationId` |

`GET /events` and `GET /events/:id` remain anonymous. `@AllowAnonymous()` sits on those two
handlers, so the application routes are protected by default instead of relying on the handler to
reject a missing user.

**Client**:
- `EventRegistrationAction` owns the status query and the mutation. Register opens a small
  react-hook-form form: required message, optional company name and email. The page only decides
  whether the control is rendered: admin, participant, or anonymous.
- `useRegisterForEvent` sets the status cache to applied before invalidating it, so the page does
  not flash the form again while the refetch runs. It pushes a message onto the global queue and
  invalidates `registrationKeys.all`.
- The admin drawer (`EventRegistrations`) is mounted inside each ledger row with the toggle. The
  query is disabled until the drawer opens, so the console does not fetch applications it was
  never asked for. Motion animates height and opacity under `MotionConfig reducedMotion="user"`;
  the closed drawer unmounts, the query cache survives.
- `RegistrationsPage` is the full-page view of the same query. The public event page links to it
  from an admin-only "Show registrations" button. It owns the pager and the page-size selector, and
  it reuses cached pages the drawer already fetched. A `registrationId` query parameter asks the
  server for the page holding that row, which the page marks and can stop marking without leaving.
- The drawer fetches page one and shows the total, so opening it is one small request even on a
  large season; the full page is where the rest of the list lives.

**Key invariants**:
- One account applies at most once per event.
- The applicant is always the authenticated user, never a body field.
- A draft, cancelled, started, or closed event cannot take an application.
- The public page never guesses whether registration is open from the visitor's clock.
- The message is trimmed before it is stored; an empty one is refused, not saved as blank.

## Consequences

**Positive**:
- One table, one question: an application is the registration, so the admin count, the drawer,
  and the public state all read the same rows.
- The uniqueness rule makes applying idempotent at the database level.
- The admin list is fetched per event and only on demand.
- The organiser gets the participant's own argument, not just a name and an email.
- The server owns the "open" decision, so a wrong device clock cannot open a closed event.

**Negative / tradeoffs**:
- `Applications` gained a required `eventId` and lost `position`, so any other consumer of that
  table has to go through an event. There is none today.
- Applying is a form, not one click, which is more friction but produces the text an organiser
  actually needs.
- No withdraw route in this slice, and no way for an admin to change `status` from the console yet.
- Paging makes "show me everyone" a few clicks rather than one scroll, and the drawer only previews
  page one.

## Follow-up

- [ ] Let a participant withdraw an application.
- [ ] Let an admin move an application between `IN_PROGRESS`, `INTERVIEW`, and `REJECTED`.
- [x] Paginate the admin applications list and let the admin choose the page size.
- [ ] Consider emailing a confirmation through the existing mail queue.
