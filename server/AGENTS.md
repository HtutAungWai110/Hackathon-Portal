# AGENTS.md

Project instructions for AI agents working in this repository. Read this file before every
task. Follow it over default habits.

## Role

Act as a **senior NestJS developer**. That means:

- Design with Nest modules, providers, and dependency injection, not ad hoc globals.
- Prefer small, focused classes with one clear responsibility.
- Keep controllers thin. Business logic lives in providers or services.
- Handle errors with Nest exceptions (`BadRequestException`, `NotFoundException`,
  `ConflictException`, and so on), not raw `throw new Error`.
- Validate all external input at the boundary with DTOs.
- Write TypeScript with `strict` on and no `any` unless there is no alternative.
- Think about testability first. If a class is hard to test, the design is wrong.

If a request conflicts with these rules, say so and propose the Nest way before writing code.

## Skills

Skills live in `.agents/skills/`. Load one **only when the task actually needs it**. Do not
preload skills, do not stack skills, and do not invoke one for a trivial edit.

| Skill | Load it when |
| --- | --- |
| `scope` | Planning a product slice or deciding what to build next. |
| `architect` | A load bearing technical decision is unmade (stack, storage, auth, provider). |
| `develop` | Building a feature, endpoint, service, or data slice from an approved design. |
| `test` | Writing tests for code that was just built or changed. |
| `debug` | A test fails or behavior is wrong and the root cause is unknown. |
| `check` | Verifying behavior against a spec, or running a pre PR code review. |
| `audit` | Bootstrapping or repairing project context and docs. |
| `document` | Writing a PR description, changelog, release note, or postmortem. |
| `sync` | Updating AGENTS.md and scope after a change lands. |

Every skill in `.agents/skills` is listed above. If a skill is not in this table, it does not
exist for this project and must not be invoked.

Rules for skills:

1. Check the task against the table. If no row matches, skip skills entirely.
2. Read the skill's `SKILL.md` before doing its work. Do not improvise a partial version.
3. A skill's own instructions win for the scope of that task, except where they conflict with
   the NestJS standards below. Code standards always win.
4. Report which skill you used and why, in one line.

## NestJS code standards

### Dependency injection

- **Never instantiate a provider manually.** No `new AppService()`, no `new HttpClient()`, no
  `new Repository()` inside application code.
- **Always use constructor injection.** Declare dependencies as `private readonly`
  constructor parameters and let the Nest container resolve them.

```ts
// Correct
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
  ) {}
}

// Never
@Injectable()
export class UsersService {
  private readonly usersRepository = new UsersRepository();
}
```

- Use `@Inject(TOKEN)` only for non class providers (interfaces, config values, factories).
- Do not reach into the container with `ModuleRef` or `app.get()` inside business code. That is
  a service locator and it hides dependencies. `app.get()` is allowed only in bootstrap and
  tests.
- Provide every dependency in a module. Export a provider only when another module needs it.
  Import the module that owns it rather than redeclaring it.
- Use `forwardRef` only for real circular dependencies. A circular dependency usually means the
  design needs splitting.
- Use custom provider tokens with `useClass`, `useFactory`, or `useValue` for swappable
  implementations. Never branch on environment inside a class to pick its own dependency.

### Structure

- One feature, one module: `<feature>.module.ts`, `<feature>.controller.ts`,
  `<feature>.service.ts`, plus `dto/` and `entities/` where needed.
- Controllers only parse input, call one service method, and return the result. No data access.
- Services own business rules. Repositories or clients own transport and persistence.
- Put cross cutting concerns in guards, interceptors, pipes, or filters. Do not repeat the same
  check in every handler.
- Use `ConfigModule` and `ConfigService` for settings. Never read `process.env` directly outside
  bootstrap or a config factory.
- Use DTO classes with `class-validator` and `class-transformer` for request bodies, query
  parameters, and params. Enable `ValidationPipe` with `whitelist: true`,
  `forbidNonWhitelisted: true`, and `transform: true` in `main.ts`.
- Set a global prefix such as `api` and keep route versions explicit when the API is public.
- Keep environment specific values out of code. Fail fast at startup when a required variable is
  missing.

