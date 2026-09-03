# Architecture

## Overview

`imapSyncGUI` is an Electron desktop application. It is organized as a pnpm
workspace with the application living under `apps/desktop`.

The application follows a strict Electron process boundary with three layers:

1. **Main process** (`apps/desktop/src/main`) — owns the Electron application
   lifecycle and window creation. It has full Node.js and Electron API access.
2. **Preload script** (`apps/desktop/src/preload`) — the only bridge between the
   renderer and privileged code. It exposes a narrowly scoped API via
   `contextBridge`.
3. **Renderer** (`apps/desktop/src/renderer`) — a React application rendered in
   a sandboxed browser context with no direct Node.js access.

## Build tooling

- **electron-vite** builds the main process, preload script, and renderer from a
  single Vite pipeline.
- **TypeScript** with separate `tsconfig.node.json` (main + preload) and
  `tsconfig.web.json` (renderer) projects. The renderer project deliberately
  excludes Node.js type definitions to reinforce the process boundary.
- **ESLint** (flat config) for linting.
- **Vitest** for unit tests.

## Process boundary

The renderer is created with:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

The preload script exposes a narrowly scoped, typed API (`window.api`). Each
operation is added explicitly; no generic `ipcRenderer` or Node.js capability is
ever forwarded to the renderer.

## Shared contract

`apps/desktop/src/shared/contracts.ts` defines the domain and IPC contract types
(`ImapEndpoint`, `MigrationInput`, result types, and channel names). It is a
pure TypeScript module with no dependency on Electron, Node.js, React, or
browser APIs, and it is imported by the main process, preload script, and
renderer.

## IPC contract

The renderer talks to the main process exclusively through three `invoke`
channels, all declared in `IPC_CHANNELS`:

- `migration:test-connection` → `ConnectionTestResult`
- `migration:start` → `MigrationStartResult`
- `migration:cancel` → `MigrationCancelResult`

The main process registers a handler for each channel and runtime-validates
incoming data (`src/main/validation.ts`) before using it, since TypeScript types
are erased at the IPC boundary and cannot be trusted.

## imapsync runtime adapter

The privileged runtime lives in `apps/desktop/src/main/imapsync/` and wraps the
`imapsync` command. It is independent of React and renderer code.

- `arguments.ts` — builds a fixed allowlist of arguments from `MigrationInput`.
- `sanitize.ts` — redacts credential values from process output.
- `launcher.ts` — launches the process with `spawn` using an argument array
  (no shell).
- `adapter.ts` — `MigrationAdapter`, the application-level facade that owns the
  process lifecycle (`starting`, `running`, `succeeded`, `failed`, `cancelled`)
  and emits sanitized output incrementally.

The adapter is constructed in the main process with a real process launcher and
an `onOutput` callback that broadcasts sanitized lines to the renderer over the
`migration:output` channel. The launcher is injected so the adapter can be
tested without a real `imapsync` installation.

## Runtime packaging

The bundled `imapsync` runtime lives under `apps/desktop/runtime/<arch>` in
development and is resolved from the packaged application's resources directory
(`<resources>/runtime/<arch>`) in production. See `docs/runtime.md` and
`docs/third-party-licenses.md`.

Resolution is implemented in `apps/desktop/src/main/runtime/`:

- `arch.ts` — `process.arch` → `darwin-x64` / `darwin-arm64`.
- `resolve.ts` — packaged vs development resolution.
- `manifest.ts` — runtime manifest parsing/validation.
- `validate.ts` — filesystem-injectable runtime validation.
- `errors.ts` — typed runtime failure codes and safe messages.
- `env.ts` — deterministic, sanitized child-process environment.

In packaged mode the adapter invokes the bundled self-contained `bin/imapsync`
binary directly (no separate Perl, no `prefixArgs`), preserving shell-free
`spawn` execution with a sanitized environment.

## Distribution packaging

electron-builder (`electron-builder.config.cjs`) produces the distributable
macOS artifacts:

- separate `--mac --x64` and `--mac --arm64` builds (no universal build);
- `files: ['out/**/*', 'package.json']` → application code inside `app.asar`;
- `extraResources` → the matching `runtime/<arch>` copied to
  `Contents/Resources/runtime/<arch>` (outside ASAR, executable);
- `artifactName: ${productName}-${version}-mac-${arch}.${ext}` → architecture is
  always identifiable from the filename.

Application identity (`com.imapsyncgui.desktop`, product name `imapSyncGUI`,
version `0.1.0`) and packaging metadata live in
`apps/desktop/package.json` / `src/main/packaging.ts`. Artifacts are unsigned
for now; signing/notarization is a deferred follow-up.

## macOS architecture and distribution

The first release targets Intel (`x86_64`) and Apple Silicon (`arm64`) macOS.
The decision and its rationale are recorded in ADR-008.

### Architecture matrix

