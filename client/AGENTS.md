# AGENTS.md — `client/`

Instructions for AI agents working in the frontend package. Read this before every task in
`client/`. It overrides default habits. Repo-wide routing and shared facts are in
[`../AGENTS.md`](../AGENTS.md).

## Role

Act as a **senior frontend React developer** building a frontend for the NestJS API in
`../server`. That means:

- Compose small, focused components. One component, one responsibility, one default export.
- Separate server state from UI state. Remote data is cached and invalidated by a data layer,
  not hand-copied into `useState`.
- Keep every network call behind one typed API module. No `fetch` scattered through JSX.
- Type the boundaries: props, API payloads, and hook returns. No `any`.
- Loading, empty, and error states are part of "done", not polish. So is keyboard focus and
  `aria` where the markup is not self-describing.
- Consider re-render cost and bundle weight before adding a dependency.

If a request conflicts with these rules, say so and propose the React way before writing code.

## What is actually installed

Do not describe libraries as present when they are not. Verified state of this package:

- React 19.3, Vite 8, TypeScript 6, ESLint 10 flat config.
- **React Router 8** in data-router mode (`createBrowserRouter` + `RouterProvider`).
- **TanStack Query 5** for server state. Session data is the first thing cached there.
- **Tailwind CSS 4** through `@tailwindcss/vite`, configured in `src/index.css` with
  `@theme` tokens. No `tailwind.config.js`: v4 is configured in CSS.
- **react-hook-form 7** owns both auth forms. `useState` is not used for field values.
- **Zustand 5** holds a client-side mirror of the signed-in identity (`features/auth/auth-store.ts`).
  It is not persisted and is not the authority on access — see "Client state" below.
- **Better Auth client 1.7.19** (`better-auth/react`), pinned to the server's version, with
  the admin client plugin so `user.role` is typed. It talks to `VITE_API_URL`, default
  `http://localhost:3000`, and sends cookies with `credentials: 'include'`. It is only the
  identity provider: sign in, sign up, Google, verification.
- **Token client** (`src/lib/api-client.ts`, `src/lib/session-api.ts`). Application routes
  accept only `Authorization: Bearer <accessToken>`, taken from the `access_token` cookie, with
  one refresh call through `POST /session/refresh` on a `401`. Do not add a raw `fetch` to an
  API route.
- **React Compiler is enabled** (`@rolldown/plugin-babel` + `babel-plugin-react-compiler` in
  `vite.config.ts`). It memoizes automatically: do not add `useMemo`, `useCallback`, or `memo`
  for re-render reasons without a measured cause. Still use functional `setState` updates.
- **shadcn/ui primitives** in `src/components/ui/` (`command` on cmdk, `popover` on Radix),
  installed with the shadcn CLI. The theme stays ours: semantic aliases (`--color-popover`,
  `--color-accent`, `--color-muted-foreground`) map onto the tokens in `src/index.css`. Add
  more with `npx shadcn@latest add <component>`; never run `shadcn init`, which would replace
  the theme. `@/*` maps to `src/*` in both `tsconfig.app.json` and `vite.config.ts`.
- **Not installed:** no test runner, no CSS-in-JS.
- `src/` layout: `app/` (router), `lib/` (api client, session api, auth client, query client,
  error mapping, validation rules), `components/` (shared UI), `features/auth/` (screens,
  session hooks, the zustand store, route guards), `features/home/`.

Adding a dependency is a decision to state out loud, not a silent side effect.

## Commands

Run from `client/`. The root has no `package.json`.

```bash
npm run dev        # vite dev server on :5173
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run preview    # serve the built output
```

- `npm run build` runs `tsc -b` first, so it typechecks. A green `vite build` alone proves
  nothing about types.
- There is no `npm test` yet. If a task needs tests, add Vitest and `@testing-library/react`
  and wire the script in the same change; do not leave half-configured test infrastructure.
- TypeScript here is **strict**, like `server/`. Keep it that way: new code has to satisfy
  `strictNullChecks` and the rest, not just compile under the old settings.

## Skills

Skills are installed in `.agents/skills/` and pinned in `skills-lock.json`. Load one **only when
the task needs it**. No preloading, no stacking, none for a trivial edit.

| Skill | Load it when |
| --- | --- |
| `frontend-design` | Creating a new screen or reshaping layout, typography, color, or visual identity. |
| `vercel-react-best-practices` | Writing or reviewing React code for performance: waterfalls, bundle size, re-renders, effects. |
| `tanstack-query-best-practices` | Adding or changing server-state fetching, caching, mutations, or invalidation. |
| `react-testing` | Writing or changing component or hook tests. |

Rules:

