# 0002. Mint short lived API tokens after Better Auth sign in

**Date**: 2026-11-11
**Status**: In Progress

## Summary

Better Auth stays the identity provider. Once it confirms a sign in, Nest mints a fifteen minute access JWT and a seven day refresh JWT, sets both as cookies, and the SPA sends the access token in an `Authorization: Bearer` header. Application routes accept nothing else. Better Auth keeps owning `/auth/*` on its own session cookie, which the SPA exchanges once for a token pair.

## Context

Spec [0001](0001-add-better-auth-with-roles.md) authenticated application routes with the Better Auth session cookie through `@thallesp`'s global `AuthGuard`. That works, but it has two costs that this slice removes:

- Every application request reads a seven day cookie that the server has to look up as a session row. Short lived credentials are a smaller blast radius if one leaks, and they let a client stop treating "signed in to the auth provider" as "allowed to call the API".
- The SPA needs one explicit place to attach a credential. A bearer header is that place, and it makes the refresh path something a person can read in the code instead of a browser side effect.

The engineer asked for exactly this shape: Nest waits for the Better Auth response on sign in and sign up, then creates `accessToken` and `refreshToken`, passes them via cookies, the SPA extracts the access token and sends `Bearer {accessToken}`, and a refresh token is used when the access token is gone. Lifetimes are fifteen minutes and seven days.

## Requirements

**User stories**:
- As a signed in user, I want my API calls to carry a short lived token so that a leaked credential stops working quickly.
- As a signed in user, I want my session to continue without signing in again every fifteen minutes.
- As a signed out visitor, I want every protected route to reject me with `401`, no matter which cookie my browser still holds.
- As an administrator, I want a role change or a ban to take effect without waiting for a token to expire.

**Acceptance criteria**:
- **AC-1**: A successful credentials sign in followed by `POST /session/exchange` sets `access_token` (`Path=/`, readable by script, `Max-Age=900`) and `refresh_token` (`Path=/session`, `HttpOnly`, `Max-Age=604800`). No response body contains either token as a field.
- **AC-2**: `GET /session` with `Authorization: Bearer <accessToken>` returns the user and `session.expiresAt`; without a valid access token it returns `401`.
- **AC-3**: `POST /session/refresh` with only the `refresh_token` cookie returns a new access token and a new refresh token, and the new refresh token differs from the one sent.
- **AC-4**: A refresh token sent as `Authorization: Bearer` returns `401`, and an access token sent to `POST /session/refresh` returns `401`. Each token carries an audience and a `typ` claim, so the two are not interchangeable.
- **AC-5**: Sign up mints no tokens, because the email is not verified and Better Auth creates no session. Sign in remains the first moment a pair exists.
- **AC-6**: `POST /session/logout` ends the Better Auth session and clears both cookies on the paths they were set on, even when Better Auth has no session to end.
- **AC-7**: A protected route returns `401` with no token, `403` for a participant on an `@Roles(['admin'])` route, and `200` for an admin. `@AllowAnonymous()` and `@OptionalAuth()` keep their meaning.
- **AC-8**: The guard loads the user row on every request, so a ban returns `403` and a role change is visible on the next request rather than at token expiry.
- **AC-9**: Startup fails naming `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` when it is absent or shorter than 32 characters.
- **AC-10**: The SPA retries a request once after a successful refresh. Concurrent 401s share one refresh call, and the token routes never trigger a refresh of themselves.

## Options considered

### Option 1: Keep the Better Auth session cookie on application routes

**Pros**: Nothing new to build. Interests, roles, and bans already work.

**Cons**: Every app request is authenticated by a seven day credential, the SPA has no visible credential to attach, and the token lifetime cannot be reasoned about separately from the auth provider's session.

### Option 2: Opaque tokens stored in the database

**Pros**: Revocation is trivial: delete the row. Rotation and reuse detection are straightforward.

**Cons**: Every refresh is a write, and every API request needs a lookup the guard already performs once for the user row. It adds a table this slice does not need yet.

### Option 3: Stateless JWT pair with rotation (**chosen**)

**Pros**: No new storage, the access token is short lived, the refresh token is httpOnly and path scoped so script never sees it, and the guard's only query is the user row it needs for role and ban checks anyway.

**Cons**: Rotation is not revocable: an old refresh token works until it expires. Refresh reuse detection would need stored token ids.

## Decision

**Chosen option**: Option 3, a stateless JWT pair minted by Nest after Better Auth confirms the sign in, with rotation on every refresh.

