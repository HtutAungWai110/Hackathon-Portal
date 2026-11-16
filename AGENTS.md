# AGENTS.md

This repository is two independent packages side by side. There is **no** root
`package.json`, workspace, or shared `node_modules`. Every command runs inside the package
directory.

| Path | What it is | Instructions |
| --- | --- | --- |
| `client/` | Vite + React 19 SPA | [`client/AGENTS.md`](client/AGENTS.md) |
| `server/` | NestJS API, Prisma, PostgreSQL | [`server/AGENTS.md`](server/AGENTS.md) |

Read this file, then the package file for the code you are about to touch. The package files
are authoritative for their own code. This file only routes and carries the facts that span
both.

## Which side do I change?

- UI, routes, forms, styling, data fetching, client state: `client/`.
- Endpoints, validation, authorization, persistence, migrations: `server/`.
- A feature that needs both: design the API contract first, then the server, then the client.

Do not put backend logic in the client to avoid an endpoint, and do not shape a response only
to suit one screen without saying so.

## Ports and wiring

- API: `http://localhost:3000`. There is no global route prefix, so routes are `/auth/*`,
  `/session/*`, `/admin/*`, and whatever a feature module declares.
- SPA: `http://localhost:5173` (`client` `npm run dev`). `http://localhost:5137` is allowed
  too, in case Vite picks that port.
- CORS is enabled with `credentials: true` for the origins in the server's `CLIENT_URL`
  (comma separated, defaults to both Vite ports). Better Auth requires the same origins in
  `trustedOrigins`, so a new origin has to be added in both places or auth calls fail with
  `INVALID_ORIGIN`.

## Authentication facts that are easy to get wrong

- Auth is **Better Auth**, mounted as middleware at `/auth`. It parses its own bodies. Nest
  guards, pipes, interceptors, and `@Roles` never see `/auth/*` requests. Do not add a
  controller or service to "wrap" it. The token routes live beside it at `/session/*` because
  `/auth/*` is swallowed by that middleware.
- Better Auth is only the identity provider. After it confirms a sign in, Nest mints a
  15 minute access JWT and a 7 day refresh JWT (`server/src/auth/session/`). Application
  routes accept **only** `Authorization: Bearer <accessToken>`; the Better Auth session cookie
  is not a second way into the API.
- Both tokens are cookies. `access_token` is `httpOnly: false` on path `/` so the SPA can copy
  it into the header; `refresh_token` is `httpOnly` on path `/session` and is read only by
  `POST /session/refresh`. Never put a token in `localStorage`.
- A `401` from an app route means the access token is missing or expired: the client calls
  `POST /session/refresh` once, then retries once. `403` means signed in without permission
  (or banned); do not treat it as an expired session.
- Cookies are shared across ports on `localhost`, so the SPA on `:5173` and the API on `:3000`
  see the same jar. Client `fetch` calls still need `credentials: 'include'`.
- Roles are `participant` (every sign up defaults here) and `admin`. The server enforces
  authorization, and the JWT guard loads the user row on every request so a role change or ban
  takes effect on the next call rather than at token expiry.
- Sign up mints no tokens, because the email is not verified. Sign in is the first moment a
  token pair exists. The SPA exchanges the Better Auth cookie at `POST /session/exchange`.
- Verification links return to `${CLIENT_URL}/login?verified=true` on the SPA, which shows the
  confirmed state before the form.
- Google sign in is not verified end to end. The Google console redirect URI must be
  `http://localhost:3000/auth/callback/google`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are required, at least 32 characters each.
  Rotating either signs every user out.

## Server gotchas that cost hours

- After editing `server/prisma/schema.prisma`, run `npx prisma generate`. `prisma migrate dev`
  does not reliably regenerate the client, and a stale client shows up as `SchemaMismatchError`
  at runtime, not at build time. Migrations also need `--config prisma7.config.ts`.
- `bodyParser: false` is set globally in `server/src/main.ts` because Better Auth installs its
  own parsers. Any new raw or multipart route must add its own parser.
- Specs live in `server/docs/specs/`, scope and milestones in `server/docs/scope/`. Update them
  when behavior changes; they are the record of why things are the way they are. The token
  layer is spec 0002, which amends 0001.
- Event images are written to `server/bucket/event_images/` (contents gitignored) and served at
  `/bucket/...` by `useStaticAssets`. Both sides derive the path from the process working
  directory, so the API must be started from `server/`. `POST /admin/uploads/event-images` is
  the multipart route, and multer supplies its own parser.
- Email is queued through BullMQ, so the mail worker needs Redis: `docker compose up -d redis`
  in `server/`. Without it, signup still works but no message leaves. BullMQ 6 does not bundle
  `ioredis`, so it is an explicit dependency.
- Adding a server dependency needs `--legacy-peer-deps`: `@arcjet/nest@1.15` peers on
  `@nestjs/common ^10 || ^11` while this project runs Nest 12.

## Commits, pushes, and the README

`README.md` is the public record of how this repository is laid out. It carries the package
table, the directory tree, the client feature folders and routes, the server modules, the API
surface, the data model, the local setup steps, and the environment variables.

When the user asks to **commit and push at the end of a session**, update `README.md` first, in
the same commit. Re-read the tree and the routes rather than trusting what the README already
says:

1. Compare `README.md` against the code being committed. Add, rename, or remove any folder,
   route, endpoint, script, migration step, or environment variable that changed. Correct drift
   even when the current session did not cause it.
2. Only then stage: `git add -A` at the repository root.
3. Commit with a message that covers the whole change, not just the last step.
4. Push to the branch the work is on, and report the commit hash and the push result.

A commit that changes structure without changing the README is incomplete. Do not push code
that the README no longer describes.

## Workflow

1. Read the files you are about to change and the matching package `AGENTS.md`. Do not guess.
2. State the plan in one or two lines before a non-trivial change.
3. Make the smallest change that solves the problem. No drive-by refactors.
4. Never delete or rewrite something you do not understand.
5. Verify in the package you touched: `npm run lint` and `npm run build`, plus tests where they
   exist. If you touched both, check both.
6. Report what changed, and which skill you used, if any.
7. On a commit and push request, follow "Commits, pushes, and the README" above before staging.