1. Check the task against the table. If no row matches, skip skills entirely.
2. Read the skill's `SKILL.md` before doing its work. Do not improvise a partial version.
3. The skill's instructions win for its scope, except where they conflict with the standards in
   this file. Code standards always win.
4. Anything in these skills about Next.js (RSC, Server Actions, `next/dynamic`,
   `next/script`, `after()`) does **not** apply. This is a client-rendered Vite SPA. Take the
   React rules, drop the framework ones.
5. Report which skill you used and why, in one line.

To add a skill, run `npx skills add <owner/repo@skill>` in `client/`. It installs into
`.agents/skills/` and updates `skills-lock.json`. Add a row to the table above in the same
change.

## Talking to the backend

- Base URL comes from `VITE_API_URL` (`src/lib/api-config.ts`), default
  `http://localhost:3000`. There is **no global prefix**: routes are `/auth/*`, `/session/*`,
  and `/admin/*` as the server declares them. Read the server for the exact path instead of
  guessing.
- Application routes take **only** `Authorization: Bearer <accessToken>`. Call them through
  `apiFetch` from `src/lib/api-client.ts`: it reads the token from the `access_token` cookie,
  attaches the header, refreshes once on a `401`, and normalizes errors into `ApiError`. A raw
  `fetch` to an app route bypasses all of that.
- The token routes (`/session/exchange`, `/session/refresh`, `/session/logout`) need
  `auth: 'none'` and `credentials: 'include'`. They authenticate with cookies, and a refresh
  must never trigger another refresh. `apiFetch` already sets credentials on every call.
- The refresh cookie is `httpOnly`, so the browser sends it and JavaScript never sees it. Never
  try to read, copy, or store a refresh token.
- CORS is enabled server side for the `CLIENT_URL` origins with credentials. There is no Vite
  proxy, and adding one would hide a real misconfiguration: if a call fails with a CORS error,
  add the origin to the server's `CLIENT_URL` and Better Auth `trustedOrigins`, not a proxy.
- Handle the server's error shape, do not invent one. Nest errors arrive as
  `{ statusCode, message, error }`, and `message` can be a string or a string array from
  validation. `apiFetch` normalizes that, so components never branch on it.
- `401` means the access token is missing or expired, and `apiFetch` already gave the refresh
  one chance. `403` means signed in without the role, or banned. Do not treat `403` as a
  session expiry and log the user out.
- Authorization is the server's job. Hiding an admin link is a UX choice, not security.

## Code standards

### Structure

- Feature-first directories under `src/`: `src/features/<feature>/` with the components, hooks,
  and schemas that only that feature uses. Truly shared pieces go to `src/components/`,
  `src/hooks/`, `src/lib/`, `src/api/`.
- One component per file, `PascalCase.tsx`, named export matching the file. Hooks are
  `useSomething.ts` and default to one hook per file.
- Colocate page layout CSS with the feature that owns it (`features/auth/auth.css`), and reach
  for Tailwind utilities first for anything new. Do not mix both on the same element.
- Design tokens live in `src/index.css` under `@theme`. Use them instead of raw hex values:
  `--color-ink`, `--color-ink-soft`, `--color-paper`, `--color-card`, `--color-line`,
  `--color-line-strong`, `--color-body`, `--color-muted`, `--color-signal`,
  `--color-signal-deep`, `--color-signal-soft`, `--color-focus`, `--color-danger`,
  `--color-success`, plus `--font-display`, `--font-body`, and `--font-mono`. The same names
  drive utilities (`bg-ink`, `text-muted`, `font-display`), so a new colour is added in exactly
  one place. `--color-signal` is light cyan and only reads on the dark stage; `--color-signal-deep`
  is the same hue dark enough for paper.
- `../components/LightRays` is the one deliberate decorative element: a WebGL beam on the auth
  brand panel and the home stage. Everything around it stays quiet. It has a CSS-gradient
  fallback, so keep the `radial-gradient` behind it if you touch those surfaces.
- Editing a shared primitive (`.button`, `.alert`, `.text-link`) means editing the `components`
  layer in `src/index.css`; utilities on the element still win, which is intentional.
- Tailwind scans `src/` and `index.html` only (`@source` with `source(none)`). Adding a file
  outside those paths means adding an `@source` line, not wondering why a class is missing.
- Import assets through Vite (`import logo from './assets/logo.svg'`). Never hardcode a `/src/`
  URL in markup.

### Components and state

- Derive values during render. Do not mirror props into state, and do not sync state with an
  effect. An effect is for synchronizing with something outside React: a subscription, a timer,
  the DOM, a non-React widget.
- Put interaction logic in event handlers, not in an effect reacting to a state flag.
- Functional `setState` whenever the update depends on the previous value.
- Never define a component inside another component. Pass props instead; otherwise React
  remounts it on every render and inputs lose focus.
