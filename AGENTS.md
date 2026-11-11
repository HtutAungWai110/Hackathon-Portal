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
  `/admin/*`, and whatever a feature module declares.
- SPA: `http://localhost:5173` (`client` `npm run dev`). `http://localhost:5137` is allowed
  too, in case Vite picks that port.
- CORS is enabled with `credentials: true` for the origins in the server's `CLIENT_URL`
  (comma separated, defaults to both Vite ports). Better Auth requires the same origins in
  `trustedOrigins`, so a new origin has to be added in both places or auth calls fail with
  `INVALID_ORIGIN`.

## Authentication facts that are easy to get wrong

- Auth is **Better Auth**, mounted as middleware at `/auth`. It parses its own bodies. Nest
  guards, pipes, interceptors, and `@Roles` never see `/auth/*` requests. Do not add a
  controller or service to "wrap" it.
- Sessions are cookies, not a bearer token in `localStorage`. Client `fetch` calls need
  `credentials: 'include'`, and CORS must allow credentials.
- Roles are `participant` (every sign up defaults here) and `admin`. The server enforces
  authorization. The client hides UI for convenience only; never treat a hidden button as
  access control.
- Verification links return to `${CLIENT_URL}/login?verified=true` on the SPA, which shows the
  confirmed state before the form.
- Google sign in is not verified end to end. The Google console redirect URI must be
  `http://localhost:3000/auth/callback/google`.

## Server gotchas that cost hours

- After editing `server/prisma/schema.prisma`, run `npx prisma generate`. `prisma migrate dev`
  does not reliably regenerate the client, and a stale client shows up as `SchemaMismatchError`
  at runtime, not at build time. Migrations also need `--config prisma7.config.ts`.
- `bodyParser: false` is set globally in `server/src/main.ts` because Better Auth installs its
  own parsers. Any new raw or multipart route must add its own parser.
- Specs live in `server/docs/specs/`, scope and milestones in `server/docs/scope/`. Update them
  when behavior changes; they are the record of why things are the way they are.

## Workflow

1. Read the files you are about to change and the matching package `AGENTS.md`. Do not guess.
2. State the plan in one or two lines before a non-trivial change.
3. Make the smallest change that solves the problem. No drive-by refactors.
4. Never delete or rewrite something you do not understand.
5. Verify in the package you touched: `npm run lint` and `npm run build`, plus tests where they
   exist. If you touched both, check both.
6. Report what changed, and which skill you used, if any.
