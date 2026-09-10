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

## 2026-09-03 — TASK-009D

Status: Complete

Implemented:

- corrected STARTTLS connection-test sequence (no second greeting; post-TLS
  CAPABILITY before LOGIN)
- eliminated the migration lifecycle subscription race (listeners registered
  before startMigration)
- explicit imapsync log/temp policy (--nolog, --tmpdir, controlled cwd)

Verification:

- pnpm verify: PASS (183 tests)

## 2026-09-03 — TASK-010

Status: Blocked (manual clean-machine E2E requires clean hardware + test mailboxes)

Implemented:

- produced and recorded the actual distribution artifacts (x86_64 rebuilt, arm64
  from native CI) with SHA-256
- documented signing/notarization status and Gatekeeper expectation
- created `docs/e2e-macos.md` with the honest verification record and the
  remaining manual E2E steps

Verification:

- pnpm verify: PASS (183 tests)
- x86_64 packaged smoke test PASS (local); arm64 native CI PASS

Blocker: the real clean-machine workflow (download/extract, Gatekeeper, launch,
real IMAP connection tests, real mailbox migration, cancellation, repeat,
residue inspection) requires clean macOS hardware, controlled test mailboxes,
and an interactive session, none available in the agent environment.

Published: a downloadable GitHub pre-release `v0.1.0-e2e.1` with both artifacts
and a `SHA256SUMS.txt`; both artifacts were re-downloaded from the release and
their checksums verified.

## 2026-09-08 — TASK-010B

Status: Complete (diagnosis + corrected DMG distribution; TASK-010 remains
incomplete)

Implemented:

- investigated the first real-mac distribution failure as an incident, not an
  assumption: re-downloaded `v0.1.0-e2e.1` ZIPs from GitHub and proved both
  structurally valid with native tooling (`unzip -t`, `zipinfo`, `ditto`);
- verified per-architecture identity (x64 app+runtime = x86_64, arm64
  app+runtime = arm64);
- identified the likely root cause with evidence: the arm64 `.app` was only
  linker-signed (no `_CodeSignature/CodeResources`, no sealed resources), which
  Gatekeeper on Apple Silicon rejects as "damaged" (`spctl`:
  "code has no resources but signature indicates they must be present");
- switched electron-builder to ad-hoc signing (`identity: '-'`,
  `hardenedRuntime: false`, ADR-015) and DMG distribution (DMG + ZIP, with an
  `/Applications` link), excluding the PAR::Packer runtime binary via
  `signIgnore`;
- extended native arm64 CI to build/verify/mount/inspect the DMG and smoke-test
  the app copied from it;
- produced, validated, and published a new immutable pre-release
  `v0.1.0-e2e.2` with architecture-specific DMGs + `SHA256SUMS.txt`;
- re-downloaded the public DMGs and independently verified checksums,
  `hdiutil verify`, and `hdiutil attach`.

Verification:

- pnpm verify: PASS (192 tests)
- x86_64 DMG: `hdiutil verify` PASS, mounts, app copy passes packaged smoke,
  launches, ad-hoc signature verifies
- arm64 DMG: native arm64 CI PASS (verify/mount/copy/smoke/launch)
- GitHub-downloaded DMGs: checksum PASS, `hdiutil verify` PASS

Decisions:

- ADR-015: ad-hoc signing of distributable bundles (no Developer ID)

Honest status:

- root cause of the Ventura failure strongly indicated but not provable (the
  machine architecture was never recorded);
- TASK-010 remains incomplete pending another physical clean-machine E2E run.

## 2026-09-10 — TASK-011

Status: Complete

Implemented:

- Windows x64 as a first-class platform (not a cross-compile shortcut): the
  runtime matrix is now `darwin-x64` / `darwin-arm64` / `win32-x64`, with the
  platform-specific executable name (`imapsync` vs `imapsync.exe`);
- self-contained Windows x64 runtime via the official upstream `imapsync.exe`
  from the free `imapsync_2.314.zip` (ADR-016), staged/verified by SHA-256;
- extended the runtime manifest/provenance model with `platform`,
  `artifactFilename`, and `artifactSha256` (validated, not merely printed);
- Windows packaging: a single NSIS installer (`electron-builder --win --x64`),
  per-user assisted install (no elevation), `imapSyncGUI-<version>-windows-x64-setup.exe`;
- runtime build/validate/self-test/smoke scripts extended for `win32-x64`,
  including a dependency-free PE-header (AMD64) check;
- native Windows CI (`.github/workflows/windows-x64.yml`): host assertion
  (`win32` + `x64`), `pnpm verify`, runtime build/validate (native .NET PE
  check)/self-test (host isolation), NSIS packaging, packaged smoke test,
  silent install + installed AMD64 verification + installed smoke + uninstall,
  metadata/SHA-256 recording, artifact upload;
