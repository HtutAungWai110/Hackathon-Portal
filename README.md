# Hackathon Portal

A full stack hackathon portal: a public event calendar, application based registration for signed
in participants, and an admin console for creating events, attaching sponsors, and reading who
applied.

Two independent packages live side by side. There is no root `package.json` and no shared
`node_modules`; every command runs inside `client/` or `server/`.

| Package | What it is | Default URL |
| --- | --- | --- |
| `client/` | Vite 8 + React 19 single page app | `http://localhost:5173` |
| `server/` | NestJS 12 API, Prisma, PostgreSQL | `http://localhost:3000` |

The interface is neo-brutalist: dark surfaces, cyan accents, hard edges, thick borders, and
offset shadows. Class names and design tokens are shared across screens, so styling changes
belong in the owning feature's CSS or in `client/src/index.css`.

## Stack

| Layer | Tools |
| --- | --- |
| Client | React 19, Vite 8, TypeScript 6, React Router 8, TanStack Query 5, react-hook-form 7, Zustand 5, Tailwind 4, Motion 14 |
| Auth | Better Auth (identity provider) plus a Nest minted JWT pair |
| Server | NestJS 12, Prisma 7, PostgreSQL, Arcjet |
| Mail | BullMQ on Redis, nodemailer, or a log transport when SMTP is unconfigured |
| Tests | Vitest on the server; the client has no test runner yet |

## Repository layout

