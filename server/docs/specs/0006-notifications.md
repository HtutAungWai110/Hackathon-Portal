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
  `notification:read` with `{ ids, unreadCount }`, `notification:unreadCount` with `{ count }`.
  A REST mark broadcasts the same `notification:read` shape, so an open tab learns about a read
  made in another one without refetching.
- **AC-6**: Client → server: sending `notification:read` with `{ ids }` marks those rows read for
  the sender; other users' ids and empty payloads are ignored.
- **AC-7**: Opening the bell marks a row read when the row is actually visible in the panel
  (`IntersectionObserver`, also while scrolling); there is no "mark as read" click and no
  "mark all" button. The REST response, the socket broadcast, and localStorage
  (`notifications:read`) all record the mark as it happens, and closing the panel refetches the
  unread page so the rows that are now read leave it.
- **AC-8**: `GET /notifications` returns only unread rows: the client filters the page against
  the ids it has saved, so a reload or a new tab never sees a read row.
- **AC-9**: The REST list, the socket, and the localStorage read marks agree: a row the socket
  delivers with a saved id is marked read in the cache and does not bump the count.
- **AC-10**: While the page is visible, `notification:new` also pushes an arrival toast at the
  bottom right: the message, its arrival time, an action that follows `data.link` when present,
  and a close button. The toast fades out slowly on its own (pausing while hovered or focused)
  and is removed when its row is read elsewhere. A toast is a preview only; it never marks the
  row read.

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

**Client**: `AppShell` mounts `useNotificationSocket` once for the whole router, so the
connection and the arrival stack outlive a route change. `useUnreadNotifications` (REST,
unread-only) and `useMarkNotificationRead` feed `NotificationsBell`; each `NotificationBellRow`
marks itself read when it is visible. The live half is `notification-toast-store` (a Zustand
queue, not server state) drawn by `NotificationToaster` / `NotificationToastCard`, which uses
motion for the entrance, the slow fade, and the stack reflow. Read marks persist to localStorage
on every path in AC-7 and are filtered out of the unread page.

**Key invariants**:
- One row per receiver; nothing the API does writes rows directly.
- The socket only changes the unread page and the count; the REST endpoints are the authority.
- A user with no socket gets the REST list; nothing else changes.
- A toast is a preview of a row and never the record: losing it loses nothing.

## Consequences

**Positive**:
- Applications stop feeling lost to an admin's timeline.
- The bell is a read, so nothing breaks when the socket drops.
- One table; every later notice kind joins it.
- The arrival toast catches an admin who is not looking at the bell, without a second inbox.

**Negative / tradeoffs**:
- The REST `GET /notifications` is unread-only, so a "show read history" feature needs new
  semantics first.
- Per-admin rows mean `notify` is O(admins) — fine at current scale, a batch channel later if
  needed.

## Follow-up

- [ ] Let an admin reply or accept an application from the bell.
- [ ] Non-admin senders: let a user notify another user from the portal when the flow grows
  mutual notifications.
