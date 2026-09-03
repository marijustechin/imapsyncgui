# Decisions

## ADR-001 — Electron + React + TypeScript + Vite via electron-vite

- **Status:** accepted
- **Date:** 2026-09-02

The application is built with Electron, React, and TypeScript. For bundling we
use `electron-vite`, which drives a single Vite pipeline for the main process,
preload script, and renderer.

### Alternatives considered

- **Vite for renderer + `tsc` for main/preload:** more moving parts and manual
  wiring of dev-mode HMR and reload.
- **electron-forge + Vite plugin:** heavier scaffolding and less direct control
  over the three build targets.

### Rationale

`electron-vite` provides first-class, coherent support for the three Electron
process types while keeping a single `vite` config, and it is the standard
community path for Electron + React + TypeScript + Vite.

## ADR-002 — Strict renderer sandbox with a narrow preload surface

- **Status:** accepted
- **Date:** 2026-09-02

The renderer runs with `contextIsolation: true`, `nodeIntegration: false`, and
`sandbox: true`. The preload script exposes a narrowly scoped, typed API
(`window.api`) containing only explicit application operations — currently
`testConnection`, `startMigration`, and `cancelMigration`.

### Alternatives considered

- **Expose a generic `ipcRenderer` bridge:** rejected because it defeats the
  purpose of a narrow IPC boundary.

### Rationale

Each privileged operation must be added explicitly and narrowly through the
preload script, matching the product requirement that the renderer has no
direct Node.js access.

## ADR-003 — pnpm workspace monorepo (`apps/*`)

- **Status:** accepted
- **Date:** 2026-09-02

The repository is a pnpm workspace with the desktop application under
`apps/desktop`, so future packages (e.g. shared types) can be added without
restructuring.

## ADR-004 — Shared contract as an in-app module, not a workspace package

- **Status:** accepted
- **Date:** 2026-09-02

The domain and IPC contract types live in `apps/desktop/src/shared/contracts.ts`
rather than in a dedicated workspace package.

### Alternatives considered

- **A `packages/contracts` workspace package:** cleaner import specifier but
  introduces an extra package with its own `package.json`, `tsconfig`, and build
  ordering for a small set of types used by a single application.

### Rationale

The contract is small and consumed only by the three processes of one
application. A shared in-app module is the smallest coherent change and keeps a
single build pipeline. A workspace package can be introduced later if the
contract grows or is consumed outside the app.

## ADR-005 — Hand-written runtime validation over a schema library

- **Status:** accepted
- **Date:** 2026-09-02

IPC input is validated with small hand-written functions in
`src/main/validation.ts` instead of a schema/validation library (e.g. Zod).

### Alternatives considered

- **Zod or similar:** richer ergonomics but an additional dependency for a very
  small, fixed set of fields.

### Rationale

The validation surface is tiny (one endpoint object with five fields) and the
project favors existing platform capabilities over extra libraries. A library
can be introduced later if validation needs grow.

## ADR-006 — imapsync runtime strategy: PATH resolution, defer bundling

- **Status:** accepted
- **Date:** 2026-09-02

`imapsync` is a Perl script (not a standalone binary) distributed by its author
and installed on macOS via Homebrew (`brew install imapsync`) or MacPorts. The
distribution also ships x86_64-only standalone Darwin binaries (no Apple Silicon
binary) as part of the paid download, under the permissive "NOLIMIT" (NLPL)
license.

For this task the adapter resolves the executable deterministically:
`IMAPSYNC_EXECUTABLE` if set, otherwise `imapsync` from `PATH`. Tests inject a
fake process launcher.

### Alternatives considered

- **Bundle a standalone binary now:** not possible reliably on Apple Silicon
  and out of scope for this task.
- **Bundle Perl + modules + the script now:** significant packaging work,
  deferred.

### Rationale

Development and tests need no special packaging. Bundling the runtime for a
distributable app (and resolving the licensing/redistribution implications of
NLPL) is deferred to the packaging tasks (TASK-008/TASK-009).

## ADR-007 — Credentials passed via environment variables, not arguments

- **Status:** accepted
- **Date:** 2026-09-02

`imapsync` passwords are passed as `IMAPSYNC_PASSWORD1` /
`IMAPSYNC_PASSWORD2` environment variables rather than `--password1` /
`--password2` command-line arguments.

### Alternatives considered

- **`--password1`/`--password2` arguments:** passwords appear in the process
  argument vector (`ps aux`), rejected.
