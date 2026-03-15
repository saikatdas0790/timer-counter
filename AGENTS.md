# AGENTS.md

This is the source of truth for any agent operating in this repository. It reflects the current state of conventions and patterns — not a changelog. Update it whenever overarching conventions change (new patterns introduced, old ones removed, tooling swapped, devcontainer behaviour changed, etc.). Do not add changelog entries; rewrite the relevant section to reflect the new state.

---

## Resuming from a Handoff

If a file named `HANDOFF.md` exists in the repo root:

1. Read it fully and absorb the context and exact next steps described in it.
2. Continue the work from where it left off.
3. Delete `HANDOFF.md` once its instructions have been incorporated.

If `HANDOFF.md` does not exist, no handoff is required — proceed normally.

---

## Project Overview

**timer-counter** is a Next.js Progressive Web App (PWA) that provides labelled pomodoro timers with attached counters. It works offline with client-side localStorage persistence and syncs across devices via SpacetimeDB when authenticated. Authentication is provided by SpacetimeAuth (OIDC via `react-oidc-context`).

- **Frontend**: Next.js v16 (static export) + TypeScript 5 + Tailwind CSS v4 + XState v5
- **Auth**: SpacetimeAuth (OIDC) via `react-oidc-context` + `oidc-client-ts`
- **Persistence**: `localStorage` (fast load / offline cache) + SpacetimeDB (authoritative cross-device sync)
- **Backend**: SpacetimeDB (TypeScript server module in `spacetimedb/`)
- **Testing**: Vitest v4 + jsdom
- **Formatting/Linting**: Prettier + ESLint

---

## Repository Layout

```
src/
  app/                        # Next.js App Router
    globals.css               # Global Tailwind base styles
    layout.tsx                # Root layout (HTML shell + OidcProvider wrapper)
    page.tsx                  # Home page (client component, mounts timerListMachine behind AuthGate)
  components/                 # UI — follows atomic design (see below)
    OidcProvider.tsx          # react-oidc-context AuthProvider wrapper ("use client")
    SyncBridge.tsx            # Headless component: bridges timerListMachine ↔ SpacetimeDB
    ServiceWorkerRegistration.tsx  # "use client" headless component that registers the SW on mount
  lib/
    timerListMachine.ts       # Root XState machine (timer list + localStorage + STDB events)
    timerListMachine.test.ts  # Unit tests for timerListMachine (55 tests)
    timerListContext.tsx       # createActorContext wrapper for timerListMachine
    spacetimedb.ts            # DbConnection factory (createDbConnection)
    registerServiceWorker.ts  # Service worker registration (called from ServiceWorkerRegistration)
    pwa.test.ts               # Unit tests for manifest + SW registration (14 tests)
  components/
    molecule/
      timer/
        timer-counter/
          TimerCounter.test.ts  # Unit tests for timerCounterMachine (12 tests)
    module_bindings/          # Generated TS bindings (spacetime:generate — do not edit)
public/                        # Served at site root (Next.js static assets)
  manifest.json               # PWA web app manifest
  sw.js                       # Service worker (cache-first for static, network-first for nav)
spacetimedb/                   # SpacetimeDB server module (spacetime init)
  src/
    index.ts                  # Server module: timer_counter table + 3 reducers
    module_bindings/          # Generated TS bindings (do not edit)
  spacetime.json              # Module config (server: maincloud, database: timer-counter-6b3bt)
  .env.local                  # SpacetimeDB host + DB name (not gitignored in spacetimedb/)
vitest.config.ts              # Vitest config (jsdom, @/* alias)
public/static/                # Static assets (icons, audio) served at /static/*
.devcontainer/                # Dev container config (see Devcontainer section)
.github/
  workflows/deploy.yml        # CI/CD — builds and deploys to GitHub Pages on push to main
  dependabot.yml              # Automated dependency updates (npm + devcontainers, weekly)
.npmrc                        # npm config (currently empty)
ansible.cfg                   # Ansible config — at root so commands run from repo root
ansible/                      # Ansible playbooks and secrets (see ansible/README.md)
next.config.ts                # Next.js config (static export)
postcss.config.mjs            # PostCSS config (Tailwind v4 via @tailwindcss/postcss)
tsconfig.json                 # TypeScript config (Next.js standard)
```

