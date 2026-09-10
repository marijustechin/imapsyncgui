# imapsync runtime

This document describes the bundled `imapsync` runtime strategy, layout, build
process, validation, self-test, provenance, and licensing. It complements
ADR-008 (architecture strategy), ADR-010 (runtime packaging), ADR-012
(self-contained binary runtime), ADR-016 (Windows x64 runtime), and ADR-017
(Windows signing status).

## Summary

For x86_64 macOS the self-contained runtime is the official upstream
`imapsync_bin_Darwin_x86_64` binary (ADR-012). For Windows x64 the
self-contained runtime is the official upstream `imapsync.exe` from the free
`imapsync_2.314.zip` archive (ADR-016). For macOS arm64 there is no official
binary, so a self-contained binary is built via PAR::Packer (ADR-013). Each is
a PAR::Packer-packaged executable that embeds Perl, the required CPAN modules,
and the SSL/OpenSSL stack. The packaged application invokes the matching binary
directly (no separate Perl), so it does not depend on the host's `PATH`,
Homebrew, MacPorts, Strawberry Perl, or system Perl.

## Runtime layout

```
runtime/
  darwin-x64/
    manifest.json
    bin/
      imapsync      (self-contained executable: Perl + modules + OpenSSL)
    licenses/
      imapsync-LICENSE.txt
      perl-ARTISTIC.txt
      perl-GPL-1.0.txt
      openssl-LICENSE.txt
  darwin-arm64/
    ...            (self-built via PAR::Packer, ADR-013)
  win32-x64/
    manifest.json
    bin/
      imapsync.exe (official self-contained Windows x64 executable, ADR-016)
    licenses/
      imapsync-LICENSE.txt
      perl-ARTISTIC.txt
      perl-GPL-1.0.txt
      openssl-LICENSE.txt
```

Runtime files are kept outside the application ASAR archive and are located via
`process.resourcesPath/runtime/<arch>` in a packaged build.

## Architecture mapping

| `process.platform` | `process.arch` | runtime directory |
| ------------------ | -------------- | ----------------- |
| `darwin`           | `x64`          | `darwin-x64`      |
| `darwin`           | `arm64`        | `darwin-arm64`    |
| `win32`            | `x64`          | `win32-x64`       |

Any other platform/architecture is rejected explicitly with a typed
`architecture-mismatch` failure. No Rosetta 2 dependency is introduced.

## Resolution

`src/main/runtime/resolve.ts` implements deterministic resolution:

- **Packaged** (`app.isPackaged`): resolve only
  `<resources>/runtime/<arch>/bin/<executable>` with no prefix arguments, where
  the executable is `imapsync` on macOS and `imapsync.exe` on Windows. The
  `IMAPSYNC_EXECUTABLE` override and `PATH` are ignored.
- **Development** (`!app.isPackaged`): honor `IMAPSYNC_EXECUTABLE`, otherwise
  resolve `imapsync` from `PATH`.

`src/main/runtime/validate.ts` validates a packaged runtime before use:
directory exists, manifest parses and matches the platform + architecture, and
the bundled executable exists with the expected name.

## Runtime environment

`src/main/runtime/env.ts` constructs the child-process environment
deterministically: it copies the inherited baseline, removes developer Perl
configuration (`PERL5LIB`, `PERL_LOCAL_LIB_ROOT`, `PERL_MB_OPT`, `PERL_MM_OPT`,
`PERL5OPT`), and adds the ADR-007 credential variables
(`IMAPSYNC_PASSWORD1` / `IMAPSYNC_PASSWORD2`). Passwords never enter `argv`.

Migration invocation sets a controlled process `cwd` (the OS temporary
directory) and passes `--nolog` and `--tmpdir <cwd>`, so persistent
`LOG_imapsync/` and `W/` files are not written into the application or working
directory.

## Manifest

`manifest.json` records the runtime format version, architecture, `imapsync`
version, embedded Perl/OpenSSL versions, build timestamp, and the bundled
components. It is parsed and validated by `src/main/runtime/manifest.ts`.

## Build, validate, self-test

Repository commands (in `apps/desktop`):

- `pnpm runtime:build` — downloads the pinned Darwin x86_64 binary (URL +
  SHA-256) and stages it with the manifest and license texts.
