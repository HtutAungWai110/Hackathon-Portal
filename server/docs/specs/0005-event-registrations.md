# 0005. Let participants register for an event, and let admins read who did

**Date**: 2026-11-16
**Status**: In Progress

## Summary

A signed in participant takes a place at a published event with one click on the public event
page. The server records one `EventRegistration` per person per event. The admin console shows a
"Show registrations" control on each event row; opening it animates the drawer into place and
only then fetches that event's registrations. The existing `Applications` table stays untouched:
this is a place at an event, not a job application.

## Context

Spec [0003](0003-hackathon-events-and-sponsors.md) gave the portal events, sponsors, and a
public event page, but no way for a visitor to join one. The page could say when the event was
and who backed it, and then stop. The role model already distinguishes `participant` from
`admin`, and the JWT guard already attaches the signed in user to a request, so the missing
piece was one table and two surfaces.

The admin side already lists every event in a ledger row. Registrations belong to a single event
and are only interesting one event at a time, so they are fetched per row rather than with the
event list.

## Requirements

**User stories**:
- As a signed in participant, I want to register for a published event with one click, and see
  that I hold a place when I come back.
- As a visitor without an account, I want to be offered sign in instead of a button that cannot
  work.
- As an admin, I want to know how many people registered for an event, and open the list to see
  who they are and how to reach them.

**Acceptance criteria**:
- **AC-1**: `EventRegistration` links one `User` to one `HackathonEvent`. `(eventId, userId)` is
  unique; deleting either side deletes the registration.
- **AC-2**: `POST /events/:id/registrations` requires a token, takes no body, and returns the
  new registration. A second registration returns `409`.
- **AC-3**: Registration is refused with `400` when the event is not `PUBLISHED`, when the
  registration deadline has passed, or when the event has already started.
- **AC-4**: `GET /events/:id/registration` answers `{ registered, registeredAt, open }` for the
  signed in caller. `open` is decided on the server's clock. A draft or unknown event is `404`.
- **AC-5**: `GET /admin/events` and `GET /admin/events/:id` include `registrationCount`. The
  console needs it before the drawer is opened.
- **AC-6**: `GET /admin/events/:id/registrations` is admin only and returns each registrant's
  name, email, image, and registration time, newest first.
- **AC-7**: The public event page shows Register when the event is published, the visitor has
  no place yet, and registration is open; Registered once they hold one; Closed when it is not
  open. An anonymous visitor sees Sign in to register; an admin sees Manage event.
- **AC-8**: An admin event row has a "Show registrations" control. Opening it animates the
  panel and starts the fetch; closing it unmounts the panel and keeps the cached answer.
- **AC-9**: The panel has loading, empty, and error states, and the animation respects
  `prefers-reduced-motion`.

## Decision

**Chosen**: one `EventRegistration` table with a unique `(eventId, userId)` pair, and the
public page asks the server whether registering is open rather than judging it from the device
clock.

Alternatives rejected: storing a registration counter on the event (loses who and when), and
reusing `Applications` (that table models a job application with a company and a position, which
is a different thing from a place at an event).

## Feature design

**Data model**:

| Model | Fields that matter | Rules |
|---|---|---|
| `EventRegistration` | `eventId`, `userId`, `createdAt` | Unique `(eventId, userId)`; both relations cascade |

**API surface**:

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/events/:id/registration` | GET | signed in | `{ registered, registeredAt, open }`; natural 404 for a non-public event |
| `/events/:id/registrations` | POST | signed in | Takes no body; `409` when the caller already holds a place |
| `/admin/events/:id/registrations` | GET | admin | Registrant name, email, image, and `createdAt`, newest first |

`GET /events` and `GET /events/:id` remain anonymous. `@AllowAnonymous()` moved from the
`EventsController` class to those two handlers, so the new registration routes are protected by
default instead of relying on the handler to reject a missing user.

**Client**:
- `EventRegistrationAction` owns the status query and the mutation. The page only decides
  whether the control is rendered: admin, participant, or anonymous.
- `useRegisterForEvent` pushes a message onto the global queue and invalidates
  `registrationKeys.all`.
- The admin drawer (`EventRegistrations`) is mounted inside each ledger row with the toggle. The
  query is disabled until the drawer opens, so the console does not fetch registrations it was
  never asked for. Motion animates height and opacity under
  `MotionConfig reducedMotion="user"`; the closed drawer unmounts, the query cache survives.

**Key invariants**:
- One participant holds at most one place per event.
- The registrant is always the authenticated user, never a body field.
- A draft, cancelled, started, or closed event cannot take a registration.
- The public page never guesses whether registration is open from the visitor's clock.

## Consequences

**Positive**:
- Registration is a single row and a single click; the uniqueness rule makes it idempotent at
  the database level.
- The admin list is fetched per event and only on demand.
- The server owns the "open" decision, so a wrong device clock cannot open a closed event.

**Negative / tradeoffs**:
- Registering is one click with no team name or profile questions yet; a richer form would need
  a DTO and more columns.
- No unregister route in this slice.
- The registrations list is not paginated; hackathon-scale is fine.

## Follow-up

- [ ] Let a participant withdraw a registration.
- [ ] Add team or attendance details to the registration form.
- [ ] Paginate the admin registrations list when a season outgrows one screen.
- [ ] Consider emailing a confirmation through the existing mail queue.
