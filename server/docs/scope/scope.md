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
| 1 | Authentication & roles | Slice 1 | in-progress |

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

## Slice 1: Identity

### 1. Authentication & roles · in-progress
Google sign in and email plus password sign in, sessions, email verification, password reset, and the `participant` and `admin` roles, with every application route protected by default.
**Done when:** a new user can sign up or sign in and reach a protected route, a participant is refused an admin route, and the first admin is granted by a repeatable seed script.
- [x] Design it (spec): `/architect authentication & roles`
- [ ] Build it: `/develop authentication & roles`
   - [x] Schema, two migrations, generated client (AC-11)
   - [x] Auth config, mail service, module wiring, guard order (AC-1..6, 10, 13, 17)
   - [x] Public and admin routes (AC-7, 8)
   - [x] Admin seed script (AC-9)
   - [ ] Tests plus live Google check (AC-1..17)
- [ ] Verify it: `/check verify authentication & roles`
- [ ] Test it: `/test authentication & roles`

Spec 0001 in `docs/specs/0001-add-better-auth-with-roles.md` · code in `src/auth/`, `src/admin/`, `src/config/env.validation.ts`, `prisma/schema.prisma`, `prisma/seed.ts`

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