### TypeScript and imports

- This project is ESM (`"type": "module"`). Use `import` only, and keep relative import
  extensions as the build requires (`.js` for compiled output).
- `strict` is on. Avoid `any`, `@ts-ignore`, and non null assertions as shortcuts. Use `unknown`
  and narrow it.
- Prefer `readonly` for injected dependencies and immutable fields.
- Async code always awaits or returns. Never leave a floating promise.

### Testing

- Use Vitest, which is the test runner here. Do not add Jest.
- Unit tests colocate as `*.spec.ts` beside the source. End to end tests live in `test/` as
  `*.e2e-spec.ts`.
- Build test modules with `Test.createTestingModule`. Provide real providers or mocks through
  the DI container. Never construct the subject with `new` in a test either.
- Test behavior through the public surface. Mock at module boundaries, not inside the class
  under test.

## Nest CLI commands

Use the Nest CLI for scaffolding instead of hand creating files. Files must match what the
generator produces, including module registration.

```bash
# Scaffold
npx nest g module users
npx nest g controller users
npx nest g service users
npx nest g resource users          # full CRUD set with DTOs
npx nest g class users/dto/create-user.dto --no-spec
npx nest g guard auth
npx nest g interceptor logging
npx nest g pipe validation
npx nest g filter http-exception
npx nest g middleware logger
npx nest g decorator current-user
npx nest g interface users/user-repository

# Build and run
npm run build                      # nest build
npm run start                      # nest start
npm run start:dev                  # watch mode
npm run start:debug                # debug plus watch
npm run start:prod                 # node dist/main

# Quality
npm run lint                       # oxlint src/ test/
npm run format                     # prettier
npm run test                       # vitest run
npm run test:watch
npm run test:cov
npm run test:e2e
```

Rules for the CLI:

1. Use the generator that matches the artifact. Do not create a controller by hand when
   `nest g controller` exists.
2. Use `nest g resource` for a full CRUD feature. Use individual generators when you only need
   one piece.
3. Pass `--no-spec` only when a spec would be noise, and say why.
4. After scaffolding, read the generated files and fix imports and wiring. Generators are a
   starting point, not finished code.
5. Run `npm run lint`, `npm run build`, and the relevant tests before declaring a task done.

## Mail and the queue

Email is asynchronous. `src/mail/` owns it; auth only calls the `AUTH_MAIL` adapter in
`src/auth/auth.mail.ts`, which enqueues a job.

- Delivery runs on BullMQ, so Redis must be up: `docker compose up -d redis`. The API still
  boots without it, but no mail leaves and the reason is logged.
- The queue is a producer (`MailService.enqueue`) and a worker (`MailProcessor`) in the same
  app. Do not send SMTP from a request handler; enqueue.
- `ADMIN_EMAIL` plus `APP_PASSWORD` turn SMTP on, with Gmail defaults. Without both, the worker
  uses `LogMailTransport` and prints the link instead, which is the only path that logs one.
- Templates live in `mail.templates.ts` and are rendered on every attempt. A URL must go
  through `escapeHtml`; verification links contain `&`.
- Worker failures must reject so BullMQ retries. Enqueue failures are caught in
  `AuthMailService` on purpose: an account that was already created must not be reported as
  failed.
- BullMQ 6 does not bundle `ioredis`; it is a direct dependency. Installs in this repo need
  `--legacy-peer-deps` because `@arcjet/nest` still peers on Nest 10 and 11.

## Workflow

1. Read the relevant files before editing. Do not guess at existing behavior.
2. State the plan in one or two lines for non trivial changes.
3. Make the smallest change that fully solves the problem. No drive by refactors.
4. Never rewrite unrelated code, and never delete something you do not understand.
5. Run lint, build, and tests. Fix failures rather than reporting them as unrelated.
6. **After running tests or any verification that started background processes** (API servers, Redis-related workers started manually, headless browsers), stop them and free ports (e.g. `:3000`). Do not leave orphaned processes.
7. Summarize what changed and which skill, if any, you used.
