# 0004 — Async email delivery

**Status:** implemented
**Amends:** [0001](0001-add-better-auth-with-roles.md) (email flows, AC-3, AC-4)

## Problem

Authentication depends on email that a person can open: a verification link before a new
account can sign in (AC-3) and a reset link before a forgotten password can be changed (AC-4).
The original implementation wrote both links to the server log. That is unusable for a real
deployment, and it also means the HTTP request waits for the mail provider, so a slow SMTP
server turns signup into a slow request.

## Decision

Delivery is asynchronous. The auth flow stores a job on a [BullMQ](https://docs.bullmq.io)
queue backed by Redis, and a worker in the same Nest process renders and sends it with
`nodemailer`. The request returns as soon as the job is stored.

```
Better Auth callback
  └─ AuthMailService (adapter, AUTH_MAIL)   ← same interface 0001 defined
       └─ MailService.enqueue()             ← producer, deadline-guarded
            └─ Redis · queue "mail"         ← job: { kind, to, url }
                 └─ MailProcessor (worker, concurrency 2)
                      ├─ renderMail()       ← templates, brand from config
                      └─ MailTransport      ← SMTP, or the log without credentials
```

### Why a queue and not a direct send

- A verification mail is not part of the signup transaction. A person can sign in once the
  message arrives, and can ask for another one; the account must not be rolled back because
  Gmail was slow.
- SMTP failures are transient far more often than not. BullMQ retries with backoff and keeps
  the exhausted job, which is a durable record that a message never left.
- Rendering happens in the worker on every attempt, so a template fix also applies to mail
  that is already queued.

### Job shape

```ts
type MailJobKind = 'verification' | 'password-reset';
interface MailJobData { kind: MailJobKind; to: string; url: string }
```

The raw URL is stored, not the rendered HTML. The link already carries the signed token, which
is the only copy that exists (0001), so it is treated as a secret: the queue entry is short
lived, and it is never logged when SMTP credentials are configured.

### Retry policy

| Setting | Value | Reason |
| --- | --- | --- |
| `attempts` | 5 | Covers a restart or a short provider outage |
| `backoff` | exponential, 5s | 5s, 10s, 20s, 40s between tries |
| `removeOnComplete` | 24h / 1000 | Enough to inspect a delivery, not a growing list |
| `removeOnFail` | 7 days | The job id in the log line points at it |
| worker concurrency | 2 | Mail must not compete with API traffic |

### Failure policy

- **Enqueue fails** (Redis away): `AuthMailService` logs the recipient and resolves. The
  account was already created and must not be reported as failed; the person can ask for
  another link. ioredis keeps the command in its offline queue, so a job attempted during a
  short outage is still stored when Redis returns.
- **Send fails**: the worker rejects, which is what triggers the retry. The `failed` event is
  logged with the job id and attempt count.
- **Redis is unreachable at runtime**: the worker's `error` event is handled and logged.
  Unhandled, that EventEmitter error would take the process down.
- **A request cannot wait forever**: `MailService` puts a 5 second deadline around `queue.add`,
  so a dead queue costs a logged error, not a hanging signup.

### Transport selection

`MailModule` picks the transport in one factory, so neither implementation reads the
environment:

- `SmtpMailTransport` when both `ADMIN_EMAIL` and `APP_PASSWORD` are set.
- `LogMailTransport` otherwise. It is a real transport, not a branch inside the worker, so the
  queue, retries, and templates are exercised in development exactly as in production. This is
  the only path that prints a link to the log.

### SMTP settings

`ADMIN_EMAIL` is both the SMTP user and the From address; `APP_PASSWORD` is a Google app
password, not the account password. The defaults assume Gmail.

| Variable | Default | Notes |
| --- | --- | --- |
| `ADMIN_EMAIL` | — | SMTP user, From address, and seed admin |
| `APP_PASSWORD` | — | Required with `ADMIN_EMAIL` to turn SMTP on |
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `465` | |
| `SMTP_SECURE` | port `465` → `true` | Implicit TLS; `587` defaults to STARTTLS |
| `MAIL_FROM_NAME` | `Hackathon Portal` | Subject brand and display name |
| `REDIS_URL` | `redis://localhost:6379` | `rediss://` turns on TLS |

### Templates

`renderMail()` produces the subject, a plain-text body, and an inline-styled HTML body in the
portal's dark and cyan palette. Both bodies carry the button and the raw link, because a
plain-text reader has no button. The URL and the brand are HTML-escaped; a verification URL
contains `&`, which an unescaped `href` would break.

### Redis requirement

BullMQ needs Redis 5 or newer. `server/docker-compose.yml` starts one:

```bash
docker compose up -d redis
```

BullMQ 6 treats `ioredis` as an optional driver and does not bundle it, so it is a direct
dependency here. The shared connection is registered once in `AppModule` through
`BullModule.forRootAsync`; `MailModule` only declares the queue it owns and the worker that
drains it.

## Verification

- Unit tests cover the settings boundary (`mail.config.spec.ts`), escaping and copy
  (`mail.templates.spec.ts`), the enqueue contract and deadline (`mail.service.spec.ts`), the
  worker's render-and-send behavior (`mail.processor.spec.ts`), the auth adapter's failure
  policy (`auth.mail.spec.ts`), and both config parsers (`env.validation.spec.ts`,
  `redis.config.spec.ts`).
- A live run against the Redis container stored one job, the worker rendered it, and the log
  transport printed the branded subject and link; `completed` was 1 and `failed` was 0.
- The same run with credentials present exercised the Gmail transport: the SMTP server
  accepted the message before the job completed.

## Consequences

- The API needs Redis to boot the worker. Without it, signup still works but no mail leaves,
  and the reason is in the log.
- A job that exhausts five attempts is not retried automatically. Someone has to read the
  failed set (`bull:mail:failed`) or ask the person to request another link.
- Scaling to a second API instance is safe: each instance runs a worker, and BullMQ hands each
  job to exactly one of them.
