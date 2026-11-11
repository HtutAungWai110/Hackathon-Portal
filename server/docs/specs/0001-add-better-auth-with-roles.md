# 0001. Add Better Auth with roles to the NestJS API

**Date**: 2026-11-10
**Status**: In Progress

## Summary

This spec adds authentication to the NestJS API using Better Auth, with Google and email plus password sign in. Every new user gets the participant role, and the admin role is granted only by a seed script. Sessions, email verification, password reset, and the Prisma schema all live in the existing `hackathon` PostgreSQL database.

## Context

The project currently has no authentication. The only route is a public `GET /` that returns `Hello World!`. The stack is NestJS 12 on Node 24, ESM, strict TypeScript, Prisma 7 with the `PrismaPg` driver adapter, PostgreSQL 18, and Vitest. Arcjet already runs as a global Nest guard with Shield, bot detection, and a fixed window of 100 requests per 60 seconds. Observe provides tracing and logs.

The product needs user accounts before any application data can be tied to a person. The existing `User` and `Applications` tables were designed for that, but the `hackathon` database is empty, so this is the moment to shape the identity tables correctly. The team also needs a role model now, because admin routes are planned and retrofitting authorization is expensive.

The engineer already configured `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. The Google console currently lists `http://localhost:3000/auth/callback`, while the standard Better Auth callback for a base path of `/auth` is `http://localhost:3000/auth/callback/google`.

> ⚠️ **Premise note**: Email delivery only writes verification and reset links to the server log in development. That is fine for local work, but real users cannot verify or recover an account until a real email provider replaces it. Treat that as a release blocker, not a permanent design.

## Requirements

