# Testing

## Test runner

Tests use [Vitest](https://vitest.dev/) with the `jsdom` environment for
renderer component tests.

## Commands

- `pnpm test` — run the test suite once.
- `pnpm verify` — run lint, typecheck, tests, and the production build.

Native runtime verification is separate and **not** part of `pnpm verify`
(it may depend on platform build tooling):

- `pnpm runtime:build` — stage the pinned self-contained binary + manifest.
- `pnpm runtime:build:arm64` — build the arm64 standalone binary on Apple
  Silicon (PAR::Packer; refuses to run on non-arm64 hosts).
- `pnpm runtime:build:win` — stage the pinned self-contained Windows x64
  `imapsync.exe` + manifest.
- `pnpm runtime:validate` — validate a staged runtime (platform/arch, manifest,
  `file` + `otool -L` on macOS, PE machine field on Windows). On macOS it also
  extracts the PAR archive and inspects every embedded native component for
  architecture and developer-machine paths (Homebrew/MacPorts/user/CI), and
  verifies that `@loader_path` references resolve inside the archive.
- `pnpm runtime:self-test` — offline self-test of the bundled binary in a
  host-isolation environment (restricted `PATH`, cleared Perl variables). On
  macOS it additionally loads the SSL stack with `DYLD_PRINT_LIBRARIES=1` and
  fails if `Net::SSLeay`/`libssl`/`libcrypto` resolves from a developer path.
- `pnpm package:mac:x64` / `pnpm package:mac:arm64` — build the distributable
  `.app` + `.dmg` + `.zip` for one architecture (ad-hoc signed, ADR-015).
- `pnpm package:win:x64` — build the Windows x64 NSIS installer (unsigned,
  ADR-017).
- `pnpm package:smoke` — packaged-runtime smoke test against the built package;
  accepts `--app <path>` (macOS `.app`), `--resources <dir>` (Windows/installed
  resources), and `--runtime-arch <arch>`.

The runtime scripts accept `--runtime-arch darwin-x64|darwin-arm64|win32-x64`
(or `--platform`/`--arch`).

See `docs/runtime.md`.

### Native arm64 CI

`.github/workflows/macos-arm64.yml` (manual `workflow_dispatch` and on push to
`main`) runs the full native arm64 sequence on a GitHub-hosted `macos-15`
(arm64) runner: verify the host is arm64, `pnpm verify`, `runtime:build:arm64`,
`runtime:validate` (including embedded PAR native-component inspection),
`runtime:self-test` (including the offline SSL-stack load check),
`package:mac:arm64`, architecture inspection, packaged smoke test, and a
best-effort application launch. See ADR-014 and ADR-018.

### Native Windows x64 CI

`.github/workflows/windows-x64.yml` (manual `workflow_dispatch` and on push to
`main`) runs the full native Windows x64 sequence on a GitHub-hosted
`windows-latest` (x64) runner: verify `process.platform === 'win32'` and
`process.arch === 'x64'`, `pnpm verify`, `runtime:build:win`,
`runtime:validate` (win32-x64), a native .NET PE-machine assertion
(AMD64/x86-64), `runtime:self-test` (host isolation), `package:win:x64`,
packaged smoke test, installer PE verification, silent install into a disposable
location + installed-file/runtime verification + installed smoke test +
uninstall, metadata/SHA-256 recording, and artifact upload. See ADR-016 and
ADR-017.

## Coverage (packaging)

- `src/main/packaging.test.ts` verifies bundle identity, that only `x64`/`arm64`
  are supported for macOS (no universal build), deterministic artifact naming,
  DMG+ZIP targets, the ad-hoc signing identity, and the Windows NSIS-only target
  (`x64` only) with the `imapSyncGUI-<version>-windows-x64-setup.exe` installer
  name.
- `src/main/electron-builder-config.test.ts` reads the actual
  `electron-builder.config.cjs` and asserts the DMG/ZIP targets, ad-hoc signing
  (`identity: '-'`, `hardenedRuntime: false`), architecture-bearing artifact
  names, the conventional DMG layout with an `/Applications` link, the
  per-architecture `extraResources` mapping, and the Windows NSIS/`nsis`
  configuration (per-user assisted installer, `win32-x64` runtime). It also
  asserts that a CLI target conflicting with an explicit `TARGET_PLATFORM` is
  rejected.
- `src/main/electron-builder-runtime.test.ts` covers the packaging
  runtime-selection logic (`electron-builder-runtime.cjs`): CLI platform/arch
  flag detection, the platform/arch → runtime-directory mapping, native
  Windows/macOS selection (`win32-x64`, `darwin-x64`, `darwin-arm64`), rejection
  of unsupported combinations (e.g. `win32/arm64`, `linux/x64`), fail-fast
  rejection of implicit cross-host packaging (`--win` on macOS), explicit
  `TARGET_PLATFORM` overrides, and CLI-vs-`TARGET_PLATFORM`/`TARGET_ARCH`
  conflicts.

## Conventions

- Test files are co-located with the code they exercise and use the
  `*.test.ts` / `*.test.tsx` suffix.
- Renderer component tests use `@testing-library/react`.
- Security-sensitive configuration (e.g. web preferences) is extracted into
  testable modules so that the process-boundary guarantees are asserted.

## Coverage

- `src/main/validation.test.ts` covers endpoint validation: valid input,
  invalid ports, empty host/username/password, invalid security mode, and that
  validation messages never contain credential values.
- `src/preload/api.test.ts` verifies the preload exposes only the required
  operations and that generic IPC or Node.js access is impossible.
- `src/main/security.test.ts` asserts the renderer sandbox configuration.
- `src/main/imapsync/arguments.test.ts` covers deterministic argument
  generation and that malicious values cannot become flags.
- `src/main/imapsync/sanitize.test.ts` covers credential redaction.
- `src/main/imapsync/launcher.test.ts` verifies `spawn` is called with an
  argument array and no shell, and that stdout/stderr `data` events are
  forwarded incrementally to the registered listeners.
- `src/main/imapsync/adapter.test.ts` covers the process lifecycle (success,
  non-zero exit, startup failure), incremental stdout/stderr streaming,
  reassembly of multi-byte UTF-8 characters split across chunks, cancellation,
  repeated cancellation, rejection of concurrent migrations, classification of a
  bundled-runtime dependency loader failure (`runtime-dependency`) versus a
  generic `process-failed` exit, and
  that credentials travel via environment rather than arguments and are
  redacted from output.
- `src/main/imapsync/streaming.test.ts` spawns a real child process (a small
  Node script) through the real launcher and adapter and asserts that the first
  chunk of output is delivered while the process is still running, proving the
  spawn/pipe path is incremental rather than buffered until exit.
- `src/main/imapsync/lifecycle.test.ts` covers the runtime-result → lifecycle
  event mapping (including the failure code and exit code) and that no `Error`
  object crosses the boundary.
- `src/main/runtime/nativeDeps.test.ts` covers the packaging/runtime native
  dependency classifier used by `runtime:validate`: macOS system libraries and
  `@loader_path` references are accepted, while Homebrew (`/opt/homebrew`,
  `/usr/local/Cellar`), MacPorts, `/Users`, and CI runner paths are rejected.
  This is the regression test for the arm64 OpenSSL portability defect.
- `src/main/runtime/arch.test.ts`, `errors.test.ts`, `manifest.test.ts`,
  `resolve.test.ts`, `validate.test.ts`, and `env.test.ts` cover the platform →
  architecture mapping (`darwin-x64` / `darwin-arm64` / `win32-x64`), the
  platform-specific executable name (`imapsync` vs `imapsync.exe`), resolution
  (packaged vs development, no PATH fallback in packaged mode, Windows packaged
  resolution), manifest parsing/validation (platform/architecture consistency,
  artifact filename + SHA-256), filesystem-injectable runtime validation with
  typed failures (including the `imapsync.exe` name on Windows), and
  deterministic sanitized environment construction (developer Perl variables
  removed, credentials present, no logging, Windows system variables preserved).
- `src/main/imap/errors.test.ts` covers low-level error classification and that
  application-level messages never contain credentials.
- `src/main/imap/client.test.ts` covers the connection-test protocol flow
  (implicit TLS, plaintext, STARTTLS), timeout, DNS/connection/TLS/authentication
  failure mapping, cleanup, and credential-free results using an injected fake
  socket layer. STARTTLS coverage asserts the standards-compliant sequence:
  greeting → STARTTLS → TLS upgrade (no second greeting) → CAPABILITY → LOGIN,
  plus rejection, malformed response, upgrade failure, and timeout during
  STARTTLS.
- `src/main/imapsync/arguments.test.ts` additionally asserts the explicit
  `--nolog` policy and that log/temp flags are never derived from renderer
  input; `src/main/imapsync/adapter.test.ts` asserts a controlled `cwd` and
  `--tmpdir`.
- `src/renderer/src/App.test.tsx` covers a lifecycle subscription race
  regression: an immediately-terminating migration is still captured, listeners
  are cleaned up on immediate start failure, and no listeners leak across
  repeated migrations.
- `src/main/handlers.test.ts` verifies invalid input is rejected before any
  network access.
- `src/renderer/src/endpoint.test.ts` covers renderer validation, security-mode
  port defaults, endpoint conversion, and failure-message mapping.
- `src/renderer/src/App.test.tsx` covers the migration form against a mocked
  `window.api`: section rendering, defaults, security→port behavior, field
  validation, connection-test calls and results, per-endpoint test buttons,
  test staleness, migration readiness gating, and that credentials are never
  rendered in output.
- `src/renderer/src/output.test.ts` covers the bounded output buffer and
  oldest-first discarding.
- `src/renderer/src/App.test.tsx` also covers the active migration view:
  incremental output appending and ordering, single output/lifecycle
  subscription, terminal transition driven by the lifecycle event (not output
  text), subscription cleanup, cancellation and duplicate-cancel prevention,
  cancellation-failure handling, cancelling during the `starting` phase, and
  form replacement while active. It further
  covers the distinct success/failure/cancelled result UX, safe identities,
  raw-error/credential exclusion, and the return-to-form flow that clears state
  and requires fresh connection tests.
- `src/renderer/src/MigrationView.test.tsx` covers the migration view directly:
  the live running indicator and `Waiting for imapsync output…` placeholder,
  the starting/running/cancelling states, the preserved log once output
  arrives, distinct success/failure/cancelled results, the concise primary
  failure message with raw diagnostics (and exit code) confined to a collapsed
  `Technical details` section while active runs show the log inline, the failure
  and cancel error alerts, and the start-another action.

Runtime, connection, and renderer tests use injected fakes or a mocked preload
API and never require a real `imapsync` install or live IMAP servers.