- documentation: ADR-016/ADR-017, `docs/e2e-windows.md`, and updates to
  architecture/security/runtime/testing/third-party-licenses/product/README.

Verification:

- `pnpm verify`: PASS (221 tests) locally and on native Windows x64;
- macOS arm64 native CI: PASS (no regression);
- native Windows x64 CI: PASS — runtime `imapsync.exe` PE machine `0x8664`
  (AMD64), self-test + packaged smoke (`imapsync 2.314` starts) in host
  isolation, installer silently installs and uninstalls, installed app +
  runtime verified AMD64;
- installer: `imapSyncGUI-0.1.0-windows-x64-setup.exe`, SHA-256
  `770a7c72108f8b6fec27c9d9e947e6c293bae0b0d3b58d060b370fe798103fd8`.

Decisions:

- ADR-016: Windows runtime via the official self-contained `imapsync.exe`.
- ADR-017: Windows artifacts unsigned (SmartScreen documented honestly).

Published:

- GitHub pre-release `v0.1.0-e2e.3` (Windows-specific, so the previously proven
  macOS assets in `v0.1.0-e2e.2` are not silently replaced) with the installer
  and `SHA256SUMS.txt`; the public installer was re-downloaded and its SHA-256
  verified against the recorded value.

Honest status:

- The installer is **unsigned** (no Authenticode); SmartScreen is expected to
  warn — this is documented, not worked around.
- A physical clean-machine Windows E2E test has **not** been performed; native
  CI + packaged/installed verification is complete, and `docs/e2e-windows.md`
  records the remaining manual checklist. Windows is **not** described as
  clean-machine verified.
- TASK-010 remains incomplete (paused) pending manual physical macOS E2E.

## 2026-09-10 — TASK-012

Status: Complete

Implemented:

- migration UX and live log streaming hardening for the packaged app;
- incremental stdout/stderr streaming now decodes each pipe with a Node
  `StringDecoder`, so multi-byte UTF-8 characters split across OS reads are
  reassembled instead of being emitted as replacement characters (the full log
  is still forwarded chunk-by-chunk, never accumulated until exit);
- the renderer shows the migration view immediately, including the `starting`
  phase, with an animated running indicator and a `Waiting for imapsync output…`
  placeholder until the first chunk arrives; cancel is available during both
  `starting` and `running`;
- the default window is now 1080×720 with `minWidth`/`minHeight` bounds, and
  the form spacing is compacted so the initial form fits a 1366×768 desktop
  without page-level scrollbars; the migration output panel grows and scrolls
  internally;
- tests: launcher data-forwarding, adapter split multi-byte UTF-8 reassembly,
  a dedicated `MigrationView` suite, and an App test for cancelling during the
  `starting` phase.

Verification:

- `pnpm verify`: PASS (234 tests);
- packaged macOS x64 app rebuilt and re-tested end to end with a local IMAP
  fixture and the real bundled `imapsync`: output appears while the status is
  still `Migration running` (0 → 1899 → 11503 → 12314 chars) rather than only
  after exit; the running indicator and placeholder show before the first
  output; cancellation stops the process, preserves the partial log, and shows
  the `cancelled` result;
- initial packaged form measured with no page-level vertical scrollbar at the
  default window size.

Root cause note:

- The Node/launcher/IPC streaming path was already incremental; the reproduced
  UX gaps were the lack of any visible activity indication during imapsync's
  startup/quiet periods and the initial form overflow. The streaming path was
  additionally hardened for multi-byte chunk boundaries. A direct investigation
  (see `tasks/done/TASK-012.md`) found no output accumulation in the main
  process.

## 2026-09-10 — TASK-013

Status: Complete

Implemented:

- hardened electron-builder runtime selection so the bundled runtime is derived
  from the packaging target, never the build host;
- new `apps/desktop/electron-builder-runtime.cjs` helper detects the target
  platform/architecture from CLI flags, maps it to `win32-x64` /
  `darwin-x64` / `darwin-arm64`, and rejects implicit cross-host packaging
  (e.g. `--win` on macOS) with a clear error before packaging;
- `TARGET_PLATFORM`/`TARGET_ARCH` remain explicit overrides, and a CLI flag
  that conflicts with them is rejected;
- tests for the selection/rejection logic plus a config-level conflict test;
- updated `docs/architecture.md` and `docs/testing.md`.

Verification:

- `pnpm verify`: PASS (25 test files, 251 tests);
- `electron-builder --win --x64` on macOS now exits non-zero with a clear
  `refusing cross-host packaging` error;
- explicit `TARGET_PLATFORM=win32` resolves the `win32-x64` runtime;
- native Windows/macOS CI packaging commands are unchanged.

Note: no application runtime behaviour changed; no commit or push performed.
