# 0006. Notice inbox: broadcast new rows to online users

**Date**: 2026-11-22
**Status**: In Progress

## Summary

An application creates a notice: the applicant gets nothing back at once, and every admin is told
the person is in. Notices live in one table and one module: producers enqueue jobs, a worker stores
rows, and the websocket broadcasts them to whoever is online. The REST endpoints answer the
unread inbox, and the console's bell reads it and marks rows read.

## Context

[0005](0005-event-registrations.md) gives the API events, applications, and an applications page.
Someone applying on an open event today waits for an admin to notice on their own. Spec 0005 was
recorded before the "announcement" concept existed: it ends with the tradeoff "no way to tell
who's in a team anymore". The notification inbox fills that gap without a poll: one new table,
one producer, and a live push on the socket that the SPA already talks over for... nothing yet.

## Requirements

**User stories**:
- As an admin, I want to hear about a new application the moment it lands, so I can follow up.
- As a participant, I want the inbox to stay honest even when the app reloads: what I read stays read.

**Acceptance criteria**:
- **AC-1**: `POST /events/:id/registrations` completes an application, then the service enqueues
  one notification per admin with `senderId` = the applicant, and the message is
  `"<applicant> applied to <event title>"` with `data`
  `{ kind: 'event.registration', eventId, applicationId, link }`, where `link` is the
  deep link `/admin/dashboard/hackathon/registrations?id=<eventId>&registrationId=<applicationId>`
  (the page reads `registrationId`). Nothing is enqueued when there are no admins.
- **AC-2**: Notification rows: `senderId` (null for the system), `receiverId` (NOT NULL, FK to
  `User`, cascade), `data` JSONB NOT NULL, `message` NOT NULL, `read` default false, `createdAt`,
  `updatedAt`. Indexes: `(receiverId, read, createdAt)` and `(receiverId, id)`.
- **AC-3**: REST surface: `GET /notifications` answers `{ items, unreadCount }` — the unread
  rows newest first and the total unread; `PATCH /notifications/:id/read` marks a row read and
  answers 404 when the id does not exist for this user; `POST /notifications/read-all` marks all
  and answers `{ count }`.
- **AC-4**: Socket.IO: `NotificationsGateway` sits in the default namespace, verifies the
  handshake's `auth.token` with `SessionService.verifyAccess` plus a user row check, drops
  missing/invalid/banned users, and joins `user:<id>`.
- **AC-5**: Server → client messages on the room: `notification:new` with the row,
  `notification:read` with `{ ids }`, `notification:unreadCount` with `{ count }`.
- **AC-6**: Client → server: sending `notification:read` with `{ ids }` marks those rows read for
  the sender; other users' ids and empty payloads are ignored.
- **AC-7**: The console marks reads in three places — the REST response of `PATCH` (cache update),
  the socket broadcast (cross-tab), and "Mark all read". Every one appends the ids to the
  `notifications:read` array in `localStorage` as it happens.
- **AC-8**: `GET /notifications` returns only unread rows: the client filters the page against
  the ids it has saved, so a reload or a new tab never sees a read row.
- **AC-9**: The REST list, the socket, and the localStorage read marks agree: a row the socket
  delivers with a saved id is marked read in the cache and does not bump the count.

## Decision

**Chosen**: notifications are rows written by a worker; the socket pushes only what changed.
Calling the producer synchronous is also out: `EventsService.register` already answers the
registration, and making it wait on the queue adds latency without adding value. The queue worker
is the single write path, so a crash between enqueue and store costs a missed notice, not a
double one.

Alternatives rejected:
- Writing rows in the request and using the socket only for delivery. Simpler, but then the
  unread REST list cannot be reconciled when the socket is down — every page load after a
  missed row would re-fetch it forever.
- Polling `GET /notifications` for the bell. The user asked for a websocket, and polling adds
  load for nothing on a feature this frequent.

## Feature design

**Data model**: see AC-2; the `user` relation cascades, so accounts and inboxes die together.

**Producer**: `EventsService.register` → `NotificationsService.notify(...)` →
`BullMQ.add('create-notifications', { notifications })` on the `notifications` queue, with the
same deadline-before-throw shape as `MailService.enqueue`. The enqueue failure is caught in the
service — the application stands on its own.

**Worker**: `NotificationsProcessor` → `store()` via `createManyAndReturn`, then
`gateway.emitNew(row)` and `gateway.emitUnreadCount(receiver, count)` per row. Writing here
means the API's answer is about the application, not about notices.

**Gateway**: auth middleware is `handleConnection` — Nest calls it before the client joins the
room. Message handling is `@SubscribeMessage('notification:read')`; the gateway updates through
`NotificationsService.markReadByIds` (idempotent on `receiverId`) and re-broadcasts.

**Client**: `useUnreadNotifications` (REST, unread-only), `useMarkNotificationRead`,
`useMarkAllNotificationsRead`, `useNotificationSocket` (connects when a user is signed in,
refreshes the token on reconnect), and `NotificationsBell` in the account area. Read marks
persist to localStorage on the three paths in AC-7 and are filtered out of the unread page.

**Key invariants**:
- One row per receiver; nothing the API does writes rows directly.
- The socket only changes the unread page and the count; the REST endpoints are the authority.
- A user with no socket gets the REST list; nothing else changes.

## Consequences

**Positive**:
- Applications stop feeling lost to an admin's timeline.
- The bell is a read, so nothing breaks when the socket drops.
- One table; every later notice kind joins it.

**Negative / tradeoffs**:
- The REST `GET /notifications` is unread-only, so a "show read history" feature needs new
  semantics first.
- Per-admin rows mean `notify` is O(admins) — fine at current scale, a batch channel later if
  needed.

## Follow-up

- [ ] Let an admin reply or accept an application from the bell.
- [ ] Non-admin senders: let a user notify another user from the portal when the flow grows
  mutual notifications.
