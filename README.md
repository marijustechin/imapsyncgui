# imapSyncGUI

Desktop application for migrating email between IMAP servers using
[`imapsync`](https://github.com/imapsync/imapsync), without requiring the end
user to use a terminal.

> Initial target platform: macOS.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- [pnpm](https://pnpm.io/) 11 or newer

The package manager version is pinned in the `packageManager` field of the root
`package.json`. With [Corepack](https://nodejs.org/api/corepack.html) enabled
(`corepack enable`), the pinned pnpm version is used automatically.

## Install

```sh
pnpm install
```

## Verify

Run the full verification pipeline (lint, typecheck, tests, production build):

```sh
pnpm verify
```

## Run in development

```sh
pnpm dev
```

This starts the Vite dev server and launches Electron with the renderer
hot-reloaded.

### imapsync runtime

Production builds bundle the required imapsync runtime with the application.
End users do not need to install Homebrew, MacPorts, Perl, or imapsync.
For local development, the application may use either:

- an executable specified via IMAPSYNC_EXECUTABLE; or
- imapsync available on the developer's PATH.
  On macOS, developers may optionally install a local development copy with:

brew install imapsync

Automated tests do not require a real imapsync installation; they use injected test doubles.

### Bundled runtime tooling

Native runtime build/validation commands (see `docs/runtime.md`):

```sh
pnpm runtime:build
pnpm runtime:validate
pnpm runtime:self-test
```

These stage, validate, and self-test the architecture-specific runtime and are
not part of `pnpm verify`.

### Packaging

Distributable macOS artifacts (per architecture, no universal build):

```sh
pnpm package:mac:x64
pnpm package:mac:arm64
pnpm package:smoke
```

Artifacts are written to `apps/desktop/release`. They are currently **unsigned
and not notarized**.

> Status: the x86_64 runtime is a self-contained official `imapsync` binary
> (ADR-012) and is bundled, validated, self-tested, packaged, and smoke-tested.
> The arm64 runtime and signing/notarization remain follow-ups. See
> `docs/runtime.md` and `docs/third-party-licenses.md`.

### Native arm64 CI

The arm64 runtime/package verification runs on a GitHub-hosted Apple Silicon
runner via `.github/workflows/macos-arm64.yml` (manual `workflow_dispatch`). It
requires native arm64 hardware (the workflow hard-fails otherwise) and runs the
full build → validate → self-test → package → smoke sequence. See ADR-014 and
`docs/runtime.md`.

## Production build

```sh
pnpm build
```

The compiled main, preload, and renderer bundles are written to
`apps/desktop/out`.

## Repository structure

```
apps/desktop/          Electron application
  src/main/            Main process (Node.js / Electron APIs)
  src/preload/         Preload script (contextBridge surface)
  src/renderer/        Renderer (React + TypeScript)
  src/shared/          Shared IPC/domain contract (main, preload, renderer)
docs/                  Product, architecture, security, and testing docs
tasks/                 Current task and backlog
```

## Security model

The application enforces a strict Electron process boundary:

- `contextIsolation` is enabled.
- `nodeIntegration` is disabled.
- The renderer runs with `sandbox` enabled.

The renderer has no direct Node.js access. All privileged operations go through
the preload script, which exposes a narrowly scoped, typed API (`window.api`)
with exactly three operations: `testConnection`, `startMigration`, and
`cancelMigration`. Each request is runtime-validated in the main process before
use.

## Task lifecycle

The task lifecycle is defined canonically in `AGENTS.md`. In short, when a task
is completed:

1. Ensure all acceptance criteria are satisfied.
2. Run `pnpm verify`.
3. Mark the task `Complete` in `tasks/current.md`.
4. Copy it to `tasks/done/TASK-XXX.md`.
5. Add an entry to `docs/progress.md`.
6. Update `tasks/backlog.md`; do not automatically start the next task.