```
.
├── AGENTS.md                 repo wide routing and shared rules
├── README.md                 this file
├── client/
│   ├── index.html
│   ├── vite.config.ts        React, React Compiler, Tailwind, `@` -> `src`
│   ├── src/
│   │   ├── app/              router and route table
│   │   ├── assets/
│   │   ├── components/       shared UI primitives and the light beam
│   │   ├── features/         one folder per product area
│   │   │   ├── auth/         sign in, sign up, guards, session, auth store
│   │   │   ├── home/         the landing page and the calendar
│   │   │   ├── hackathon/    public event list, detail page, application form
│   │   │   ├── admin/        dashboard, event forms, ledger, applications drawer
│   │   │   └── messages/     global message queue
│   │   ├── lib/              api client, session api, query client, helpers
│   │   ├── index.css         design tokens, base layer, shared classes
│   │   └── main.tsx          providers, router, message stack
│   └── .env.example
└── server/
    ├── prisma/
    │   ├── schema.prisma     data model
    │   └── migrations/       applied history
    ├── src/
    │   ├── auth/             Better Auth config, mail adapter, token layer
    │   │   └── session/      JWT service, guard, cookies, `/session/*`
    │   ├── events/           catalogue service, public controller, DTOs
    │   ├── admin/            admin only controllers over the same service
    │   ├── mail/             queue, worker, templates, transports
    │   ├── uploads/          multipart uploads and the image bucket
    │   ├── prisma/           PrismaService and its module
    │   ├── config/           environment validation, Redis config
    │   ├── generated/        generated Prisma client, do not edit
    │   ├── main.ts           bootstrap, CORS, static assets, validation
    │   └── app.module.ts     module wiring and global guards
    ├── docs/
    │   ├── specs/            numbered design records per feature
    │   └── scope/            scope and milestone checklist
    ├── bucket/               uploaded event images, contents ignored
    ├── docker-compose.yml    Redis for the mail queue
    └── .env.example
```

## Client

The client is feature first. A screen, its hooks, its API module, and its CSS live together;
only genuinely shared pieces move up to `components/` or `lib/`.

| Folder | Owns |
| --- | --- |
| `app/` | The route table, and the shell that owns the live notification socket and the toaster |
| `components/` | `AppNav`, `TextField`, `TextAreaField`, `PasswordField`, `Combobox`, `ConfirmDialog`, `StatusScreen`, `LightRays` |
| `features/auth/` | Login and signup screens, `RequireSession` / `RequireAdmin` / `RedirectIfAuthenticated`, the session query, the Zustand identity mirror |
| `features/home/` | The landing page: what the portal is, how it works, and the event calendar |
| `features/hackathon/` | Public calendar and cards, the event page, the image lightbox, description rendering, the Register action with its application form |
| `features/admin/` | Dashboard, create and edit forms, sponsor picker, image and background fields, the event ledger, the applications drawer, the registrations page |
| `features/messages/` | The global message store and the animated stack |
| `features/notifications/` | The unread inbox API, the bell that reads a row once it is visible, the arrival toaster, and the realtime websocket client |
| `lib/` | `apiFetch` (Bearer token plus one refresh on `401`), session API, Better Auth client, query client, error mapping, description parser, date formatting, validation rules |

Data fetching rules that matter when adding a screen:

- Server state belongs to TanStack Query. Query keys are `as const` arrays exported from the
  feature that owns them.
- Every application request goes through `apiFetch`; no raw `fetch` in components. It reads
  the `access_token` cookie, attaches `Authorization: Bearer`, refreshes once, and normalizes
  errors into `ApiError`.
- Mutations invalidate the keys they affect and push a message onto the global queue, so the
  user sees the outcome of every create, save, and delete.
- Loading, empty, and error states are part of the screen, not an afterthought.

Routes:

| Path | Access | Screen |
| --- | --- | --- |
| `/` | signed in | Home: product explanation and calendar |
| `/hackathon?id=<eventId>` | public | Event page, with Register (an application form) for signed in participants |
| `/admin/dashboard` | admin | Event ledger |
| `/admin/dashboard/hackathon/create` | admin | Create event |
| `/admin/dashboard/hackathon/edit?id=<eventId>` | admin | Edit event |
| `/admin/dashboard/hackathon/registrations?id=<eventId>` | admin | Full registrations page for one event |
| `/login`, `/signup` | anonymous | Auth screens |

## Server

Nest modules mirror the product areas. Controllers stay thin; `EventsService` owns the rules,
and `PrismaService` owns persistence.

| Module | Responsibility |
| --- | --- |
| `auth/` | Mounts Better Auth at `/auth`, sends verification and reset mail through the queue |
| `auth/session/` | Mints the 15 minute access and 7 day refresh JWTs, sets cookies, guards routes, serves `/session/*` |
| `events/` | Public event reads, registration status, applications, sponsor and event writes |
| `admin/` | `@Roles(['admin'])` controllers for events, sponsors, companies, applications, ping |
| `uploads/` | Multipart image upload under multer, writes to `bucket/event_images/` |
| `mail/` | BullMQ queue producer, worker, templates, SMTP and log transports |
| `notifications/` | Notice inbox: REST list, socket gateway, producer (`NotificationsService.notify`) and the worker that stores rows and broadcasts |
| `prisma/` | The single `PrismaService` |
| `config/` | Environment validation and the Redis connection |

### API surface

There is no global route prefix.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `*` | `/auth/*` | Better Auth | Sign up, sign in, Google, verification, reset |
| `POST` | `/session/exchange` | cookie | Trade a Better Auth session for the JWT pair |
| `POST` | `/session/refresh` | refresh cookie | Mint a new access token |
| `POST` | `/session/logout` | anonymous | Clear both cookies |
| `GET` | `/session` | signed in | Read the current user |
| `GET` | `/events` | public | Published and completed events |
| `GET` | `/events/:id` | public | One public event, sponsors included |
| `GET` | `/events/:id/registration` | signed in | `{ registered, registeredAt, open }` |
| `POST` | `/events/:id/registrations` | signed in | Apply with a required message; `409` if already applied |
| `GET` | `/admin/events` | admin | Every event, drafts included, with `registrationCount` |
| `POST` | `/admin/events` | admin | Create an event |
| `GET` | `/admin/events/:id` | admin | Read one event whatever its status |
| `PUT` | `/admin/events/:id` | admin | Replace the whole event (the edit form) |
| `PATCH` | `/admin/events/:id` | admin | Partial update (the publish toggle) |
| `DELETE` | `/admin/events/:id` | admin | Delete an event |
| `GET` | `/notifications` | signed in | Unread rows, newest first, plus `unreadCount` |
| `PATCH` | `/notifications/:id/read` | signed in | Mark one unread row read |
| `POST` | `/notifications/read-all` | signed in | Mark every unread row read; answers `{ count }` |
| `GET` | `/admin/events/:id/registrations` | admin | One page of applications; `page`, `limit` (10–100 in tens), `registrationId` |
| `POST` | `/admin/events/:id/sponsors` | admin | Attach a sponsor |
| `PATCH` | `/admin/events/:id/sponsors/:sponsorId` | admin | Update a sponsor |
| `DELETE` | `/admin/events/:id/sponsors/:sponsorId` | admin | Detach a sponsor |
| `GET` | `/admin/companies` | admin | Company picker options |
| `POST` | `/admin/uploads/event-images` | admin | `{ urls }`, up to 8 images |
| `POST` | `/admin/uploads/event-background` | admin | `{ url }`, one header image |
| `GET` | `/bucket/...` | public | Static uploaded images |

`/auth/*` is handled by Better Auth middleware, so Nest guards and pipes never see it. Every
other application route accepts only `Authorization: Bearer <accessToken>`; the Better Auth
cookie is not a second way in.

Websocket: `NotificationsGateway` serves the default socket.io namespace on the same origin. The
handshake carries the access JWT in `auth.token`, verified like a request token; unknown or
banned users are dropped before they join. Each user joins a `user:<id>` room, so new rows arrive
as `notification:new`, read changes as `notification:read` with `{ ids, unreadCount }` (whether
the mark came through the REST endpoint or the socket), and the count changes as
`notification:unreadCount`. The SPA mounts the socket once, in `AppShell`, so it survives route
changes.

### Data model

| Model | Meaning |
| --- | --- |
| `User` | Account with `participant` or `admin` role, verification and ban fields |
| `Notification` | One user's message from the portal: `senderId` (null for the system), `receiverId`, the `data` payload (kind, ids, and the console `link`), `message`, `read`, `createdAt` |
| `Session`, `Account` | Better Auth records |
| `Applications` | A participant's application for one event: required message, optional company; unique `(eventId, applier)` |
| `HackathonEvent` | Title, description, schedule, deadline, location, images, status |
| `Company` | A sponsor organisation |
| `Sponsor` | Joins a `Company` to an event with a tier and contribution |

Event status is `DRAFT`, `PUBLISHED`, `COMPLETED`, or `CANCELLED`. Only `PUBLISHED` and
`COMPLETED` are visible to visitors. Whether registration is open is decided on the server's
clock: the event must be published, not started, and before its deadline.

## How a request moves

1. The SPA copies `access_token` from the cookie into `Authorization` and calls the API.
2. `JwtAuthGuard` verifies the token, loads the user row, rejects a banned account, and checks
   `@Roles`. A role change or ban applies on the next request.
3. The controller validates input through a DTO, calls one service method, and returns it.
4. The service applies the rules and reaches PostgreSQL through Prisma.
5. Errors come back as `{ statusCode, message, error }`; the client renders them through one
   error mapper instead of branching on status codes in components.

## Running locally

Prerequisites: Node 20 or newer, PostgreSQL 16, and Redis if you want mail to leave the
process. Redis runs in Docker.

```bash
# 1. API
cd server
npm install --legacy-peer-deps
cp .env.example .env
npx prisma migrate dev --config prisma7.config.ts
npx prisma generate --config prisma7.config.ts
docker compose up -d redis
npm run start:dev

# 2. SPA, in a second terminal
cd client
npm install
cp .env.example .env
npm run dev
```

The API must be started from `server/`, because the upload bucket and the static route are
both derived from the working directory.

### Environment

Both packages ship a `.env.example` with comments. The ones that change behavior:

| Variable | Package | Effect |
| --- | --- | --- |
| `DATABASE_URL` | server | PostgreSQL connection |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | server | Token signing, 32 characters minimum; rotating either signs everyone out |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | server | Better Auth signing and callback base |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | server | Google sign in; redirect URI is `http://localhost:3000/auth/callback/google` |
| `ADMIN_EMAIL`, `APP_PASSWORD` | server | SMTP delivery and the seeded admin. Empty means links are logged instead |
| `REDIS_URL` | server | BullMQ queue, default `redis://localhost:6379` |
| `CLIENT_URL` | server | Allowed CORS origins, comma separated |
| `ARCJET_KEY`, `ARCJET_MODE` | server | Bot and abuse protection |
| `VITE_API_URL` | client | API base URL, default `http://localhost:3000` |

Google sign in is not verified end to end. Without Redis the API still boots and signup still
works, but no mail leaves and the reason is logged.

## Checks

Run these inside the package you touched. There is nothing to run at the root.

```bash
# server
npm run lint
npm run build
npm test

# client
npm run lint
npm run build
```

`client` has no test runner yet; `npm run build` runs `tsc -b`, so it is also the type check.

## Documentation

- `server/docs/specs/` holds numbered design records: auth, tokens, events and sponsors, async
  email, and event applications. Update the relevant spec when behavior changes.
- `server/docs/scope/scope.md` is the feature checklist.
- `AGENTS.md`, `client/AGENTS.md`, and `server/AGENTS.md` are the working rules for each
  package. Read the one that matches the code before editing.

## Conventions worth knowing

- Two packages, no workspace. Install and run commands inside `client/` or `server/`.
- Server dependencies install with `--legacy-peer-deps`.
- After editing `schema.prisma`, run `npx prisma generate --config prisma7.config.ts`;
  migrations need the same `--config`.
- Server code is ESM with `.js` relative imports and strict TypeScript.
- The server enforces authorization. Hiding an admin link is a UX choice, not security.
- The README describes the current structure. When a commit changes that structure, the README
  is updated in the same commit.