---

## Route File Conventions — Next.js App Router

This project uses Next.js v16 App Router conventions:

- Root layout: `src/app/layout.tsx` — server component, sets HTML shell and metadata
- Home page: `src/app/page.tsx` — client component (`"use client"`), mounts the XState machine via context
- All components that use hooks, state, or context must include `"use client"` at the top
- Global CSS: `src/app/globals.css`

Do not create SvelteKit route files (`+page.svelte`, `+layout.svelte`, etc.).

---

## Path Aliases

The `@/*` alias resolves to `src/*` and is configured in `tsconfig.json`.

| Alias | Resolves to |
| ----- | ----------- |
| `@/*` | `src/*`     |

Always use `@/components/...`, `@/lib/...`, etc. for cross-directory imports.

---

## Component Architecture — Atomic Design

Components live under `src/components/` and follow a strict three-tier atomic hierarchy:

| Tier       | Path                       | Description                                                                 |
| ---------- | -------------------------- | --------------------------------------------------------------------------- |
| `atom`     | `src/components/atom/`     | Primitive, stateless UI pieces (buttons, icons, inputs, displays, dividers) |
| `molecule` | `src/components/molecule/` | Composed atoms with local behaviour (timer/counter, sync button, counter)   |
| `organism` | `src/components/organism/` | Full page sections composed of molecules (grid, controls)                   |

Always place new components at the lowest tier that makes sense. Do not import atoms from organism-level or import organisms from molecule-level.

---

## State Management — XState v5

All non-trivial state lives in XState v5 machines. Conventions:

- Machine definitions are in `.ts` files alongside the component that owns them (e.g. `TimerCounter.ts` next to `TimerCounterComponent.tsx`).
- Use `setup({ types, actions, guards, actors }).createMachine({ ... })` for machines that need `input` (e.g. spawned child machines). Use `createMachine(config, options)` for machines that don't need `input`.
- No typegen files — XState v5 infers types from the machine definition directly.
- `assign` callbacks use destructured `({ context, event, spawn })` — **not** the v4 two-argument `(context, event)` form.
- Guards are declared with `guard:` in transitions (not `cond:`). Guard implementations receive `({ context, event })`.
- Services are now called **actors** and must be wrapped with `fromPromise(async ({ input }) => ...)` or `fromCallback`. The `actors:` key replaces the old `services:` key in machine options.
- `invoke` blocks that need context data must explicitly pass `input: ({ context }) => ({ ... })` to the actor.
- Resolved actor output is accessed as `event.output` in `onDone` handlers (was `event.data` in v4).
- `sendParent` is still available; accepts a static event object or a callback `({ context, event }) => event`.
- All `send()` calls use the **object form**: `send({ type: "EVENT" })` — the string shorthand `send("EVENT")` was removed in v5.
- Child actors are spawned by string src name `spawn('actorName', { id: 'actorId', input: { ... } })` inside `assign` callbacks. The actor must be registered in `setup({ actors: { actorName: logic } })`. Direct logic reference `spawn(logic, { id })` is not used because it does not support the `id` option in TypeScript. The `.withContext()` API was removed in v5.
- **State restoration via `input` + `always`**: When a spawned actor needs to start in a non-default state (e.g. restoring `timerState: "running"` from localStorage or STDB), pass the state as an `input` field and use `always` transitions in the initial state to immediately transition to the correct state. Do NOT use a post-spawn `send()` — events sent to a newly-spawned actor before its event loop is ready are silently dropped. The `timerCounterMachine` uses this pattern: `input.timerState` is stored in `context._initialTimerState`, and `always` transitions in the `"new"` state fire immediately and clear `_initialTimerState` so that returning to `"new"` (e.g. via reset) does not re-trigger the restore.
- `useMachine` and `useSelector` come from `@xstate/react`. `useSelector(actorRef, selector)` subscribes a component to an actor's state.
- `createActorContext(machine)` from `@xstate/react` creates a React context with a `Provider`, `useSelector`, and `useActorRef` — used in `src/lib/timerListContext.tsx` for the root machine.
- `InterpreterFrom<T>` → use `Actor<T>` for the actor type; `StateFrom<T>` → `SnapshotFrom<T>`.
- The root page machine (`src/lib/timerListMachine.ts`) manages `timerList` state — loading from `localStorage`, adding/removing timers, and persisting changes back to `localStorage`.
- The root machine is provided via `TimerListContext.Provider` in `src/app/page.tsx` and consumed via `TimerListContext.useSelector` / `TimerListContext.useActorRef` in child components.

