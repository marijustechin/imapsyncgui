# Progress

## 2026-09-02 — TASK-001

Status: Complete

Implemented:

- Electron + React + TypeScript + Vite scaffold
- secure main/preload/renderer boundary
- pnpm workspace
- lint, typecheck, tests, build verification

Verification:

- pnpm verify: PASS
- tests: 6 passing

Notes:

- pnpm pinned to 11.24.0
- Electron sandbox enabled

## 2026-09-02 — TASK-002

Status: Complete

Implemented:

- shared migration contracts
- typed preload API
- runtime validation
- IPC handlers
- security boundary tests

Verification:

- pnpm verify: PASS
- tests: 25 passing

Decisions:

- shared module kept inside desktop app
- handwritten validation used instead of schema dependency

## 2026-09-02 — TASK-003

Status: Complete

Implemented:

- imapsync runtime adapter (lifecycle, streaming, cancellation, concurrency guard)
- safe spawn-based process execution (no shell)
- argument allowlist generation
- credential redaction from output
- start/cancel wired to the IPC contract; output streaming event added
- runtime tests with an injected process launcher

Verification:

- pnpm verify: PASS
- tests: 53 passing

Decisions:

- executable resolved from IMAPSYNC_EXECUTABLE or PATH; bundling deferred (ADR-006)
- passwords passed via IMAPSYNC_PASSWORD1/2 env vars instead of argv (ADR-007)

## 2026-09-02 — TASK-003A

Status: Complete

Implemented:

- macOS architecture research (Electron x64/arm64/universal, Rosetta 2, Perl runtime)
- architecture matrix for app/runtime/host combinations
- v1 distribution recommendation: separate x86_64 and arm64 builds, no Rosetta

Verification:

- pnpm verify: PASS

Decisions:

- ADR-008: separate x86_64/arm64 builds, no Rosetta 2 dependency

## 2026-09-02 — TASK-004

Status: Complete

Implemented:

- real IMAP connection test (connect + TLS/STARTTLS + LOGIN) via built-in net/tls
- stable application-level failure codes and error mapping
- finite timeout with cleanup on every completion path
- IPC handler wired to the real implementation; narrow boundary preserved

Verification:

- pnpm verify: PASS
- tests: 75 passing

Decisions:

- ADR-009: minimal built-in IMAP client instead of a library or imapsync

## 2026-09-02 — TASK-005

Status: Complete

Implemented:

- migration form UI (source + destination endpoint sections)
- client-side validation, security-mode port defaults
- per-endpoint connection tests with typed failure messaging
- stale-test invalidation and migration-readiness gating
- start-migration action with duplicate-start prevention
- renderer tests against a mocked preload API

Verification:

- pnpm verify: PASS
- tests: 110 passing

## 2026-09-02 — TASK-006

Status: Complete

Implemented:

- active migration view with incremental sanitized output and cancel action
- bounded output buffer (100k chars, oldest discarded)
- typed migration lifecycle event wired from the runtime adapter
- output/lifecycle subscription with cleanup
- cancellation UX with duplicate-cancel prevention and failure handling

Verification:

- pnpm verify: PASS
- tests: 126 passing

## 2026-09-02 — TASK-007

Status: Complete

Implemented:

- distinct success/failure/cancelled result UX driven by lifecycle events
- lifecycle event extended to a discriminated union with a failure message
- runtime-result → lifecycle event mapping (no Error objects over IPC)
- return-to-form flow with state/output clearing and fresh-test requirement

Verification:

- pnpm verify: PASS
- tests: 138 passing

## 2026-09-02 — TASK-008

Status: Complete

Implemented:

- per-architecture runtime resolution (darwin-x64 / darwin-arm64, no Rosetta)
- packaged vs development resolution split (no PATH/override fallback in packaged)
- runtime manifest schema, parsing, and validation
- filesystem-injectable runtime validation with typed failures
- adapter prefix-args support for a bundled `perl imapsync` invocation
- build / validate / self-test runtime scripts
- runtime + third-party licensing documentation

Verification:

- pnpm verify: PASS
- tests: 162 passing
- staged darwin-x64 runtime (imapsync script + manifest)
- runtime self-test passed using host Perl (development-only demonstration)

Limitations (documented):

- portable Perl + native module tree not yet bundled (TASK-009 blocker)
- darwin-arm64 tooling implemented but not built/verified (needs arm64/CI)

Decisions:

- ADR-010: bundled per-arch runtime with packaged/dev resolution split

## 2026-09-02 — TASK-009

Status: Complete (packaging pipeline implemented; portable runtime blocker
documented honestly)

Implemented:

- electron-builder packaging (ADR-011) with per-arch x64/arm64 config
- application identity (bundle id, product name, version) and artifact naming
- external runtime resources (outside ASAR) + packaged smoke test
- built and inspected the x86_64 `.app` + `.zip`; the app launches
- packaging unit tests (arch, naming, no-universal, identity)

Verification:

- pnpm verify: PASS
- tests: 166 passing
- x86_64 `.app` built and launched; runtime manifest/arch validated
- packaged smoke test correctly reports the missing portable Perl

Honest status:

- build host x86_64; x64 artifact produced and launched; arm64 not built/verified
- portable Perl + native module tree NOT bundled → artifacts not yet distributable
- artifacts unsigned and not notarized

Decisions:

- ADR-011: electron-builder for macOS packaging

## 2026-09-02 — TASK-009A

Status: Complete

Implemented:

- self-contained x86_64 runtime via the official imapsync binary (ADR-012)
- deterministic environment construction with developer-Perl-var sanitization
- binary-based resolution/validation (no separate Perl, no PATH/system fallback)
- runtime build/validate/self-test scripts (host-isolation)
- license texts staged and shipped with the runtime

Verification:

- pnpm verify: PASS
- tests: 170 passing
- x86_64 runtime staged, validated, self-tested (host isolation)
- packaged .app rebuilt; packaged smoke test passes from inside the .app
- full `imapsync --tests` from packaged app: 2186/2189 (3 IPv6 DNS failures)
- .app launches

Honest status:

- x86_64 self-contained runtime complete; arm64 still unbuilt/unverified
- artifacts unsigned and not notarized

Decisions:

- ADR-012: self-contained runtime via the official imapsync binary

## 2026-09-02 — TASK-009B

Status: Complete (native arm64 evidence)

Implemented:

- self-built arm64 standalone `imapsync` runtime via PAR::Packer (ADR-013)
- build recipe uses current Homebrew `perl` (not versioned formulae) and
  installs the full required CPAN module set into the build perl
- runtime build/validate/self-test/package/smoke verified natively

Verification (native `macos-15` arm64 runner, ADR-014):

- pnpm verify: PASS (171 tests)
- runtime binary: Mach-O arm64, links only system `libSystem`
- runtime validation OK; self-test OK (host isolation)
- packaged arm64 `.app` built; packaged smoke test OK from inside the `.app`
- `.app` launched (best effort); artifacts uploaded
- manifest records imapsync 2.324 + script SHA-256

## 2026-09-02 — TASK-009C

Status: Complete

Implemented:

- native arm64 CI workflow (.github/workflows/macos-arm64.yml) on GitHub-hosted
  macos-15 arm64 runner, with hard arm64 host verification and no Rosetta
- workflow calls the existing runtime:build:arm64 / validate / self-test /
  package:mac:arm64 / package:smoke scripts
- baseline pnpm verify, architecture inspection, and artifact upload
- documentation (ADR-014, README, runtime/testing docs)

Verification:

- pnpm verify: PASS (171 tests)
- native arm64 workflow executed and passing (validation + smoke test + launch)