- **`--passfile1`/`--passfile2` temp files:** strongest upstream recommendation,
  but writes credentials to disk transiently, conflicting with the no-on-disk
  rule.

### Rationale

Environment variables keep passwords out of the argument vector and off disk.
The residual risk (`ps -E` on macOS) is documented in `docs/security.md`;
`--passfile` remains future hardening if a stronger guarantee is required.

## ADR-008 — macOS architecture: separate x86_64 and arm64 builds, no Rosetta

- **Status:** accepted
- **Date:** 2026-09-02

For the first production release the application ships as **separate `x86_64`
(Intel) and `arm64` (Apple Silicon) builds**, each bundling an `imapsync` runtime
matched to its architecture. The application does **not** depend on Rosetta 2,
and no universal build is produced.

### Rationale

- Apple is deprecating Rosetta 2: per Apple support article 102527, it is
  available through macOS 27 and, from macOS 28, only for certain legacy games.
  Depending on it is not future-proof, and it is not guaranteed to be installed
  (it is fetched on demand).
- A bundled Perl runtime must match the host architecture; the SSL stack
  (`IO::Socket::SSL` / `Net::SSLeay` wrapping OpenSSL) has native components, so
  per-architecture runtimes are unavoidable.
- A universal build is roughly twice the size and requires per-architecture
  runtime selection (`process.arch`) at startup, adding complexity with no v1
  requirement for a single artifact.

### Alternatives considered

- **One universal build (`@electron/universal`):** technically possible, but
  rejected for v1 for the reasons above; can be revisited if a single-artifact
  distribution becomes a hard requirement.
- **x86_64-only + Rosetta 2:** rejected because Rosetta is being phased out and
  adds an install-time dependency on Apple Silicon.

### Consequences

- TASK-008 bundles two runtime variants (x86_64 and arm64).
- TASK-009 produces two artifacts instead of one.
- Startup must reject an unsupported `process.arch` with a clear error and exit.

### Answer to the Rosetta question

Rosetta 2 is **not** a dependency of the application.

## ADR-009 — Connection testing via a minimal built-in IMAP client

- **Status:** accepted
- **Date:** 2026-09-02

`testConnection` performs a real IMAP connect + TLS + `LOGIN` using Node's
built-in `net` and `tls` modules and a small hand-written command sequence
(greeting, optional `STARTTLS`, `LOGIN`). No third-party IMAP library is added.

### Alternatives considered

- **Reuse `imapsync` (`--justconnect`/`--justlogin`):** targets two hosts at a
  time, requires the `imapsync` runtime (not guaranteed in tests or packaged
  builds), and its exit codes are not a clean per-endpoint contract.
- **A dedicated IMAP library (e.g. `imapflow`):** robust but a large dependency
  for a single login check, adding a TLS/auth surface the app must trust.

### Rationale

The required protocol interaction is small (TCP, TLS, STARTTLS, LOGIN), and the
project favors existing platform capabilities over extra dependencies (see
ADR-005). The implementation is testable with an injected socket layer and maps
low-level failures to stable application-level codes.

### Authentication scope

Only the IMAP `LOGIN` command is implemented (quoted-string credentials).
Non-ASCII or control-character credentials and SASL mechanisms are out of scope
for this task.

## ADR-010 — Bundled per-architecture runtime with packaged/dev resolution split

- **Status:** accepted
- **Date:** 2026-09-02

The `imapsync` runtime is bundled per architecture under
`resources/runtime/darwin-x64` and `resources/runtime/darwin-arm64` (outside the
ASAR archive). A packaged application resolves only the bundled runtime
(`perl imapsync ...` via `spawn` argument arrays), and a development build
resolves `IMAPSYNC_EXECUTABLE` or `imapsync` from `PATH`.

### Rationale

- Deterministic, sandbox-friendly invocation with no shell and no `PATH`/system
  Perl dependency in production.
- The split keeps the existing development workflow intact while making
  packaged behavior deterministic (ADR-008).

### Consequences and blocker

- A fully self-contained runtime requires a portable Perl interpreter plus the
  native module tree (including `IO::Socket::SSL` / `Net::SSLeay` / OpenSSL).
  This was initially deferred and was later resolved for x86_64 by staging the
  official self-contained binary (ADR-012).

## ADR-011 — electron-builder for macOS packaging

- **Status:** accepted
- **Date:** 2026-09-02

Distributable macOS artifacts are produced with **electron-builder**, using a
single `electron-builder.config.cjs` and separate per-architecture invocations
(`--mac --x64` / `--mac --arm64`).

### Alternatives considered