---

---

## PWA — Service Worker

- **Manifest**: `public/manifest.json` — `display: standalone`, icons at `/static/pwa-192x192.png` and `/static/pwa-512x512.png`, `theme_color: "#1e293b"`, `start_url: "/"`
- **Service worker**: `public/sw.js` — cache-first for `/_next/static/`, network-first for navigation, stale-while-revalidate for everything else; `skipWaiting()` + `clients.claim()`
- **Registration**: `src/lib/registerServiceWorker.ts` — guards `if (!navigator.serviceWorker) return;` (falsy check, not `"serviceWorker" in navigator`, to handle browsers where the property exists but is `undefined`); registers `sw.js` with `scope: "/"`
- **`ServiceWorkerRegistration`**: `src/components/ServiceWorkerRegistration.tsx` — `"use client"` headless component, calls `registerServiceWorker()` in `useEffect`. Rendered in `src/app/layout.tsx`.

---

## Authentication — SpacetimeAuth + react-oidc-context

Authentication uses SpacetimeDB's own OIDC provider (SpacetimeAuth) with Google as the identity provider.

- **Library**: `react-oidc-context` + `oidc-client-ts`
- **Authority**: `https://auth.spacetimedb.com/oidc`
- **Client ID**: `client_032dnbwPlt1yJpQgZmVB3e` — public identifier; stored as plaintext in `ansible/vars/main.yml`, exposed as `NEXT_PUBLIC_SPACETIMEDB_AUTH_CLIENT_ID` via `ansible/templates/env.j2`
- **Client secret**: not used. SpacetimeAuth registers browser clients as public OIDC clients (`token_endpoint_auth_method: none`). PKCE (`S256`) is the security mechanism for the code exchange — no `client_secret` is sent or needed.
- **Token storage**: `localStorage` (via `WebStorageStateStore`, same instance as `stateStore`). Both `userStore` (tokens) and `stateStore` (PKCE state) use `localStorage` so they survive across tabs and browser restarts. `sessionStorage` (the oidc-client-ts default for `userStore`) would be cleared on every new tab, forcing the user to sign in each time. JS-set cookies are NOT recommended per IETF draft-ietf-oauth-browser-based-apps §8.1 for browser-only SPAs. True HttpOnly cookie security needs a BFF server, which this app does not have.
- **State store**: `localStorage` (via `WebStorageStateStore`). The PKCE `code_verifier` and OIDC `state` are stored in `localStorage` so they survive mobile browser in-app redirects, which use an isolated context that does not share `sessionStorage` with the originating tab. Without this, mobile sign-in fails with "No matching state found in storage".
- **Redirect URI**: `window.location.origin` (root `/`) — no `/callback` route needed. `onSigninCallback` uses `window.history.replaceState` to clean up `?code=&state=` from the URL after exchange.
- **Silent renew**: `automaticSilentRenew: false` — we own the renewal lifecycle entirely. SpacetimeAuth (beta) does **not** issue refresh tokens for public clients (their own React integration guide omits `offline_access` from the scope; confirmed empirically by `USER_LOADED` never firing after a silent renew and `oidc-client-ts` always falling back to the iframe path). Enabling `automaticSilentRenew: true` causes `oidc-client-ts` to fall back to an iframe with `prompt=none`, which always returns `End-User authentication is required`. Instead, `AuthGate` subscribes to `auth.events.addAccessTokenExpiring` (fires 300 s before expiry via `accessTokenExpiringNotificationTimeInSeconds: 300`) and calls `renewOrRedirect()` which: (a) calls `signinSilent()` via token endpoint if a `refresh_token` is present, or (b) calls `signinRedirect()` to kick off a new PKCE flow. The SpacetimeDB **IdP session** (cookie-based in the browser) lasts much longer than the 15-minute access token, so `signinRedirect` typically completes without any user interaction. Timer state is preserved in `localStorage` across the redirect.
- **Error recovery**: `AuthGate` includes automatic recovery from transient renewal failures. When `auth.error` is a network error (device woke from sleep), it retries with backoff (2 s, 5 s, 10 s). When `auth.error` is a terminal error (`End-User authentication is required`, etc.) and the tab is visible, it calls `signinRedirect()` immediately rather than showing a stale error banner. If the tab is hidden when a terminal error occurs, the visibility handler redirects on the next tab-focus.
- **`OidcProvider`**: `src/components/OidcProvider.tsx` — `"use client"` wrapper around `AuthProvider`. Placed in `src/app/layout.tsx` wrapping `{children}`. Includes `onRemoveUser` callback for logging session removal events.
- **`AuthGate`**: `src/components/organism/AuthGate.tsx` — `"use client"`, uses `useAuth()`. On load, if not authenticated, calls `renewOrRedirect()` (tries token endpoint first, falls back to redirect). During the silent attempt `auth.activeNavigator === "signinSilent"` keeps the skeleton visible. If signed in, always renders children — never unmounts them on error. If `auth.error` is set, shows a fixed top banner with a "Sign in again" link so the user can manually recover.
- **Page structure**: `<OidcProvider>` (layout) → `<AuthGate>` → `<TimerListContext.Provider>` → `<PageContent>` (page.tsx)

