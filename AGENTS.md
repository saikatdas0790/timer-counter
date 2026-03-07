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

**timer-counter** is a Next.js Progressive Web App (PWA) that provides labelled pomodoro timers with attached counters. It works offline with client-side localStorage persistence. Authentication is provided by SpacetimeAuth (OIDC via `react-oidc-context`). Backend sync via SpacetimeDB will be wired up once the server module is published.

- **Frontend**: Next.js v16 (static export) + TypeScript 5 + Tailwind CSS v4 + XState v5
- **Auth**: SpacetimeAuth (OIDC) via `react-oidc-context` + `oidc-client-ts`
- **Persistence**: `localStorage` (client-only; SpacetimeDB sync is a future iteration)
- **Backend**: SpacetimeDB (TypeScript server module in `spacetimedb/`)
- **Testing**: Vitest
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
  lib/
    timerListMachine.ts       # Root XState machine (timer list + localStorage)
    timerListContext.tsx       # createActorContext wrapper for timerListMachine
spacetimedb/                   # SpacetimeDB server module (spacetime init)
  spacetimedb/                # TypeScript server module (published to Maincloud)
  src/module_bindings/        # Generated TS bindings (spacetime:generate — do not edit)
  spacetime.json              # Module config (server: maincloud)
  .env.local                  # SpacetimeDB host + DB name (not gitignored in spacetimedb/)
static/                       # Static assets served as-is
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
- `useMachine` and `useSelector` come from `@xstate/react`. `useSelector(actorRef, selector)` subscribes a component to an actor's state.
- `createActorContext(machine)` from `@xstate/react` creates a React context with a `Provider`, `useSelector`, and `useActorRef` — used in `src/lib/timerListContext.tsx` for the root machine.
- `InterpreterFrom<T>` → use `Actor<T>` for the actor type; `StateFrom<T>` → `SnapshotFrom<T>`.
- The root page machine (`src/lib/timerListMachine.ts`) manages `timerList` state — loading from `localStorage`, adding/removing timers, and persisting changes back to `localStorage`.
- The root machine is provided via `TimerListContext.Provider` in `src/app/page.tsx` and consumed via `TimerListContext.useSelector` / `TimerListContext.useActorRef` in child components.

---

---

## Authentication — SpacetimeAuth + react-oidc-context

Authentication uses SpacetimeDB's own OIDC provider (SpacetimeAuth) with Google as the identity provider.

- **Library**: `react-oidc-context` + `oidc-client-ts`
- **Authority**: `https://auth.spacetimedb.com/oidc`
- **Client ID**: `client_032dnbwPlt1yJpQgZmVB3e` — public identifier; stored as plaintext in `ansible/vars/main.yml`, exposed as `NEXT_PUBLIC_SPACETIMEDB_AUTH_CLIENT_ID` via `ansible/templates/env.j2`
- **Client secret**: not used. SpacetimeAuth registers browser clients as public OIDC clients (`token_endpoint_auth_method: none`). PKCE (`S256`) is the security mechanism for the code exchange — no `client_secret` is sent or needed.
- **Token storage**: `sessionStorage` (oidc-client-ts default for `userStore`). JS-set cookies are NOT recommended per IETF draft-ietf-oauth-browser-based-apps §8.1 for browser-only SPAs. True HttpOnly cookie security needs a BFF server, which this app does not have.
- **State store**: `localStorage` (via `WebStorageStateStore`). The PKCE `code_verifier` and OIDC `state` are stored in `localStorage` so they survive mobile browser in-app redirects, which use an isolated context that does not share `sessionStorage` with the originating tab. Without this, mobile sign-in fails with "No matching state found in storage".
- **Redirect URI**: `window.location.origin` (root `/`) — no `/callback` route needed. `onSigninCallback` uses `window.history.replaceState` to clean up `?code=&state=` from the URL after exchange.
- **Silent renew**: `automaticSilentRenew: true` — uses refresh tokens, not iframes.
- **`OidcProvider`**: `src/components/OidcProvider.tsx` — `"use client"` wrapper around `AuthProvider`. Placed in `src/app/layout.tsx` wrapping `{children}`.
- **`AuthGate`**: `src/components/organism/AuthGate.tsx` — `"use client"`, uses `useAuth()`. Shows a "Sign in with Google" button when unauthenticated; renders children when authenticated. No sign-out UI.
- **Page structure**: `<OidcProvider>` (layout) → `<AuthGate>` → `<TimerListContext.Provider>` → `<PageContent>` (page.tsx)

### SpacetimeAuth dashboard setup (one-time, manual)

1. Deploy the SpacetimeDB module: `cd spacetimedb && npm run spacetime:publish`
2. In the SpacetimeDB dashboard → your module → **SpacetimeAuth** tab → enable it
3. **Identity Providers** tab → add Google → paste your Google OAuth Client ID + Secret (authorized redirect URI for Google: `https://auth.spacetimedb.com/interactions/federated/callback/google`)
4. **Clients** tab → register redirect URIs: `http://localhost:3000` and `https://timer-counter.saikat.dev`

---

## SpacetimeDB

- Server module: `spacetimedb/` (TypeScript, publishes to `maincloud.spacetimedb.com`)
- Generated bindings: `spacetimedb/src/module_bindings/` — auto-generated, do not edit manually
- To regenerate bindings after publishing module changes: `cd spacetimedb && npm run spacetime:generate`
- To publish module: `cd spacetimedb && npm run spacetime:publish`
- `spacetimedb/dist/` is gitignored (build artifact)

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
- Custom domain: `timer-counter.saikat.dev` (configured via `static/CNAME`). DNS is a proxied Cloudflare CNAME pointing to `saikatdas0790.github.io`.
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