| App architecture | Host architecture | imapsync runtime            | Expected behavior                          |
| ---------------- | ----------------- | --------------------------- | ------------------------------------------ |
| x86_64           | x86_64            | bundled x86_64 Perl + script | native, no Rosetta                        |
| arm64            | arm64             | bundled arm64 Perl + script  | native, no Rosetta                        |
| universal        | x86_64            | x86_64 runtime (x64 slice)  | native, but ~2× size and arch selection   |
| universal        | arm64             | arm64 runtime (arm64 slice) | native, but ~2× size and arch selection   |
| x86_64           | arm64 (Rosetta)   | x86_64 runtime              | works, but requires Rosetta 2 — rejected  |
| unsupported arch | —                 | —                           | clear error and exit                      |

### Findings

- **Electron builds:** x86_64, arm64, and universal are all possible. A universal
  app is an x64 app and an arm64 app glued together (`lipo`) via
  `@electron/universal`; it is roughly twice the size.
- **`imapsync` runtime:** the Perl script is architecture-independent, but a
  bundled Perl interpreter and any native modules must match the host
  architecture. The SSL stack (`IO::Socket::SSL` / `Net::SSLeay` wrapping
  OpenSSL) contains native components, so per-architecture runtimes are required.
- **Rosetta 2:** the x86_64-only standalone `imapsync` binary can run on Apple
  Silicon only through Rosetta 2, which is not guaranteed to be present (it is
  installed on demand) and is being deprecated by Apple (available through macOS
  27, then only for legacy games from macOS 28). The application does not depend
  on it.
- **Runtime selection:** a universal app can carry per-architecture runtimes and
  select one at startup via `process.arch`, but this adds complexity with no v1
  requirement for a single artifact.

### v1 recommendation

Ship separate x86_64 and arm64 application builds, each bundling a matching
runtime, with no Rosetta 2 dependency. This is deferred implementation work
(see TASK-008 and TASK-009).

## Connection testing

`testConnection` runs in the main process (`apps/desktop/src/main/imap/`) and
performs a real IMAP connect, TLS negotiation where applicable, and `LOGIN`.

- `types.ts` — the `Connection` / `SocketLayer` boundary.
- `socketLayer.ts` — the real `net`/`tls` implementation.
- `client.ts` — the protocol flow and a configurable timeout
  (`DEFAULT_CONNECTION_TIMEOUT_MS` = 10s).
- `errors.ts` — maps low-level errors to stable application-level codes and
  messages.

### Security-mode behavior

| Mode      | Behavior                                      |
| --------- | --------------------------------------------- |
| `tls`     | implicit TLS from the first byte              |
| `starttls`| plaintext connect, then upgrade via STARTTLS  |
| `none`    | plaintext only, no TLS (credentials in clear) |

The IPC handler validates the endpoint first and returns `invalid-input` before
any network access; the client returns a typed `ConnectionTestResult` with a
stable failure code (`dns`, `connection`, `timeout`, `tls`, `authentication`,
`protocol`, `internal`).

## Renderer

The renderer is a single-screen React app (`apps/desktop/src/renderer/src/`):

- `App.tsx` — orchestrates source/destination state, connection-test staleness,
  migration readiness, and the active-migration state machine using local React
  state.
- `EndpointForm.tsx` — one endpoint section (host, port, security mode,
  username, password) with client-side validation and a connection-test action.
- `MigrationView.tsx` — the active migration view: status, source/destination
  identities, a cancel action, and the streamed output panel.
- `endpoint.ts` — form values, validation helpers, security-mode port defaults,
  and the failure-code → user-facing message map.
- `output.ts` — the bounded output buffer.

The renderer talks only to `window.api` (the preload surface). A successful
connection test for an endpoint becomes stale when any of its values change,
which revokes migration readiness. Migration start is only enabled once both
endpoints are valid and have a current successful test.

### Active migration lifecycle

On a successful start the renderer replaces the form with the active migration
view. Migration state is
`idle → starting → running → (cancelling) → succeeded | failed | cancelled`,
where the terminal transition is driven by the narrow `migration:lifecycle`
event emitted from the main process — never by parsing output text. Output
arrives through the `migration:output` channel and is appended incrementally.
The output and lifecycle subscriptions are registered once per active migration
and removed when the migration terminates or the view unmounts.

### Migration result contract

The `migration:lifecycle` event is a discriminated union:

- `{ phase: 'succeeded' }`
- `{ phase: 'failed'; message: string }`
- `{ phase: 'cancelled' }`

The `failed` variant carries a concise, safe message from the runtime adapter
(e.g. `Migration exited with code 1.`). The main process maps the adapter's
typed result to this event (`src/main/imapsync/lifecycle.ts`); no raw `Error`
object crosses IPC.

### Result UX

Terminal outcomes are shown distinctly (success / failure / cancelled) with the
source and destination identities, the preserved (still bounded) output, and a
`Start another migration` action. Returning to the form clears the terminal
state, output, and cancel state, invalidates the previous connection tests, and
requires fresh successful connection tests before the next migration while
keeping the endpoint field values in memory.

### Output buffer

The renderer keeps at most `MAX_OUTPUT_CHARS` (100,000) characters of sanitized
output, discarding the oldest content first (`appendOutput` in `output.ts`).
Output is never persisted. The log panel preserves whitespace, wraps long lines,
and auto-scrolls to the newest content unless the user has scrolled up.
