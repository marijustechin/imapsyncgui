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
- `pnpm runtime:validate` — validate a staged runtime (arch, manifest, `file`,
  `otool -L`).
- `pnpm runtime:self-test` — offline self-test of the bundled binary in a
  host-isolation environment (restricted `PATH`, cleared Perl variables).
- `pnpm package:mac:x64` / `pnpm package:mac:arm64` — build the distributable
  `.app` + `.zip` for one architecture.
- `pnpm package:smoke` — packaged-runtime smoke test against the built `.app`.

See `docs/runtime.md`.

### Native arm64 CI

`.github/workflows/macos-arm64.yml` (manual `workflow_dispatch`) runs the full
native arm64 sequence on a GitHub-hosted `macos-15` (arm64) runner: verify the
host is arm64, `pnpm verify`, `runtime:build:arm64`, `runtime:validate`,
`runtime:self-test`, `package:mac:arm64`, architecture inspection, packaged
smoke test, and a best-effort application launch. It is authored but not yet
executed; see ADR-014.

## Coverage (packaging)

- `src/main/packaging.test.ts` verifies bundle identity, that only `x64`/`arm64`
  are supported (no universal build), and deterministic artifact naming.

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
  argument array and no shell.
- `src/main/imapsync/adapter.test.ts` covers the process lifecycle (success,
  non-zero exit, startup failure), incremental stdout/stderr streaming,
  cancellation, repeated cancellation, rejection of concurrent migrations, and
  that credentials travel via environment rather than arguments and are
  redacted from output.
- `src/main/imapsync/lifecycle.test.ts` covers the runtime-result → lifecycle
  event mapping and that no `Error` object crosses the boundary.
- `src/main/runtime/arch.test.ts`, `errors.test.ts`, `manifest.test.ts`,
  `resolve.test.ts`, `validate.test.ts`, and `env.test.ts` cover architecture
  mapping, resolution (packaged vs development, no PATH fallback in packaged
  mode), manifest parsing/validation, filesystem-injectable runtime validation
  with typed failures, and deterministic sanitized environment construction
  (developer Perl variables removed, credentials present, no logging).
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
  cancellation-failure handling, and form replacement while active. It further
  covers the distinct success/failure/cancelled result UX, safe identities,
  raw-error/credential exclusion, and the return-to-form flow that clears state
  and requires fresh connection tests.

Runtime, connection, and renderer tests use injected fakes or a mocked preload
API and never require a real `imapsync` install or live IMAP servers.