### SpacetimeAuth dashboard setup (one-time, manual)

1. Deploy the SpacetimeDB module: `cd spacetimedb && npm run spacetime:publish`
2. In the SpacetimeDB dashboard → your module → **SpacetimeAuth** tab → enable it
3. **Identity Providers** tab → add Google → paste your Google OAuth Client ID + Secret (authorized redirect URI for Google: `https://auth.spacetimedb.com/interactions/federated/callback/google`)
4. **Clients** tab → register redirect URIs: `http://localhost:3000` and `https://timer-counter.saikat.dev`

---

## SpacetimeDB

- Server module: `spacetimedb/` (TypeScript, publishes to `maincloud.spacetimedb.com`)
- Database: `timer-counter-6b3bt` on `maincloud`
- Table: `timer_counter` — `id (u64 autoInc PK)`, `owner (identity)`, `label (string)`, `current_count (i32)`, `remaining_time_seconds (u32)`, `timer_state (string)`, `timer_started_at_ms (u64, default 0)`, `public: true`
- Reducers: `create_timer_counter({ label })`, `update_timer_counter({ id, label, current_count, remaining_time_seconds, timer_state, timer_started_at_ms })`, `delete_timer_counter({ id })` — all enforce `ctx.sender === row.owner`
- Generated bindings: `src/lib/module_bindings/` (client app) and `spacetimedb/src/module_bindings/` (server) — do not edit
- To regenerate bindings after publishing module changes: `cd spacetimedb && npm run spacetime:generate`
- To publish module: `cd spacetimedb && npm run spacetime:publish`
- `spacetimedb/dist/` is gitignored (build artifact)

