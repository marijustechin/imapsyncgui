# TASK-013 — Harden Windows packaging against wrong bundled runtime

> **Status: Complete.**

## Goal

Running the Windows packaging command from macOS could produce a Windows
installer while silently defaulting the bundled runtime to `darwin-x64`. This
must fail fast (or resolve `win32-x64` explicitly) instead of producing a
potentially invalid artifact.

## Investigation

- `apps/desktop/electron-builder.config.cjs` previously derived the target from
  `process.env.TARGET_PLATFORM || process.platform`. The electron-builder CLI
  target (`--win`/`--mac`) was not consulted, so `--win` on macOS defaulted to
  the host platform (`darwin`) and bundled `runtime/darwin-x64`.
- The native Windows CI and the macOS scripts already pass the matching
  platform/architecture flags, so only implicit cross-host packaging was unsafe.

## Implemented changes

- New pure, testable helper module
  `apps/desktop/electron-builder-runtime.cjs`:
  - detects the target platform/architecture from electron-builder CLI flags
    (`--win`/`--mac`/`--linux`, `--x64`/`--arm64`/`--ia32`);
  - maps the target to the bundled runtime directory
    (`win32-x64`, `darwin-x64`, `darwin-arm64`);
  - **rejects implicit cross-host packaging** (e.g. `--win` on macOS) with a
    clear error before any packaging work;
  - keeps `TARGET_PLATFORM`/`TARGET_ARCH` as explicit overrides and rejects a
    CLI flag that conflicts with them.
- `electron-builder.config.cjs` now calls the helper and throws on any
  unresolved/rejected target, so the bundled runtime is always derived from the
  packaging target, never the host.
- `eslint.config.mjs` ignores the new build-time `.cjs` file (matching the
  existing `electron-builder.config.cjs` ignore).
- Tests: `src/main/electron-builder-runtime.test.ts` (platform/arch flag
  detection, runtime mapping, native selection, unsupported combinations,
  implicit cross-host rejection, explicit overrides, conflicts) and an added
  `electron-builder-config.test.ts` case asserting a CLI-vs-`TARGET_PLATFORM`
  conflict is rejected.
- Docs: `docs/architecture.md` (Distribution packaging) and `docs/testing.md`
  updated.

## Verification

- `pnpm verify`: PASS (25 test files, 251 tests).
- `electron-builder --win --x64` on macOS now exits non-zero with:
  `refusing cross-host packaging: requested target "win32" on host "darwin"
  would otherwise bundle the host runtime (darwin-x64) instead of win32-x64...`
- Explicit `TARGET_PLATFORM=win32 TARGET_ARCH=x64` resolves
  `extraResources` to `runtime/win32-x64`.
- Native paths unchanged: `--win` on Windows and `--mac` on macOS resolve
  `win32-x64` / `darwin-x64` / `darwin-arm64` respectively; the native Windows
  and macOS CI commands are not modified.

## Notes

- No application runtime behaviour changed.
- No commit or push performed.