Refresh token is `httpOnly` and path scoped to `/session`, chosen by the engineer over a script readable cookie: a seven day credential that JavaScript can read hands any XSS a week. Sign up mints no tokens (engineer's choice), matching Better Auth's own no session rule until verification. Application routes accept only the bearer token (engineer's choice), so the session cookie is not a second way into the API.

## Rationale

Better Auth already solves passwords, verification, reset, and Google. Replacing any of that would be a rewrite for no gain. What it should not own is the request credential for application routes, because that is where the lifetime, the header, and the role check belong. A JWT pair keeps Better Auth's session as the thing that proves who signed in, and makes the API's own credential independent of it. Stateless was chosen over a token table because rotation plus a fifteen minute access window is already a meaningful improvement, and the guard can load the user row it needs for authorization without a second query.

## Feature design

**Cookies**:

| Cookie | Lifetime | Path | HttpOnly | Purpose |
|---|---|---|---|---|
| `access_token` | 15 minutes | `/` | no | The SPA reads it and sends `Authorization: Bearer`. |
| `refresh_token` | 7 days | `/session` | yes | Only `/session/refresh` needs it; script never sees it. |

Both are `sameSite: 'lax'` and gain `secure` only when `NODE_ENV` is `production`, because a `Secure` cookie is dropped over plain http.

**Token claims**:

| Claim | Access token | Refresh token |
|---|---|---|
| `sub` | user id | user id |
| `role` | current role | not used |
| `typ` | `access` | `refresh` |
| `aud` | `hackathon-api:access` | `hackathon-api:refresh` |
| `iss` | `hackathon-api` | `hackathon-api` |
| `jti` | new UUID | new UUID |
| `exp` | issued + 900 s | issued + 604800 s |

Two secrets, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, so either can be rotated alone. Both are HS256 and validated at startup.

**API surface**:

| Endpoint | Method | Auth | Key outputs | Key errors |
|---|---|---|---|---|
| `/session/exchange` | POST | Better Auth session cookie | user, `session.expiresAt`, both cookies | `401` no session, `403` banned |
| `/session/refresh` | POST | `refresh_token` cookie | user, both cookies rotated | `401` missing or invalid, clears cookies |
| `/session/logout` | POST | Better Auth cookie, optional | `{ ok: true }`, both cookies cleared | none, always `200` |
| `/session` | GET | `Authorization: Bearer` | user, `session.expiresAt` | `401`, `403` banned |

**Request pipeline**:
- `AppModule` registers two global guards in order: `ArcjetProtectionGuard`, then `JwtAuthGuard`. Arcjet still runs first, so a blocked request never reaches token verification.
- `JwtAuthGuard` reads the same metadata keys as `@thallesp`'s guard (`PUBLIC`, `OPTIONAL`, `ROLES`), so `@AllowAnonymous()`, `@OptionalAuth()`, and `@Roles()` keep working with no controller changes.
- A malformed or expired token is anonymous on a public or optional route, which lets the SPA probe `/session` while signed out without a `401` storm.
- `JwtAuthGuard` loads `user` after signature verification. A missing row is `401`, a ban is `403`, and the role check uses the row, not the claim.
- `AuthModule.forRootAsync` sets `disableGlobalAuthGuard: true`; Nest mints tokens in `SessionModule`, which imports `AuthModule` to reach `AuthService`.
- `bodyParser: false` is unchanged. None of the token routes has a body; the exchange reads cookies and headers.

**Client flow**:
- `lib/api-config.ts` holds the base URL for both clients.
- `lib/api-client.ts` reads `access_token` from `document.cookie`, drops it when `exp` is within five seconds, attaches `Authorization`, refreshes once on `401`, and normalizes every failure into `ApiError`. A module level promise dedupes concurrent refreshes.
- `lib/session-api.ts` answers "who is signed in": access cookie then `GET /session`, else `POST /session/exchange`, else refresh and retry, else anonymous.
- `features/auth/session.ts` keeps TanStack Query as the authority. Sign in calls `authClient.signIn.email`, then `exchangeSession()` inside the mutation so a failed exchange rejects `mutateAsync`. Sign out calls `POST /session/logout` and clears the cache and the store.
- Token routes are called with `auth: 'none'` so a refresh failure cannot start a refresh loop.

**Key invariants**:
- Application routes accept only the bearer access token. `/auth/*` and the four `/session/*` routes are the only cookie authenticated surfaces.
- A refresh token is never accepted where an access token is expected, and the reverse.
- The refresh cookie is never readable by JavaScript.
- No token value appears in a JSON response body.
- The role used for authorization comes from the database row, never from a token claim alone.

**Security model**:
- Access tokens live fifteen minutes; refresh tokens seven days with rotation.
- Rotation is stateless, so an old refresh token stays valid until it expires. There is no denylist and no reuse detection in this slice.
- `SameSite=Lax` covers the refresh route against cross site POSTs in current browsers. A stricter `SameSite=Strict` would break the OAuth return bounce.
- XSS remains the dominant risk: the access token is script readable by design. The httpOnly refresh cookie bounds the damage to fifteen minutes instead of seven days.
- The better auth session cookie still exists during a sign in flow. `/session/logout` ends it, so a cleared token pair cannot be re minted from an old session cookie.

## Consequences

**Positive**:
- Application requests carry a fifteen minute credential instead of a seven day one.
- The SPA has one explicit place where a credential is attached, and one refresh path.
- `jose` is already a Better Auth dependency, so no new transitive surface.
- Role and ban changes take effect on the next request, because the guard reads the row.

**Negative / tradeoffs**:
- Stateless rotation cannot revoke an old refresh token before its expiry. A stolen refresh token stays useful until it expires or the secrets are rotated.
- Two more secrets to manage and rotate; rotating a secret signs everyone out.
- The SPA reads a JWT payload to avoid sending a dead token. That is a client convenience, not a security decision: the server still verifies every token.
- The refresh cookie is path scoped to `/session`, so a future token route outside that prefix needs the cookie path widened deliberately.

**Neutral**:
- Application routes no longer accept the Better Auth session cookie, which is the point.
- `@Session()` now returns a shape built by the guard, not the package's session record. The fields controllers read are the same.
- `jose` is installed with `--legacy-peer-deps` because of a pre existing `@arcjet/nest` peer range below Nest 12.

## Follow-up

- [ ] Add refresh reuse detection, or a token version on `User`, before this handles real money or personal data.
- [ ] Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` through the deployment secrets, and document that rotation signs everyone out.
- [ ] Decide whether a future mobile or CLI client needs the refresh token in a header instead of a cookie.
- [ ] Consider `SameSite=Strict` for the refresh cookie once the OAuth return path is confirmed against it.
