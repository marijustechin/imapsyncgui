# TASK-014 — Fix macOS arm64 SSL runtime portability and align migration UX

> **Status: Complete.**
>
> Native Apple Silicon verification: GitHub Actions run
> https://github.com/marijustechin/imapsyncgui/actions/runs/34590251634 (PASS).
> Windows x64 native verification for the same commit: PASS
> (https://github.com/marijustechin/imapsyncgui/actions/runs/34590251753).

## Goal

Resolve the real-world macOS Apple Silicon migration failure where the packaged
arm64 runtime could not load `Net::SSLeay` because its XS bundle referenced the
build machine's Homebrew OpenSSL (`/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib`),
and bring the migration failure UX in line with the Windows behavior.

## Root cause

The arm64 runtime is self-built with Homebrew Perl and Homebrew OpenSSL 3
(ADR-013). cpanm built `Net::SSLeay`'s XS bundle (`SSLeay.bundle`) against the
Homebrew OpenSSL prefix, so the bundle referenced `/opt/homebrew/...` by absolute
path. PAR::Packer embedded the bundle but not the Homebrew dylibs. On a clean
Apple Silicon Mac (no Homebrew), `dlopen` of the extracted bundle failed:

```
Can't load .../Net/SSLeay/SSLeay.bundle for module Net::SSLeay
Library not loaded: /opt/homebrew/opt/openssl@3/lib/libssl.3.dylib
```

The top-level PAR executable links only `libSystem`, so the old
`otool -L imapsync` validation passed. The old self-test only ran
`imapsync --version` on a Homebrew-equipped CI runner, so it always resolved
the Homebrew dependency and never exercised a clean-machine environment.

## Why the successful and failing real mailbox cases differed

`imapsync` does `use IO::Socket::SSL` (which does `use Net::SSLeay`)
unconditionally at compile time. Verified with `DYLD_PRINT_LIBRARIES`: even
`imapsync --version` loads `SSLeay.bundle` and `libssl`/`libcrypto`. Therefore
the two cases did **not** differ by plaintext vs TLS vs STARTTLS; `Net::SSLeay`
is loaded on every run.

The difference was environmental/runtime resolution:

- the successful case resolved the SSL stack from a portable source (the
  x86_64 official runtime links macOS system `libssl`/`libcrypto`, or an arm64
  run on a host where the Homebrew OpenSSL path was present);
- the failing case used the self-built arm64 runtime on a host where
  `/opt/homebrew/opt/openssl@3` was absent, so the hard-coded dylib could not
  be resolved.

The exact artifact/host combination for the successful run was not recorded, so
that attribution is the best-supported explanation from the evidence; the
runtime portability defect is proven independently by the old artifact and the
new validation (below).

## Exact runtime fix

`scripts/build-runtime-arm64.mjs` now makes the bundled `Net::SSLeay` relocatable
before packing:

1. read every non-system dependency of `SSLeay.bundle` with `otool -L`,
   recursively (on the arm64 runner this is `libssl.3.dylib` + `libcrypto.3.dylib`);
2. copy them next to the build-time bundle (so `pp`'s dependency scanner, which
   executes the script, can still load the bundle) and into a PAR staging
   directory;
3. rewrite the bundle and dylibs with `install_name_tool` so every reference is
   `@loader_path/<dylib>` (ids and inter-dependencies included);
4. re-sign each modified Mach-O ad-hoc (required on arm64);
5. pack with `pp -x -u -a lib`, so the dylibs are stored at
   `lib/auto/Net/SSLeay/` next to the extracted bundle.

Result: a single self-contained PAR binary whose SSL stack resolves relative to
the extracted bundle, with no Homebrew/system Perl/OpenSSL dependency at run
time. OpenSSL resolution strategy recorded in ADR-018.

## Verification strengthening

- `runtime:validate` now extracts the PAR archive and inspects every embedded
  `.bundle`/`.dylib`: architecture must match, and every `otool -L` dependency
  must be a macOS system library or an `@loader_path`/`@executable_path`
  reference that resolves inside the archive. Any Homebrew/MacPorts/user/CI path
  fails. Verified locally that the old broken artifact fails with:
  `embedded native component lib/auto/Net/SSLeay/SSLeay.bundle references a
  developer-machine path: /opt/homebrew/opt/openssl@3/lib/libssl.3.dylib`.
- `runtime:self-test` (and the packaged smoke test) run `imapsync --version`
  under `sandbox-exec` with read access to `/opt/homebrew`, `/usr/local`, and
  `/opt/local` denied, proving the SSL stack resolves from the bundled
  `@loader_path` dylibs and does not fall back to a developer install. (An
  earlier `DYLD_PRINT_LIBRARIES` approach was replaced because it hangs with PAR
  on arm64.)
- `src/main/runtime/nativeDeps.test.ts` covers the classifier used by
  `runtime:validate` (system/`@loader_path` accepted; Homebrew/MacPorts/`/Users`/
  CI rejected) as the deterministic regression test.

## UI/UX changes

- `migration:lifecycle` failures now carry a typed `MigrationFailureCode`
  (`runtime-unavailable`, `runtime-dependency`, `spawn-failed`,
  `process-failed`, `internal`) and the process `exitCode`.
- The adapter classifies a non-zero exit as `runtime-dependency` only on a
  narrow, documented dyld/DynaLoader loader signature (`Can't load ... for
  module`, `Library not loaded:`, `Symbol not found:`); other failures are
  `process-failed`. Free-form imapsync output is not parsed to invent categories.
- The failure view shows a concise user-facing message as the primary alert and
  moves raw output (Perl/dyld stack traces, absolute paths) plus the exit code
  into a collapsed secondary `Technical details` section. Active migrations
  still show the live log inline; the running indicator, placeholder, cancel and
  start-another flows are unchanged.

## Tests added/updated

- `src/main/imapsync/adapter.test.ts` — runtime-dependency classification vs
  `process-failed`, with code/exitCode.
- `src/main/imapsync/lifecycle.test.ts` — code/exitCode mapping.
- `src/main/runtime/nativeDeps.test.ts` — new classifier regression tests.
- `src/renderer/src/MigrationView.test.tsx` — concise primary failure message +
  collapsed `Technical details` (exit code, raw output); active runs show the
  log inline.
- `src/renderer/src/App.test.tsx` — updated failure lifecycle events.
- `scripts/lib/native-deps.mjs` (+ `.d.mts`) — shared classifier.

## Verification

- `pnpm verify`: PASS (26 test files, 260 tests).
- Native arm64 (GitHub Actions `macos-15`, run 34590251634): PASS —
  `runtime:build:arm64`, `runtime:validate` (31 embedded native components, no
  developer paths), `runtime:self-test` (SSL loads with Homebrew/MacPorts
  denied), `package:mac:arm64`, packaged smoke from `.app` and from the DMG,
  DMG verification, best-effort launch.
  - `imapSyncGUI-0.1.0-mac-arm64.dmg` SHA-256
    `388d6c3deafef6f705bfd9097567270f99bba989f2591a5da7c2a1fb060e7117`
  - `imapSyncGUI-0.1.0-mac-arm64.zip` SHA-256
    `1b9465f5fe741a4d88059e70b758253579aeacde39d35bf972394ffeb09fcb42`
- Native Windows x64 (run 34590251753): PASS (no regression).
- x86_64 macOS regression: local `runtime:validate`, `runtime:self-test`, and
  `package:smoke` all PASS with the strengthened checks; the official x86_64
  binary (system OpenSSL) is unchanged.

## Signing / notarization

Unchanged: ad-hoc signed, not Developer ID signed, not notarized (ADR-015).

## Remaining limitations

- The exact real-world host/artifact history for the successful textradeuk run
  could not be reconstructed; the runtime defect and its fix are proven by the
  reproduced broken artifact and native CI.
- The arm64 build still uses build-time Homebrew (as a toolchain only); the
  produced runtime no longer depends on it.
- A physical clean-machine macOS E2E migration with real mailboxes is still
  outstanding (TASK-010).