- `pnpm runtime:build:arm64` — builds the arm64 PAR::Packer binary on Apple
  Silicon (ADR-013).
- `pnpm runtime:build:win` — downloads the pinned Windows zip and stages the
  official `imapsync.exe` with the manifest and license texts (ADR-016).
- `pnpm runtime:validate` — checks platform/architecture, manifest (including
  artifact filename and SHA-256), the binary's `file` output + `otool -L`
  (macOS), and the PE machine field (Windows).
- `pnpm runtime:self-test` — runs the staged binary offline in a host-isolation
  environment (restricted `PATH`, developer Perl variables cleared).

These accept `--runtime-arch <darwin-x64|darwin-arm64|win32-x64>` (or
`--platform`/`--arch`). They are native/runtime verification commands and are
intentionally **not** part of `pnpm verify`, which remains deterministic and
independent of any real runtime or network.

## Packaged application

electron-builder copies the matching `runtime/<arch>` into the packaged
resources directory (`Contents/Resources/runtime/<arch>` on macOS,
`resources/runtime/<arch>` on Windows) and produces per-architecture artifacts:
macOS `.dmg`/`.zip` (`imapSyncGUI-<version>-mac-<arch>.dmg` / `.zip`) and a
Windows NSIS installer (`imapSyncGUI-<version>-windows-x64-setup.exe`). The
macOS `.app` bundle is ad-hoc signed (ADR-015); the Windows installer is
unsigned (ADR-017). The bundled runtime binary is excluded from the macOS
signature seal via `signIgnore`. A packaged build resolves and launches only
that bundled runtime. The packaged-runtime smoke test (`pnpm package:smoke`)
exercises the same resolution path offline, from inside the packaged resources,
in a host-isolation environment.

## Status and known limitations

- **`darwin-x64`:** self-contained official `imapsync` binary, staged, validated,
  self-tested, packaged, and smoke-tested successfully.
- **`darwin-arm64`:** built and verified natively via the GitHub Actions
  `macos-15` arm64 runner (ADR-014). The self-built PAR::Packer binary is arm64,
  links only system `libSystem`, passes host-isolation self-test, and the
  packaged smoke test passes from inside the arm64 `.app`. No official arm64
  standalone binary exists, so the runtime is self-built from the upstream
  `imapsync` script (ADR-013).
- **`win32-x64`:** official self-contained `imapsync.exe` from the upstream
  Windows zip (ADR-016), staged, validated (PE AMD64), self-tested, packaged,
  and smoke-tested natively on a Windows x64 runner (TASK-011). The installer is
  unsigned (ADR-017).
- The 3 failing `imapsync --tests` cases are IPv6 DNS lookups (`test1ipv6.*`),
  which require network; all offline module/SSL checks pass.

## Provenance

- **`darwin-x64`:** `imapsync` 2.314 self-contained binary — upstream
  `https://imapsync.lamiral.info/dist/imapsync_bin_Darwin_x86_64`, SHA-256
  `cf15ed54a50bdbc9a1f4e118916a95e7bb36deb2c1b6f643d16b84223cc49b88`, NLPL.
  Perl (embedded, ~5.34), OpenSSL (embedded), CPAN modules (embedded).
- **`darwin-arm64`:** self-built PAR::Packer binary from the upstream `imapsync`
  script (`https://imapsync.lamiral.info/imapsync`). The exact `imapsync`
  version (currently 2.324) and script SHA-256 are recorded dynamically in the
  manifest. Build-time Perl is the current Homebrew `perl` (5.42); OpenSSL 3 and
  the CPAN module set are embedded.
- **`win32-x64`:** `imapsync` 2.314 self-contained `imapsync.exe` — upstream
  `https://imapsync.lamiral.info/dist/imapsync_2.314.zip` (zip SHA-256
  `61972bf94532bf186dd6d6ee54a4c70bb7ab3bdb79f324321cd742fd50953a0c`, exe
  SHA-256
  `329c0bfecab410a2bf5e57cc3319aa00b8e494fd792fe3a5476db9efdb1d2aab`), NLPL.
  Perl (embedded via PAR::Packer), OpenSSL (embedded), CPAN modules (embedded).

The x64/Windows binaries are pinned by URL + SHA-256; the arm64 recipe records
the exact `imapsync` version + script SHA-256. License texts are staged into
the runtime and shipped with the application.