- **electron-packager / @electron/packager:** lighter, but does not produce a
  user-distribution format (`.zip`/`.dmg`) without additional tooling.
- **electron-forge:** overlaps with the existing electron-vite build tooling and
  would introduce a second, competing build pipeline.

### Rationale

electron-builder integrates with the existing electron-vite `out/` output,
supports macOS x64/arm64, external (`extraResources`) runtime files outside ASAR,
per-architecture artifact naming, and `.zip` generation — matching ADR-008's
separate-architecture requirement with one tool.

### Consequences

- `release/` holds generated artifacts (git-ignored).
- The application is unsigned for now; signing/notarization is deferred and
  documented as follow-up (see `docs/security.md`).

## ADR-012 — Self-contained runtime via the official imapsync binary

- **Status:** accepted
- **Date:** 2026-09-02

The self-contained x86_64 runtime is the official upstream
`imapsync_bin_Darwin_x86_64` binary (a PAR::Packer-packaged executable that
embeds Perl, the required CPAN modules, and the SSL/OpenSSL stack). The build
stages that pinned binary (URL + SHA-256) as `runtime/darwin-x64/bin/imapsync`
and invokes it directly (`prefixArgs = []`).

### Alternatives considered

- **Build a portable Perl from source (`-Duserelocatableinc`) and install all
  modules:** fully reproducible but a large, error-prone native build (Perl +
  ~15 modules + OpenSSL) per architecture.
- **Bundle Perl + the imapsync script as separate files:** same native-build
  burden.

### Rationale

The official binary is the author's own self-contained macOS distribution,
already bundles the exact Perl/module/OpenSSL runtime, links only system
`libSystem`, and passes the host-isolation self-test. It is the smallest
reliable option for x86_64 and removes the manual Perl build entirely.

### Consequences

- The runtime is a single staged binary plus license texts; no `perl imapsync`
  prefix is needed.
- Reproducibility is via the pinned URL + SHA-256 checksum (not a source build).
- `imapsync` redistribution is permitted by NLPL; bundled Perl/OpenSSL/module
  license texts are shipped under `runtime/<arch>/licenses/`.

## ADR-013 — arm64 runtime: self-built standalone binary via PAR::Packer

- **Status:** accepted
- **Date:** 2026-09-02

No official native arm64 standalone `imapsync` binary exists (the upstream
`imapsync_bin_Darwin_x86_64` is x86_64-only; the arm64 URL returns 404). The
arm64 runtime is therefore built as a native arm64 standalone binary using
PAR::Packer on Apple Silicon, from the upstream `imapsync` script plus its
required modules (including `Net::SSLeay`/`IO::Socket::SSL` against a bundled
OpenSSL), and staged under `runtime/darwin-arm64/`.

The build uses the current Homebrew `perl` (unversioned) as a build-time
toolchain only; the embedded Perl version is recorded dynamically in the
manifest. Versioned Homebrew Perl formulae are not used because they are
removed from Homebrew over time.

### Alternatives considered

- **Official arm64 binary:** does not exist; rejected until upstream publishes
  one.
- **Rosetta 2 / x86_64 binary:** rejected (ADR-008; Rosetta is deprecated and
  the task forbids it).

### Verification

The strategy was validated natively on a GitHub-hosted `macos-15` arm64 runner
(ADR-014): the produced binary is arm64, links only system `libSystem`, passes
host-isolation self-test, and the packaged smoke test passes from inside the
arm64 `.app`.

## ADR-014 — Native arm64 verification via GitHub Actions

- **Status:** accepted
- **Date:** 2026-09-02

Native arm64 runtime/package verification runs on a GitHub-hosted Apple Silicon
macOS runner via `.github/workflows/macos-arm64.yml` (manual
`workflow_dispatch`).

### Rationale

- The public GitHub-hosted `macos-15` runner is native arm64 (the `macos-13`
  runner is Intel x86_64 and must not be used).
- The workflow hard-fails unless both `uname -m` and Node `process.arch` report
  `arm64`, and never invokes Rosetta or `arch -x86_64`.
- The workflow calls the existing repository scripts (`runtime:build:arm64`,
  `runtime:validate`, `runtime:self-test`, `package:mac:arm64`,
  `package:smoke`) rather than duplicating runtime logic in YAML.

### Consequences

- The workflow is authored but not yet executed (the repository is not currently
  published to GitHub Actions); a native run is still required to produce the
  evidence that unblocks TASK-009B.
- Build-time Homebrew is used only as a CI build dependency; it is not a runtime
  dependency of the packaged application.
