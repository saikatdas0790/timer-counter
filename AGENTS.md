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

**timer-counter** is a SvelteKit Progressive Web App (PWA) that provides labelled pomodoro timers with attached counters. It works offline with client-side localStorage persistence. Backend sync (SpacetimeDB) and auth will be added in a future iteration.

- **Frontend**: SvelteKit v2 (static adapter) + TypeScript 5 + Tailwind CSS v4 + XState v5
- **Persistence**: `localStorage` (client-only, no backend currently)
- **Testing**: Vitest
- **Formatting/Linting**: Prettier + ESLint

---

## Repository Layout

```
src/
  app.css                     # Global Tailwind base styles
  app.html                    # SvelteKit HTML shell
  hooks.ts                    # SvelteKit hooks (e.g. handle)
  components/                 # UI — follows atomic design (see below)
  routes/                     # SvelteKit file-based routes
static/                       # Static assets served as-is
.devcontainer/                # Dev container config (see Devcontainer section)
.github/workflows/docker.yml  # CI/CD — builds and pushes Docker image on push to main
.npmrc                        # npm config (currently empty)
svelte.config.js              # SvelteKit config (adapter, aliases, preprocessor only)
vite.config.js                # Vite config (plugins only)
tsconfig.json                 # TypeScript config (extends .svelte-kit/tsconfig.json)
pwa.js                        # Post-build script to copy PWA manifest + service worker
```

---

## Route File Conventions — SvelteKit v2

This project uses SvelteKit v2's file-based routing conventions:

- Page component: `+page.svelte` (was `index.svelte` in v1)
- Layout component: `+layout.svelte` (was `__layout.svelte` in v1)
- Page data loader: `+page.ts` / `+page.server.ts`
- Layout data loader: `+layout.ts` / `+layout.server.ts`

Do not create route files with the old v1 naming (unprefixed `index.svelte` or `__layout.svelte`).

---

## Vite vs SvelteKit Config Split

In SvelteKit v2, Vite configuration is separated from SvelteKit configuration:

- **`svelte.config.js`**: Only SvelteKit-specific options — adapter, aliases, preprocessor. Never put `plugins`, `define`, or `server` here.
- **`vite.config.js`**: All Vite options — plugins (including `tailwindcss()`, `sveltekit()`, and `VitePWA`).

Plugin order in `vite.config.js` is `[tailwindcss(), sveltekit(), VitePWA(...)]` — `tailwindcss()` must come first. There is no `postcss.config.cjs`; Tailwind v4 runs entirely through the Vite plugin.

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

## Path Aliases

Three path aliases are configured in both `tsconfig.json` and `svelte.config.js`:

| Alias           | Resolves to          |
| --------------- | -------------------- |
| `$components/*` | `src/components/*`   |
| `$routes/*`     | `src/routes/*`       |

Always use these aliases for cross-directory imports instead of relative `../` paths.

Do **not** re-declare these aliases in `tsconfig.json` — SvelteKit v2 auto-generates them in `.svelte-kit/tsconfig.json` (which `tsconfig.json` extends). Manual redeclaration causes intellisense conflicts.

---

## State Management — XState v5

All non-trivial state lives in XState v5 machines. Conventions:

- Machine definitions are in `.ts` files alongside the component that owns them (e.g. `TimerCounter.ts` next to `TimerCounter.svelte`).
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
- `useMachine` from `@xstate/svelte` now returns `{ snapshot, send, actorRef }` (was `{ state, send, service }` in v4). The `snapshot` store replaces `state`.
- `InterpreterFrom<T>` → use `Actor<T>` for the actor type; `StateFrom<T>` → `SnapshotFrom<T>`.
- The root page machine (`src/routes/_index.ts`) manages `timerList` state — loading from `localStorage`, adding/removing timers, and persisting changes back to `localStorage`.
- The root machine is passed to child components via Svelte's `setContext` / `getContext` using the key `"timerListMachine"` as `{ snapshot, send }`.

---

---

## Scripts Reference