**User stories**:
- As a visitor, I want to sign up or sign in with Google or email and password so that I can reach protected API routes.
- As a new user, I want the participant role automatically so that I can use the application without an administrator granting access.
- As a user, I want to verify my email and reset a forgotten password so that I can keep access to my account.
- As an administrator, I want admin routes to reject participants so that privileged operations stay protected.
- As an operator, I want a repeatable way to grant the first admin role so that nobody can promote themselves through the API.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):
- **AC-1**: A first time Google sign in redirects to Google, returns to `http://localhost:3000/auth/callback/google`, creates a `User` with `role = "participant"` and `emailVerified = true`, and returns a session cookie.
- **AC-2**: Email and password sign up returns `200` with the created user and **no session cookie**, creates a `User` with `role = "participant"`, and creates an `Account` row with `providerId = "credential"` holding a hash. No response body contains a hash, and a request that sends `role` in the body is refused with `400` and code `FIELD_NOT_ALLOWED`, so a client can never set its own role.
- **AC-3**: Before email verification, credentials sign in returns `403` with body `{ code: "EMAIL_NOT_VERIFIED", status: 403 }`. After the logged verification link is opened, the same sign in returns `200` and a session cookie.
- **AC-4**: `POST /auth/forget-password` accepts an email and logs a reset URL and token. `POST /auth/reset-password` with that token changes the password, after which the old password fails with `401` and the new password succeeds.
- **AC-5**: A Google sign in whose email belongs to an already verified credentials user adds a `google` `Account` to that user and does not create a second `User` or a second `Session` owner.
- **AC-6**: `GET /auth/get-session` returns the user id, email, name, and role for a valid session cookie, and `null` without one. `Session.expiresAt` is exactly 7 days after creation and is not extended by activity. The session cookie is named `better-auth.session_token`, with the `__Secure-` prefix when cookies are secure.
- **AC-7**: Every application route not marked `@AllowAnonymous()` returns `401` with a JSON body without a valid session. `GET /` stays public and returns `Hello World!`.
- **AC-8**: `GET /admin/ping` decorated with `@Roles(['admin'])` returns `403` for a participant session and `200` for an admin session.
- **AC-9**: The seed script sets `role = "admin"` for the existing user whose email matches `ADMIN_EMAIL` case insensitively, creates no users, and reports the same result when run twice. With no matching user it logs a warning and changes nothing.
- **AC-10**: `POST /auth/sign-in/email` returns `429` with the Better Auth JSON error after 3 requests in 10 seconds from one address, and the Arcjet limiter still returns `429` with body `{ code: "ARCJET_RATE_LIMIT" }` after 100 requests in 60 seconds. The two are distinguishable by body, not by status code.
- **AC-11**: Two migrations apply cleanly to the empty `hackathon` database. `add_auth_identity` creates `User`, `Session`, `Account`, and `Verification`; `drop_legacy_user_columns` removes `username`, `password`, `login_fail_attempts`, and `lockoutUntil`. `Applications` keeps its required `applier` foreign key with cascade delete, and `prisma generate` succeeds.
- **AC-12**: Startup fails with a message naming the missing variable when `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, or `GOOGLE_CLIENT_SECRET` is absent. `ADMIN_EMAIL` is not required at startup.
- **AC-13**: A denied Google consent or an invalid OAuth state redirects with an `error` query parameter and sets no session cookie.
- **AC-14**: `POST /auth/sign-out` clears the session cookie, and the previous token returns `null` from `GET /auth/get-session` and `401` from a protected route.
- **AC-15**: Arcjet runs before the session check on application routes. A request that Shield denies without a cookie returns the Arcjet `403`, not the auth `401`. Shield still inspects JSON bodies after the Nest body parser is disabled.
- **AC-16**: `/auth/*` requests never produce an Arcjet decision. A burst above 100 auth requests is limited only by Better Auth, and no response carries the Arcjet error body.
- **AC-17**: A Google sign in whose email belongs to a local credentials user that is **not** verified returns an error and creates no second user and no linked account.

## Options considered

### Option 1: Better Auth with the Nest module

Use Better Auth 1.7 with `@thallesp/nestjs-better-auth` 2.8. The module mounts the auth handler, re-adds body parsers, and exports a guard plus `@AllowAnonymous`, `@OptionalAuth`, `@Session`, and `@Roles`.

**Pros**:
- Keeps Better Auth's supported routes and session behavior, including the admin plugin.
- Handles the body parser ordering that breaks hand mounted auth handlers in Nest.
- The guard and decorators follow the project's dependency injection rules.

**Cons**:
- Adds a community package that must track Better Auth and Nest releases.
- Its global guard is registered for us, so this spec disables it and registers both guards explicitly.

### Option 2: Better Auth with a custom thin Nest module

Build an `AuthModule` and `AuthController` that mount the Better Auth handler by hand, disable the Nest body parser, and register a custom guard.

**Pros**:
- One dependency fewer.
- Full control over route registration and guard order.

**Cons**:
- The team owns body parser ordering, session extraction, role checks, and their tests.
- Easy to expose a route by accident or break the OAuth callback during refactors.

### Option 3: Hosted identity provider

Use a managed provider such as Clerk, Auth0, or Supabase Auth instead of hosting the auth tables in the project database.

**Pros**:
- Managed security updates, hosted sign in screens, and less auth code.
- Mature account recovery and provider management.

**Cons**:
- A new vendor and cost, and user data leaves the project database.
- Contradicts the requirement to write the user schema and migrate it with Prisma.
- Adds a second source of truth for users next to `Applications.applier`.

## Decision

**Chosen option**: Option 1: Better Auth with the Nest module.

Use Better Auth 1.7 with `@thallesp/nestjs-better-auth` 2.8, the Prisma adapter over the existing `PrismaService`, the admin plugin for roles, and the Prisma schema as the source of truth. Keep the admin plugin even though a plain role column would be smaller, because the team chose its `@Roles` support, default role handling, and future ban and impersonation paths. Disable its global guard and register it explicitly so guard order is named in code, not left to import order.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `.agents/skills/better-auth-security-best-practices/`) · `create-auth` (`better-auth/skills`, `.agents/skills/create-auth/`) · `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `prisma-upgrade-v7` and `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-upgrade-v7/`) · `postgres-patterns` (`affaan-m/ecc`, `.agents/skills/postgres-patterns/`)

## Rationale

Better Auth is the right fit because the engineer already chose it, the secret and Google credentials already exist, and version 1.7 declares Prisma 7 support. Keeping users in the project database preserves the `Applications.applier` relation without a second identity store. The Nest module is chosen over a hand mounted handler because body parser ordering is a known failure point in Nest, and the module already implements the guard and role decorators this feature needs. A hosted provider would remove code, but it would move identity out of Postgres and conflict with the explicit requirement to migrate the user schema with Prisma.

## Feature design

**Data model sketch**:

| Entity | Key fields | Constraints |
|---|---|---|
| User | id, name, email, emailVerified, image, role, banned, banReason, banExpires, createdAt, updatedAt | email unique, role default `participant`, no `username` |
| Session | id, token, expiresAt, ipAddress, userAgent, impersonatedBy, userId, createdAt, updatedAt | token unique, userId FK to User with cascade delete |
| Account | id, accountId, providerId, userId, password, accessToken, refreshToken, idToken, accessTokenExpiresAt, refreshTokenExpiresAt, scope, createdAt, updatedAt | `(providerId, accountId)` unique, userId FK to User with cascade delete |
| Verification | id, identifier, value, expiresAt, createdAt, updatedAt | index on identifier |
| Applications | existing fields, applier | applier required, FK to User.id with cascade delete, unchanged |

`role` is a string, not a Prisma enum, because the admin plugin writes lowercase `participant` and `admin`. `username` is dropped: nothing manages it without the separate username plugin, and the plugin is not part of this slice. `name` covers display. The legacy `password`, `login_fail_attempts`, and `lockoutUntil` columns are dropped. Better Auth stores credential hashes in `Account.password` and applies its own limits.

**Prisma also needs**:
- `User.updatedAt` and the timestamps on the three new models use `@updatedAt`, so Prisma maintains them.
- Model names stay `User`, `Session`, `Account`, and `Verification`, with no `@@map`, matching Better Auth's default `modelName` values (`user`, `session`, `account`, `verification`). The adapter lowercases the first letter and reads `prisma.user`, and the existing table name `User` is preserved.
- The generated client is imported from `src/generated/prisma/client.js`, which is already configured and ignored by git.

**State transitions**:
- Verification: `emailVerified = false` to `true` when the logged link is opened. A Google account starts at `true`.
- Session: active while `expiresAt` is in the future. Sign out deletes the row.
- Role: `participant` on every Better Auth user create. The seed script changes it to `admin` through Prisma.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/auth/sign-up/email` | POST | name, email, password | `200`, user, `token: null`, no session cookie | public | 400 invalid, 409 duplicate, 429 |
| `/auth/sign-in/email` | POST | email, password | `200`, user, session cookie | public | 401 bad credentials, 403 `EMAIL_NOT_VERIFIED`, 429 |
| `/auth/sign-in/social` | POST | provider `google`, `callbackURL`, `errorCallbackURL` | redirect URL | public | 400 provider error, 429 |
| `/auth/callback/google` | GET | code, state | redirect with session cookie | public | redirect with `error` |
| `/auth/get-session` | GET | session cookie | user and session, or `null` | optional | none |
| `/auth/sign-out` | POST | session cookie | `200`, cookie cleared | authenticated | 401 |
| `/auth/send-verification-email` | POST | email | `200` | public | 429 |
| `/auth/verify-email` | GET | token | redirect to `${CLIENT_URL}/login?verified=true` | public | 400 invalid or expired |
| `/auth/forget-password` | POST | email, `redirectTo` | `200` generic | public | 429 |
| `/auth/reset-password` | POST | token, newPassword | `200` | public | 400 invalid or expired, 429 |
| `/auth/admin/*` | GET, POST | plugin inputs | plugin outputs | admin, enforced by the plugin | 401, 403 |
| `GET /admin/ping` | GET | none | `{ ok: true }` | admin via `@Roles` | 401, 403 |
| `/` | GET | none | `Hello World!` | public via `@AllowAnonymous` | none |
| any other application route | any | none | route result | authenticated | 401 |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Sign up | role `participant` | `User.role` default plus a create hook, never the request body |
| Sign up or Google callback | user id | generated by Better Auth |
| Sign in | session cookie and token | `Session.token` in cookie `better-auth.session_token` |
| Session expiry | absolute end time | `Session.expiresAt`, from `session.expiresIn` of `604800` seconds |
| Verification link | URL and token | `emailVerification.sendVerificationEmail` receives `{ user, url, token }` |
| Verification return | redirect target | `${CLIENT_URL}/login?verified=true`, written into the link's `callbackURL` by `withVerifiedReturn` |
| Password reset link | URL and token | `emailAndPassword.sendResetPassword` receives `{ user, url, token }` |
| Password reset return | redirect target | `redirectTo` sent by the caller, default `${BETTER_AUTH_URL}/` |
| Google sign in | provider identity | OAuth code exchanged by Better Auth, stored as `Account.providerId = "google"` |
| Credentials sign in | password check | `Account.password`, never returned |
| OAuth failure | error redirect | `errorCallbackURL` sent by the caller, plus `error` in the query |
| Admin role | admin identity | `ADMIN_EMAIL` and `prisma/seed.ts` |
| Rate limit | allow or deny | Better Auth `customRules` in memory, or Arcjet `fixedWindow` |

**Session configuration**:
- `expiresIn: 604800` (7 days).
- `updateAge: 0`, so activity never extends `expiresAt` and AC-6 is deterministic.
- `cookieCache` is not enabled. A role change is therefore visible on the next request, which AC-8 depends on after a seed promotion.
- Default cookie settings are kept: httpOnly, same site lax, `secure` when `BETTER_AUTH_URL` is https or `NODE_ENV` is production.
- Default cookie names are kept: `better-auth.session_token` and `__Secure-better-auth.session_token`.

**Rate limiting**:
- `rateLimit` is set explicitly with `enabled: true` (Better Auth disables it in development by default), `window: 60`, `max: 100`, `storage: "memory"`.
- `customRules` apply to `"/sign-in/email"` and `"/sign-up/email"` at 3 requests per 10 seconds, and to `"/forget-password"` and `"/reset-password"` at 3 requests per 60 seconds.
- Arcjet keeps its 100 requests per 60 seconds fixed window on application routes.
- The Arcjet rate limit response changes to a JSON body `{ statusCode: 429, code: "ARCJET_RATE_LIMIT", message: "Too many requests" }`. Better Auth returns its own JSON error. This is what makes AC-10 assertable.

**Request pipeline and guard order**:
- `main.ts` sets `bodyParser: false`, and `AuthModule.forRoot` re-adds the JSON and urlencoded parsers. The flag is global and permanent for this app, so any future multipart or raw body route must register its own parser.
- `AuthModule.forRoot` receives `disableGlobalAuthGuard: true`. `AppModule` then registers both global guards in one `providers` array, Arcjet first, then the exported `AuthGuard`. Order is then explicit in code rather than implied by import order, which satisfies AC-15.
- `/auth/*` routes are mounted as Express middleware by the module. Nest guards, pipes, and parameter decorators never run on them, so Arcjet does not evaluate them at all (AC-16), and `ValidationPipe` does not validate them. Better Auth validates its own inputs.
- `@Roles(['admin'])` therefore applies only to application controllers such as `GET /admin/ping`. The admin plugin enforces its own `/auth/admin/*` routes inside its handler.
- The global `ValidationPipe` is added in `main.ts` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true` when the first DTO backed controller is added. It does not touch auth routes.

**Email flows**:
- `AuthMailService` takes a `VerificationMail` or `ResetMail` payload and logs the recipient, the URL, and the raw token with the Nest `Logger`. Tokens are logged because the repo has no mail provider in local development, so the only way to follow a link without one is the log; tests parse them from there or from an injected spy.
- `emailVerification.sendOnSignUp: true` and `sendOnSignIn: true` are required, because `sendOnSignUp` defaults to false and AC-3 depends on the link existing.
- `emailVerification.autoSignInAfterVerification` stays false, so AC-3 proves the sign in step.
- `emailAndPassword.requireEmailVerification: true`, `minPasswordLength: 8`, `maxPasswordLength: 128`.
- Verification and reset tokens are signed JWTs, so they are **not** rows in `Verification`. The `Verification` table still has to exist because Better Auth's schema check requires it, but these two flows leave it empty. The only copy of the token is the logged link, which is why `AuthMailService` logs it.
- Sign up sends its own default `callbackURL` of `/`, which overrides the static `emailVerification.callbackURL` option. `withVerifiedReturn` rewrites that query parameter to `${CLIENT_URL}/login?verified=true` before the mail is sent, so the link returns to the SPA login page, which explains the confirmed state.

**Account linking**:
- `account.accountLinking.enabled: true` with `trustedProviders: ["google"]`.
- Linking only happens when the local user is already `emailVerified = true`. An unverified local user produces an error instead (AC-17), so the test matrix includes that case.

**Configuration validation**:
- `ConfigModule.forRoot` gains a `validate` function in `src/config/env.validation.ts`. It checks `BETTER_AUTH_SECRET` (minimum 32 characters), `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the already required `ARCJET_KEY`, and throws an `Error` naming the first missing or invalid key so bootstrap fails loudly (AC-12).
- `ADMIN_EMAIL` is optional there, because only the seed script reads it, and the seed fails on its own when it is absent.

**`createAuth` wiring**:
- Signature: `createAuth(prisma: PrismaService, config: ConfigService, mail: AuthMailService): Auth`.
- The adapter is `prismaAdapter(prisma, { provider: "postgresql", transaction: true })`, using the existing `PrismaService` instance (it already extends the generated `PrismaClient` built on `PrismaPg`), so no second connection pool is created.
- `PrismaModule` is `@Global()`, so `PrismaService` resolves inside `AuthModule.forRootAsync` without an extra import.
- Mail is injected through the exported `AUTH_MAIL` token provided by `AuthMailModule`, so the auth factory depends on an interface, not a concrete class.
- `baseURL` and `secret` come from `ConfigService` (`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`), `basePath` is `/auth`. `trustedOrigins` is `[BETTER_AUTH_URL, ...CLIENT_URL]`, because the SPA runs on a different port and Better Auth rejects a flow whose origin is not listed.

**Migration sequence**:
1. `add_auth_identity`: create `Session`, `Account`, and `Verification`, and add the new `User` columns while the legacy ones still exist. The database is empty, so no rows need backfilling.
2. `drop_legacy_user_columns`: drop `username`, `password`, `login_fail_attempts`, and `lockoutUntil`.
- `Applications` is not restructured. Its `applier` stays required with `onDelete: Cascade`, which matches the invariant that an application cannot exist without its applicant.
- `prisma migrate dev` may ask to reset because the local database has no migration history. That is expected on the first run and is safe here.

**Seed mechanics**:
- `prisma/seed.ts` imports `dotenv/config` itself (Prisma 7 no longer loads `.env` for seed scripts), builds its own `PrismaClient` with `new PrismaPg({ connectionString: process.env.DATABASE_URL })`, and calls `$disconnect` at the end.
- It reads `ADMIN_EMAIL`, exits with a clear message when absent, and runs `user.updateMany({ where: { email: { equals: email, mode: "insensitive" } }, data: { role: "admin" } })`.
- It logs the updated count. Zero matches logs a warning and changes nothing. Running it twice produces the same state (AC-9).
- It is registered as `migrations.seed: "tsx prisma/seed.ts"` in `prisma7.config.ts`, so `prisma db seed` works, plus a `prisma:seed` package script.

**Key invariants**:
- Every user has exactly one role, `participant` or `admin`, and every user created through Better Auth starts at `participant`.
- The role is never accepted from a request body, and only the seed script changes it in this slice.
- Email is unique across users, and `(providerId, accountId)` is unique across accounts.
- Password hashes exist only in `Account.password` and never appear in a response.
- Credentials passwords are between 8 and 128 characters.
- Deleting a user cascades to sessions, accounts, and applications.
- Admins are decided by `user.role === "admin"` on application routes and by the plugin on `/auth/admin/*`.
- Secrets are read from configuration only and never committed.

**Security model**:
- Public routes: sign up, sign in, OAuth callback, verification, password reset, and `GET /`.
- Authenticated routes: session read, sign out, and every application route without `@AllowAnonymous`.
- Admin routes: `GET /admin/ping` plus every `/auth/admin/*` route.
- Origin checking stays enabled, with `trustedOrigins` set to `BETTER_AUTH_URL` plus the `CLIENT_URL` origins.
- CORS is enabled with an explicit origin list from `CLIENT_URL` and `credentials: true`, which a wildcard cannot satisfy. The server defaults to the Vite dev origins when the variable is unset.
- Session cookies are httpOnly, same site lax, and secure in production.
- Account linking is allowed only for the Google provider, and only for an already verified local user.
- Password reset responses are generic, so they do not reveal whether an email exists.
- `/auth/*` relies on Better Auth limits only, because Nest guards do not see middleware routes. This is a known gap, recorded in Follow-up.
- Role changes by the seed script are logged. No regulated compliance scope such as payments or health data is involved.

**Configuration required**:
- `BETTER_AUTH_SECRET`: signs sessions and tokens, 32 characters minimum (already present).
- `BETTER_AUTH_URL`: public base URL, `http://localhost:3000` (already present).
- `GOOGLE_CLIENT_ID`: Google OAuth client (already present).
- `GOOGLE_CLIENT_SECRET`: Google OAuth secret (already present).
- `DATABASE_URL`: PostgreSQL connection to `hackathon` (already present).
- `ARCJET_KEY`: existing Arcjet key, now validated at startup (already present).
- `ADMIN_EMAIL`: email of the first administrator, read only by the seed script (new).
- `ARCJET_MODE`: `DRY_RUN` for the local auth test runs, `LIVE` otherwise (already used by the guard).

**Critical test scenarios** (each maps to an acceptance criterion in Requirements):
- Happy path: Google sign in creates a participant with a verified email and a protected route succeeds, verifies **AC-1**, **AC-6**, **AC-7**
- Happy path: credentials sign up returns no cookie, then verify, then sign in succeeds, verifies **AC-2**, **AC-3**
- Happy path: forgot password, reset, old password fails, new password succeeds, verifies **AC-4**
- Happy path: Google sign in with an existing verified email links the account, verifies **AC-5**
- Happy path: sign out clears the cookie and the old token stops working, verifies **AC-14**
- Failure case: Google consent denied or invalid state returns an error redirect with no session, verifies **AC-13**
- Failure case: Google sign in against an unverified local user errors and does not link, verifies **AC-17**
- Failure case: `role: "admin"` in the sign up body is stored as participant, verifies **AC-2**
- Failure case: 4 sign in attempts in 10 seconds return `429`, and an Arcjet burst returns the Arcjet body, verifies **AC-10**
- Failure case: auth burst above 100 requests never returns the Arcjet body, verifies **AC-16**
- Failure case: missing auth environment variable stops startup with a message naming it, verifies **AC-12**
- Auth/permission: participant gets `403` on `GET /admin/ping` while admin gets `200`, verifies **AC-8**
- Auth/permission: no cookie returns `401`, `GET /` returns `200`, verifies **AC-7**
- Auth/permission: Shield denied request without a cookie returns the Arcjet `403`, and a JSON body attack is still caught, verifies **AC-15**
- Operations: seed runs twice with the same result, verifies **AC-9**
- Operations: both migrations apply to the empty database and the client generates, verifies **AC-11**

## Build plan

The project has no recorded delivery approach, so this plan defaults to end to end slices. Each slice leaves the app runnable and verifiable before the next thickens it.

1. [x] Install `better-auth@^1.7.19`, `@thallesp/nestjs-better-auth@^2.8.0`, and `tsx` as a development dependency, using `--legacy-peer-deps` because `@arcjet/nest` declares a peer range below Nest 12. Satisfies **AC-1**, **AC-9**
2. [x] Rewrite `prisma/schema.prisma` per the data model, then run `prisma migrate dev --name add_auth_identity` and `prisma migrate dev --name drop_legacy_user_columns` against `hackathon`, then `prisma generate`. Satisfies **AC-11**. Note: `prisma migrate dev` did **not** regenerate the client here, which left a stale `_runtimeDataModel` and every auth request failing with `SCHEMA_MISMATCH`. Run `prisma generate` explicitly after any schema change.
3. [x] Add `src/config/env.validation.ts` and wire it into `ConfigModule.forRoot`. Satisfies **AC-12**
4. [x] Create `src/auth/auth.mail.ts` with the `AUTH_MAIL` token, the payload types, and `AuthMailService` that logs URL and token, plus `AuthMailModule` exporting both. Satisfies **AC-3**, **AC-4**
5. [x] Create `src/auth/auth.config.ts` with `createAuth(prisma, config, mail)`: Prisma adapter with `transaction: true`, base path `/auth`, Google provider, email and password with verification required and reset enabled, `sendOnSignUp`, `sendOnSignIn`, `callbackURL`, account linking limited to Google, admin plugin with `defaultRole: "participant"` and `adminRoles: ["admin"]`, a `databaseHooks.user.create.before` that forces `role = "participant"`, pinned session values, explicit rate limit rules, and trusted origins. Satisfies **AC-1** to **AC-6**, **AC-10**, **AC-13**, **AC-17**
6. [x] Create `src/auth/auth.module.ts` using `AuthModule.forRootAsync` with `disableGlobalAuthGuard: true`, injecting `PrismaService`, `ConfigService`, and `AUTH_MAIL`. Satisfies **AC-15**
7. [x] Wire `AuthModule` into `AppModule`, register `APP_GUARD` as Arcjet then `AuthGuard`, set `bodyParser: false` in `main.ts`, and change the Arcjet rate limit throw to the JSON body. Satisfies **AC-10**, **AC-15**, **AC-16**
8. [x] Mark `GET /` with `@AllowAnonymous()` and add `GET /admin/ping` with `@Roles(['admin'])`. Satisfies **AC-7**, **AC-8**
9. [x] Add `prisma/seed.ts`, the `migrations.seed` entry in `prisma7.config.ts`, and a `prisma:seed` script. Satisfies **AC-9**
10. [ ] Add unit tests for `AuthMailService`, `createAuth`, and the env validator, plus end to end tests for public, protected, role, verification, reset, linking, unverified link, rate limit, guard order, and auth burst behavior. Satisfies **AC-1** to **AC-17**. This is the `/test` step; only the Arcjet guard unit test exists so far.
11. [x] Add `ADMIN_EMAIL` to `.env.example`, run `npm run lint`, `npm run build`, and `npm test` (all green), and drive the whole credentials flow against a running server: sign up, verification, sign in, participant refused `/admin/ping`, seed promotion, admin allowed, sign out, and the sign in rate limit. Satisfies **AC-2**, **AC-3**, **AC-6** to **AC-10**, **AC-14**. Still open: update the Google console redirect URI and confirm one live Google callback, which needs a browser (AC-1, AC-5, AC-13, AC-17).

## Consequences

**Positive**:
- One supported integration provides sessions, OAuth, credentials, verification, reset, and role checks.
- Identity data stays in the project database and keeps the `Applications.applier` relation.
- Default protection means a new route is private unless someone marks it public.
- Guard order is explicit in `AppModule`, so a route cannot silently lose Arcjet protection.
- Every role value has one authority, and a client cannot choose its own.

**Negative / tradeoffs**:
- Email delivery is only a log line until a real provider is added, so verification and reset do not work for real users yet.
- The Nest integration package is a community dependency that must track Better Auth and Nest releases.
- The admin plugin brings ban fields, impersonation, and `/auth/admin/*`, which this slice does not use.
- `/auth/*` bypasses Nest guards entirely, so Arcjet Shield, bot detection, and the Arcjet rate limit do not cover auth endpoints.
- Better Auth's rate limit storage is in memory, so limits are per process if the app scales horizontally.
- Better Auth cannot resolve a client IP when the server is reached directly, with no proxy header. It warns and falls back to one shared bucket per path, so every client shares the sign in and sign up allowance. Behind a proxy that forwards a real client address the limit is per client, which is how it should be deployed.
- Verification and reset tokens are signed JWTs that exist only in the logged link. Losing the log means the user must request a new link.
- `bodyParser: false` is global and permanent, and Arcjet Shield body inspection now depends on parsers registered by the auth module.
- Password hashes live in a table this slice adds, so losing the database means losing every password.
- The Google console redirect URI must change before Google sign in can succeed.

**Neutral**:
- `GET /` becomes explicitly public instead of implicitly open.
- Four identity tables are added and four legacy user columns are dropped, which is safe because `hackathon` is empty.
- The seed script adds a manual operations step before the first admin exists.
- `username` is gone, so a future username feature needs the username plugin and a new migration.

## Follow-up

- [ ] Replace the logging `AuthMailService` with a real email provider before any public deployment.
- [ ] Add `http://localhost:3000/auth/callback/google` to the Google Cloud console authorized redirect URIs.
- [ ] Consider applying Arcjet as Express middleware ahead of the auth mount, so Shield and the rate limit also cover `/auth/*`.
- [ ] Move Better Auth rate limit storage to PostgreSQL or Redis when the API runs more than one instance.
- [ ] Configure `advanced.ipAddress` so Better Auth reads a real client address from the proxy, once one is in front of the API. Until then its rate limiter uses one shared bucket per path.
- [ ] Run `prisma generate` in the deploy and migration pipeline, because `prisma migrate dev` did not refresh the client.
- [ ] Add the installed skills (`better-auth-security-best-practices`, `nestjs-best-practices`, the Prisma suite, and `postgres-patterns`) to the `## Agent skills` section of `AGENTS.md`, and record the declined MCP servers in its `Declined:` line.
- [ ] Design admin user management (list, ban, set role) in a later spec.
- [ ] Revisit the `401` JSON behavior if a browser front end is added to this repository.
- [ ] Decide whether a username feature is wanted; it needs the username plugin and a schema change.
