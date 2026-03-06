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

**timer-counter** is a SvelteKit Progressive Web App (PWA) that provides labelled pomodoro timers with attached counters. It works offline and syncs across devices using [Internet Identity](https://identity.ic0.app/) and a Motoko backend canister on the [Internet Computer (ICP)](https://internetcomputer.org/).

- **Frontend**: SvelteKit (static adapter) + TypeScript + Tailwind CSS + XState v4
- **Backend**: Motoko canister on ICP, managed by `dfx`
- **Auth**: `@dfinity/auth-client` with Internet Identity
- **Testing**: Vitest
- **Formatting/Linting**: Prettier + ESLint

---

## Repository Layout

```
src/
  app.css                     # Global Tailwind base styles
  app.html                    # SvelteKit HTML shell
  hooks.ts                    # SvelteKit hooks (e.g. handle)
  canisters/backend/main.mo   # Motoko backend canister source
  declarations/               # Auto-generated canister bindings (dfx generate)
  components/                 # UI — follows atomic design (see below)
  routes/                     # SvelteKit file-based routes
static/                       # Static assets served as-is
.devcontainer/                # Dev container config (see Devcontainer section)
.github/workflows/deploy.yml  # CI/CD — deploys to IC mainnet on push
dfx.json                      # DFX canister + network config
canister_ids.json             # Mainnet canister IDs (committed)
svelte.config.js              # SvelteKit config, path aliases, Vite setup
tailwind.config.cjs           # Tailwind config
tsconfig.json                 # TypeScript config (extends .svelte-kit/tsconfig.json)
```

---

## Component Architecture — Atomic Design

Components live under `src/components/` and follow a strict three-tier atomic hierarchy:

| Tier | Path | Description |
|---|---|---|
| `atom` | `src/components/atom/` | Primitive, stateless UI pieces (buttons, icons, inputs, displays, dividers) |
| `molecule` | `src/components/molecule/` | Composed atoms with local behaviour (timer/counter, sync button, counter) |
| `organism` | `src/components/organism/` | Full page sections composed of molecules (grid, controls) |

Always place new components at the lowest tier that makes sense. Do not import atoms from organism-level or import organisms from molecule-level.

---

## Path Aliases

Three path aliases are configured in both `tsconfig.json` and `svelte.config.js`:

| Alias | Resolves to |
|---|---|
| `$canisters/*` | `src/declarations/*` |
| `$components/*` | `src/components/*` |
| `$routes/*` | `src/routes/*` |

Always use these aliases for cross-directory imports instead of relative `../` paths.

---

## State Management — XState v4

All non-trivial state lives in XState v4 machines. Conventions:

- Machine definitions are in `.ts` files alongside the component that owns them (e.g. `TimerCounter.ts` next to `TimerCounter.svelte`).
- Typegen files (`*.typegen.ts`) are auto-generated — never edit them manually.
- The `tsTypes` field must be declared as `{} as import("./Foo.typegen").TypegenN` at the top of every machine.
- The root page machine (`src/routes/_index.ts`) is a **parallel** machine coordinating the timer list + auth + sync states.
- Child actor machines are spawned from the root machine and communicated with via `sendParent`.
- Machines are connected to Svelte components via `useMachine` from `@xstate/svelte`.
- The root machine is passed to child components via Svelte's `setContext` / `getContext` using the key `"timerListMachine"`.

---

## Backend Canister (Motoko)

- Source: `src/canisters/backend/main.mo`
- Canister name in dfx: `backend_canister`
- The canister stores a `HashMap<Principal, Text>` — each user's entire timer state is serialised to JSON and stored as a single `Text` value.
- Generated TypeScript bindings live in `src/declarations/backend_canister/` — regenerate with `npm run dev:deploy` after changing the Motoko interface.
- **Never edit files in `src/declarations/` by hand.**
- Stable upgrade hooks (`preupgrade` / `postupgrade`) are implemented to preserve state across canister upgrades.

---

## Scripts Reference

| Script | Purpose |
|---|---|
| `npm run dev` | Start SvelteKit dev server |
| `npm run dfx:start` | Start local DFX replica |
| `npm run dev:deploy` | Deploy backend canister locally + regenerate bindings |
| `npm run build` | Production build (SvelteKit + PWA manifest) |
| `npm run ic:deploy` | Deploy all canisters to IC mainnet |
| `npm run test` | Run Vitest tests |
| `npm run coverage` | Vitest with coverage (c8) |
| `npm run check` | `svelte-check` type check |
| `npm run lint` | Prettier + ESLint check |
| `npm run format` | Prettier auto-format |

---

## CI/CD

- Workflow: `.github/workflows/deploy.yml`
- Triggers on every push to any branch (currently not gated to `main` — the `if: github.ref` guard is commented out).
- Uses DFX version `0.10.1` (pinned).
- Deploys to IC mainnet using an identity PEM stored in the `ACTIONS_IDENTITY_SECRET` repository secret.
- The unit test job is currently commented out.

---

## Devcontainer

This repository is a **git submodule** inside a parent Kubernetes monorepo (`apps/timer-counter`). The devcontainer is designed to work correctly when opened as a standalone VS Code instance without the parent repo being checked out.

### How git is made to work standalone

The `.git` entry is a gitfile pointing to `../../.git/modules/apps/timer-counter`. Inside the container:

1. **Mount**: `devcontainer.json` bind-mounts the parent repo's `.git` directory to `/.git` inside the container via `${localWorkspaceFolder}/../../.git`.
2. **`GIT_WORK_TREE`**: Set to `/workspaces/timer-counter` in `remoteEnv`. This overrides the `core.worktree` value in the shared git module config (which stores a host-relative path that does not exist inside the container) without modifying any shared config file.

This means commits made in the container go directly into the bind-mounted git dir and are **immediately visible in the parent repo context** — no push/pull to remote required to share changes between the two contexts.

### Key devcontainer mounts

| Source (host) | Target (container) | Purpose |
|---|---|---|
| `~/.ssh/agent.sock` | `/ssh-agent` | SSH agent forwarding |
| `~/.config/gh` | `/home/vscode/.config/gh` | GitHub CLI auth state |
| `${localWorkspaceFolder}/../../.git` | `/.git` | Parent repo git dir for submodule resolution |

### postCreate.sh

Runs on container creation. Responsibilities:
- Installs `dnsutils` (`dig`, `nslookup`, `host`)
- Checks and reports SSH agent accessibility
- Configures GitHub CLI to use SSH protocol

---

## Canister Environments

| Environment | Canister IDs source | DFX network flag |
|---|---|---|
| Local dev | `.dfx/local/canister_ids.json` (gitignored) | *(default/local)* |
| IC mainnet | `canister_ids.json` (committed) | `--network ic` |

`svelte.config.js` reads the appropriate file based on `NODE_ENV` and injects canister IDs as `process.env.<CANISTER_NAME>_CANISTER_ID` at build time.