| Script               | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Start SvelteKit dev server (via Vite)                       |
| `npm run build`      | Production build (`vite build` + PWA manifest via `pwa.js`) |
| `npm run test`       | Run Vitest tests                                            |
| `npm run coverage`   | Vitest with coverage (c8)                                   |
| `npm run check`      | `svelte-check` type check                                   |
| `npm run lint`       | Prettier + ESLint check                                     |
| `npm run format`     | Prettier auto-format                                        |

## CI/CD

- Workflow: `.github/workflows/docker.yml`
- Triggers on push to `main`.
- **Builds run inside the devcontainer** via `devcontainers/ci@v0.3`, so CI is byte-for-byte identical to the local dev environment. The devcontainer image is cached in GHCR under `ghcr.io/<owner>/timer-counter-devcontainer`.
- The runner creates placeholder stubs for the three devcontainer bind-mount sources that don't exist in CI (`~/.ssh/agent.sock`, `~/.config/gh`, and `$GITHUB_WORKSPACE/../../.git`) before launching the container.
- Build output (`build/`) is written into the runner workspace by the devcontainer step, then copied into an `nginx:alpine` Docker image and pushed to `ghcr.io/<owner>/timer-counter`.
- The `Dockerfile` contains **no build stage** — it just `COPY build /usr/share/nginx/html`. All compilation happens in the devcontainer step.
- Image is tagged with a timestamp+SHA tag and `latest`.

---

## Tooling Preferences

- **Use `gh` CLI** for all GitHub interactions (viewing CI runs, opening PRs, fetching issue details, etc.) instead of fetching web URLs. The `gh` CLI is pre-installed and authenticated in the devcontainer. Example: `gh run view --log-failed` to inspect a failing CI run.

---

## Dependency Notes

All packages in the dependency tree are compatible with the current npm version — no `legacy-peer-deps` workaround is needed.

Tailwind CSS v4 uses the `@tailwindcss/vite` Vite plugin and has no `tailwind.config.cjs` or `postcss.config.cjs`. The only Tailwind entry point is `@import "tailwindcss"` in `src/app.css`. All customisation goes through CSS custom properties in `src/app.css` (Tailwind v4 CSS-based config). `autoprefixer` is no longer a dependency (built into v4).

ESLint uses the flat config format (`eslint.config.js`) — the old `.eslintrc` format is not used. The `eslint-plugin-svelte3` package has been replaced by `eslint-plugin-svelte`. `no-undef` is disabled for TypeScript files (TypeScript handles undefined variable checks). `@typescript-eslint/no-unused-vars` is configured to allow `_`-prefixed names as intentionally unused. `prettier-plugin-svelte` is registered via `.prettierrc`.

---

This repository is a **git submodule** inside a parent Kubernetes monorepo (`apps/timer-counter`). The devcontainer is designed to work correctly when opened as a standalone VS Code instance without the parent repo being checked out.

### How git is made to work standalone

The `.git` entry is a gitfile pointing to `../../.git/modules/apps/timer-counter`. Inside the container:

1. **Mount**: `devcontainer.json` bind-mounts the parent repo's `.git` directory to `/.git` inside the container via `${localWorkspaceFolder}/../../.git`.
2. **`GIT_WORK_TREE`**: Set to `/workspaces/timer-counter` in `remoteEnv`. This overrides the `core.worktree` value in the shared git module config (which stores a host-relative path that does not exist inside the container) without modifying any shared config file.

This means commits made in the container go directly into the bind-mounted git dir and are **immediately visible in the parent repo context** — no push/pull to remote required to share changes between the two contexts.

### Key devcontainer mounts

| Source (host)                        | Target (container)        | Purpose                                      |
| ------------------------------------ | ------------------------- | -------------------------------------------- |
| `~/.ssh/agent.sock`                  | `/ssh-agent`              | SSH agent forwarding                         |
| `~/.config/gh`                       | `/home/vscode/.config/gh` | GitHub CLI auth state                        |
| `${localWorkspaceFolder}/../../.git` | `/.git`                   | Parent repo git dir for submodule resolution |

### postCreate.sh

Runs on container creation. Responsibilities:

- Installs `dnsutils` (`dig`, `nslookup`, `host`)
- Checks and reports SSH agent accessibility
- Configures GitHub CLI to use SSH protocol

---