- Stable `key` from the data, never the array index for anything that can reorder or grow.
- Render conditions explicitly: `count > 0 ? <Badge /> : null`, not `count && <Badge />`.
- Prefer `startTransition` and `useDeferredValue` over manual loading flags for expensive
  filtering. Use `useTransition`'s `isPending` instead of a hand-rolled `isLoading`.
- Measure before optimizing. The React Compiler handles most memoization; a `useMemo` added
  "just in case" is noise.

### Forms

react-hook-form owns field state, so a form has no `useState` per field.

- `useForm<Values>` with `defaultValues`, then `{...register('field', rules)}` on the input.
- `TextField` already accepts that spread. It takes native input props plus `label`, `hint`,
  and `error`, and generates the ids that tie the label, hint, and error together for screen
  readers.
- Shared rules live in `src/lib/validation.ts` (`emailRules`). Do not retype the messages.
- Use `formState: { errors, isSubmitting }` for the disabled state and button label. It is not
  the same as the mutation's `isPending`.
- Put `noValidate` on the form. Validation is ours, not the browser's, so messages stay
  consistent and focus moves to the first invalid field.
- Server rejections (401, 403 `EMAIL_NOT_VERIFIED`, 429) are not field errors. They render in
  the banner built from `toAuthError`; do not invent a field message for them.

### Data fetching

Server state is not local state. TanStack Query owns the cache; the session lives there today
(`src/features/auth/session.ts`). New requests go in a typed function, usually under
`src/features/<feature>/` or `src/api/`, and mutations invalidate or refetch the keys they
affect instead of refetching everything.

- One `QueryClient` for the app, created in `src/lib/query-client.ts`. Do not create another.
- Query keys are `as const` arrays exported from the feature, not inline literals.
- Sign in runs `authClient.signIn.email` and then `exchangeSession()` **inside** the mutation,
  then writes `sessionKeys.all` and the store from the returned session. Guarded routes
  therefore already have data when they mount. Do not move the exchange into `onSuccess`: an
  error there does not reject `mutateAsync`.
- Sign **up** must not touch the session query: there is no session and no token pair yet, the
  refetch returns `null`, and the bridge would erase the pending account.
- Two error shapes reach the auth screens: `ApiError` from `apiFetch`, and the object Better
  Auth returns instead of throwing. Wrap both with `toAuthError` from `src/lib/auth-error.ts`
  so the UI only ever renders one message shape.

### Client state

Zustand (`src/features/auth/auth-store.ts`) is a **mirror**, not a second source of truth.

- The session query stays authoritative. The store exists so a component can read the current
  user without threading props, and so the UI updates the moment a mutation resolves.
- Mutations write it: sign in calls `setSession`, sign up calls `setPendingVerification`,
  sign out calls `clear`. `SessionBridge` (`features/auth/session-bridge.tsx`, mounted above the
  router) syncs it from the session query in a layout effect, and leaves it alone when the query
  errors — a dead API is not a sign out.
- Never authorize from the store. Guards read the session query; the server enforces roles.
- Do not persist it. A cached user in `localStorage` outlives the session it describes; the
  query rehydrates the store on load.
- Read it with a selector (`useAuthStore((state) => state.user)`), not the whole state object,
  so a change to an unrelated field does not re-render the component.

### TypeScript

- `verbatimModuleSyntax` is on: use `import type { X } from ...` for type-only imports, or the
  build fails.
- `allowImportingTsExtensions` is on and the scaffold imports `./App.tsx` with the extension.
  Match the existing style in the file you are editing.
- `noUnusedLocals` and `noUnusedParameters` are errors, not warnings. Prefix intentionally
  unused parameters with `_`.
- `erasableSyntaxOnly` is on: no `enum`, no parameter properties, no namespaces. Use union types
  and `as const` maps.
- Model API responses with explicit types. Do not let `any` in through a cast; narrow with a
  guard or a schema.

### Accessibility and UX

- Every interactive element is a real `button` or `a`, reachable and operable by keyboard.
- Label every input and connect errors with `aria-describedby`. Group form errors so a screen
  reader announces them.
- Every async view has loading, empty, and error states. A spinner with no failure path is not
  finished.
- Images get meaningful `alt` or `alt=""` when decorative.

## Workflow

1. Read the files you are about to change. Do not guess at existing behavior or assume a
   library is installed.
2. State the plan in one or two lines for non-trivial changes, including any new dependency.
3. Make the smallest change that fully solves the problem. No drive-by refactors of the
   scaffold.
4. Never rewrite unrelated code, and never delete something you do not understand.
5. Run `npm run lint` and `npm run build`. Fix failures rather than reporting them as unrelated.
6. Summarize what changed and which skill, if any, you used.