### Sync Architecture

**Sync preference**: ALL timer state — `label`, `currentCount`, `remainingTimeInSeconds`, `timerState`, and `timerStartedAtMs` — is always synced bidirectionally. Any change on any device (label edit, counter increment, timer start/pause/reset) propagates to every other connected device. When designing new features, default to syncing all state rather than leaving anything device-local.

`SyncBridge` (`src/components/SyncBridge.tsx`) is a headless React component rendered inside `TimerListContext.Provider`. It owns the entire STDB connection lifecycle:

**Auth error handling:**

The `SyncBridge` effect checks `auth.isAuthenticated` and `auth.error` before attempting a connection. If authentication fails or an auth error occurs (e.g., silent token renewal fails), the effect early-returns without establishing a connection, ensuring sync is fully paused. The effect dependencies include `auth.isAuthenticated` and `auth.error`, so when auth state changes (token expires, renewal fails), the cleanup runs (`conn.disconnect()`) and the effect re-evaluates. This ensures the "Session error — sync paused." banner shown by `AuthGate` accurately reflects the sync state.

**STDB → machine:**

- `onApplied`: fires once when the subscription is established; pre-populates `lastUploadedValues` for all rows, then sends `STDB_SYNC_APPLIED` with all rows (replaces all local actors and localStorage)
- `conn.db.timer_counter.onInsert`: after initialization, either links a pending local create (`STDB_ID_LINKED`) or sends `STDB_TIMER_INSERTED` for a remote device insert; pre-populates `lastUploadedValues` in both cases
- `conn.db.timer_counter.onUpdate`: value-comparison echo detection — if all fields match `lastUploadedValues` it is our own echo and is discarded; otherwise `lastUploadedValues` is updated with the incoming values before dispatching `STDB_TIMER_UPDATED` to the machine
- `conn.db.timer_counter.onDelete`: sends `STDB_TIMER_DELETED`; uses `stdbOriginDeletions` set to avoid re-issuing the delete to STDB

**Machine → STDB (via `actorRef.subscribe`):**

- New actor IDs without `stdb-` prefix → `createTimerCounter`; actor ID queued in `pendingCreates` (FIFO) for linking
- Missing actor IDs not in `stdbOriginDeletions` → `deleteTimerCounter` (stdbId looked up from `stdbIdMap`)
- All actors with a known stdbId → `updateTimerCounter` **only when current values differ from `lastUploadedValues`** — this prevents re-uploading STDB-originated data after every machine transition

**Echo-loop prevention (`lastUploadedValues` pattern):**

`actorRef.subscribe` fires on every machine transition, including STDB-originated ones (`STDB_TIMER_UPDATED`, `STDB_SYNC_APPLIED`). Without guards this causes every STDB event to trigger an upload for all timers. `lastUploadedValues: Map<string, UploadedValues>` records the last values uploaded to or received from STDB per actor (`label`, `currentCount`, `remainingTimeSeconds`, `timerState`, `timerStartedAtMs`). The subscribe callback skips `updateTimerCounter` when the current actor snapshot matches the map. `onUpdate` uses the same map to detect echoes of our own writes. This prevents the failure mode where Device B grows a backlog of redundant updates and silences genuine remote changes.

**`timerListMachine` STDB context:**

