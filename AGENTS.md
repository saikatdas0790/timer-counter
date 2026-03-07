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

**timer-counter** is a Next.js Progressive Web App (PWA) that provides labelled pomodoro timers with attached counters. It works offline with client-side localStorage persistence. Backend sync (SpacetimeDB) and auth will be added in a future iteration.

- **Frontend**: Next.js v16 (static export) + TypeScript 5 + Tailwind CSS v4 + XState v5
- **Persistence**: `localStorage` (client-only, no backend currently)
- **Testing**: Vitest
- **Formatting/Linting**: Prettier + ESLint

---

## Repository Layout

```
src/
  app/                        # Next.js App Router
    globals.css               # Global Tailwind base styles
    layout.tsx                # Root layout (HTML shell + metadata)
    page.tsx                  # Home page (client component, mounts timerListMachine)
  components/                 # UI — follows atomic design (see below)
  lib/
    timerListMachine.ts       # Root XState machine (timer list + localStorage)
    timerListContext.tsx       # createActorContext wrapper for timerListMachine
static/                       # Static assets served as-is
.devcontainer/                # Dev container config (see Devcontainer section)
.github/workflows/deploy.yml  # CI/CD — builds and deploys to GitHub Pages on push to main
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

| Alias   | Resolves to |
| ------- | ----------- |
| `@/*`   | `src/*`     |

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

## Scripts Reference

| Script               | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start Next.js dev server                            |
| `npm run build`      | Production build (static export to `out/`)          |
| `npm run start`      | Serve the static export locally                     |
| `npm run test`       | Run Vitest tests                                    |
| `npm run coverage`   | Vitest with coverage (c8)                           |
| `npm run lint`       | Prettier + ESLint check                             |
| `npm run format`     | Prettier auto-format                                |

## CI/CD

- Workflow: `.github/workflows/deploy.yml`
- Triggers on push to `main`.
- **Builds run inside the devcontainer** via `devcontainers/ci@v0.3`, so CI is byte-for-byte identical to the local dev environment. The devcontainer image is cached in GHCR under `ghcr.io/<owner>/timer-counter-devcontainer`.
- The runner creates placeholder stubs for the two devcontainer bind-mount sources that don't exist in CI (`~/.ssh/agent.sock` and `~/.config/gh`) before launching the container.
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

---

## Devcontainer

### Key devcontainer mounts

| Source (host)       | Target (container)        | Purpose              |
| ------------------- | ------------------------- | -------------------- |
| `~/.ssh/agent.sock` | `/ssh-agent`              | SSH agent forwarding |
| `~/.config/gh`      | `/home/vscode/.config/gh` | GitHub CLI auth state |

### postCreate.sh

Runs on container creation. Responsibilities:

- Installs `dnsutils` (`dig`, `nslookup`, `host`)
- Checks and reports SSH agent accessibility
- Configures GitHub CLI to use SSH protocol

---