- `stdbIdMap: Record<string, bigint>` — maps actor ID → STDB row ID
- Actors spawned from STDB data use IDs like `stdb-${row.id}`; locally-created actors use `${Date.now()}`
- `STDB_SYNC_APPLIED` updates existing actors in-place (preserving the user's established timer order from localStorage), then appends any new STDB rows as fresh actors. Actors no longer in STDB are dropped. STDB is still authoritative for data; localStorage order is preserved for UX.
- `STDB_TIMER_UPDATED` dispatches `TIMER_STATE_SYNCED_FROM_REMOTE` to the child actor; `syncFromRemote` updates context but does NOT write to localStorage (keeps the echo loop broken)

**Timer timing model (`timer_started_at_ms` + `_remainingAtStart`):**

Running timers do not upload `remaining_time_seconds` every second. Instead:
- On play: `timerStartedAtMs = Date.now()` and `_remainingAtStart = remainingTimeInSeconds` are captured in machine context (via `startTimer` action).
- `remaining_time_seconds` in STDB stores `_remainingAtStart` for running timers (the frozen value at play time), and the frozen remaining for paused/timerSet.
- `timer_started_at_ms` in STDB stores the epoch-ms timestamp when the timer started (0 when not running).
- Any device receiving a running timer via STDB computes actual remaining immediately: `max(0, remaining_time_seconds - round((now_ms - timer_started_at_ms) / 1000))`.
- `SECONDS_ELAPSED` (from `TimerWorker`) calls `computeRemainingFromWallClock` instead of decrementing by delta — it recomputes from `Date.now() - timerStartedAtMs` so any tab-suspension catch-up happens in the first wakeup tick without any special flush logic.
- `SECONDS_ELAPSED` does **not** call `syncTimerState` → no per-second localStorage or STDB writes while the timer is running. Uploads only happen on state transitions (play/pause/reset/label/count).
- On pause: `pauseTimer` freezes `remainingTimeInSeconds` from the wall clock and clears `timerStartedAtMs = 0`.
- `_remainingAtStart = 0` and `timerStartedAtMs = 0` are also cleared on reset.
- Guard in `syncFromRemote` and `computeRemainingFromWallClock`: when `timerStartedAtMs === 0`, the remaining time is used as-is (avoids computing `Date.now() - 0` = epoch distance for non-running or test-context actors).

**TimerWorker:**

`TimerWorker.ts` fires `{ type: "SECONDS_ELAPSED" }` approximately every second via `setInterval`. The machine's `computeRemainingFromWallClock` action recomputes remaining time from `Date.now() - timerStartedAtMs`, so the display is always accurate after any suspension regardless of how many ticks were skipped.

---

## Scripts Reference

| Script             | Purpose                                    |
| ------------------ | ------------------------------------------ |
| `npm run dev`      | Start Next.js dev server                   |
| `npm run build`    | Production build (static export to `out/`) |
| `npm run start`    | Serve the static export locally            |
| `npm run test`     | Run Vitest tests                           |
| `npm run coverage` | Vitest with coverage (c8)                  |
| `npm run lint`     | Prettier + ESLint check                    |
| `npm run format`   | Prettier auto-format                       |

## CI/CD

- Workflow: `.github/workflows/deploy.yml`
- Triggers on push to `main`.
- **Builds run inside the devcontainer** via `devcontainers/ci@v0.3`, so CI is byte-for-byte identical to the local dev environment. The devcontainer image is cached in GHCR under `ghcr.io/<owner>/timer-counter-devcontainer`.
- The runner creates placeholder stubs for the two devcontainer bind-mount sources that don't exist in CI (`~/.ssh/agent.sock` and `~/.config/gh`) before launching the container.
- **Secrets in CI**: The only secret CI needs is `ANSIBLE_VAULT_PASSWORD` (a GitHub secret). It is injected into the devcontainer via the `env:` block on the `devcontainers/ci` step. `postCreate.sh` detects it, writes `ansible/.vault_pass`, and then runs the exact same `ansible/setup_env.yml` playbook as local. This keeps CI and local behaviour in the same code path — the vault is always the source of truth. Never pass individual secret values (tokens, client secrets, etc.) as separate CI env vars; never write `.env` from outside the devcontainer in workflow steps.
- Build output (`out/`) is uploaded as a GitHub Pages artifact and deployed via `actions/deploy-pages@v4`.
- Custom domain: `timer-counter.saikat.dev` (configured via `public/CNAME`). DNS is a proxied Cloudflare CNAME pointing to `saikatdas0790.github.io`.
- SPA routing: Next.js `output: 'export'` generates static HTML. The `404.html` fallback handles unmatched routes for GitHub Pages.

---

## DNS Management

DNS is managed via Ansible + Cloudflare API. `ansible.cfg` lives at the repo root so all Ansible commands run from there.

- Playbook: `ansible/manage_dns.yml` — upserts the CNAME `timer-counter.saikat.dev` → `saikatdas0790.github.io` (proxied)
- Secrets: `ansible/vars/vault.yml` (Ansible Vault encrypted, committed). The Cloudflare API token is the only secret; zone/account IDs are plaintext in `ansible/vars/main.yml`.
- Vault password: stored in `ansible/.vault_pass` locally (gitignored).
- `postCreate.sh` auto-runs `ansible/setup_env.yml` on devcontainer start if `ansible/.vault_pass` is present, generating `.env` with the Cloudflare token.

First-time setup (see `ansible/README.md` for full details):

```bash
cp ansible/vars/vault.yml.example ansible/vars/vault.yml
# fill in your Cloudflare API token, then:
echo 'your_password' > ansible/.vault_pass && chmod 600 ansible/.vault_pass
ansible-vault encrypt ansible/vars/vault.yml
```

To apply DNS changes:

```bash
ansible-playbook ansible/manage_dns.yml
```

---

## Tooling Preferences

- **Use `gh` CLI** for all GitHub interactions (viewing CI runs, opening PRs, fetching issue details, etc.) instead of fetching web URLs. The `gh` CLI is pre-installed and authenticated in the devcontainer. Example: `gh run view --log-failed` to inspect a failing CI run.

---

## Dependency Notes

All packages in the dependency tree are compatible with the current npm version — no `legacy-peer-deps` workaround is needed.

`@testing-library/react` and `@testing-library/dom` are devDependencies used in `useWakeLock.test.ts` for `renderHook` and `act`. Import from `@testing-library/react` only.

Tailwind CSS v4 uses the `@tailwindcss/postcss` PostCSS plugin. The only Tailwind entry point is `@import "tailwindcss"` in `src/app/globals.css`. All customisation goes through CSS custom properties (Tailwind v4 CSS-based config). There is no `tailwind.config.js`.

ESLint uses the flat config format (`eslint.config.js`) — the old `.eslintrc` format is not used. `no-undef` is disabled for TypeScript files (TypeScript handles undefined variable checks). `@typescript-eslint/no-unused-vars` is configured to allow `_`-prefixed names as intentionally unused.

`react-oidc-context` wraps `oidc-client-ts`. Import `useAuth` and `AuthProvider` from `react-oidc-context` only — do not import from `oidc-client-ts` directly unless accessing lower-level types.

---

## Devcontainer

### Key devcontainer mounts

| Source (host)       | Target (container)        | Purpose               |
| ------------------- | ------------------------- | --------------------- |
| `~/.ssh/agent.sock` | `/ssh-agent`              | SSH agent forwarding  |
| `~/.config/gh`      | `/home/vscode/.config/gh` | GitHub CLI auth state |

### postCreate.sh

Runs on container creation. Responsibilities:

- Installs `dnsutils` (`dig`, `nslookup`, `host`)
- Installs SpacetimeDB CLI
- Checks and reports SSH agent accessibility
- Configures GitHub CLI to use SSH protocol
- Runs `npm install` at repo root
- Runs `npm install` in `spacetimedb/` and `spacetimedb/`
- **Local**: if `ansible/.vault_pass` is present, generates `.env` from vault, authenticates SpacetimeDB CLI, and runs `spacetime:generate`
- **CI**: if `ANSIBLE_VAULT_PASSWORD` env var is present (injected by `devcontainers/ci` `env:` block), writes `ansible/.vault_pass` from it, then follows the exact same Ansible path as local

---
