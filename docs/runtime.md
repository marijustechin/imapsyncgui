# imapsync runtime

This document describes the bundled `imapsync` runtime strategy, layout, build
process, validation, self-test, provenance, and licensing. It complements
ADR-008 (architecture strategy), ADR-010 (runtime packaging), and ADR-012
(self-contained binary runtime).

## Summary

For x86_64 the self-contained runtime is the official upstream
`imapsync_bin_Darwin_x86_64` binary: a PAR::Packer-packaged executable that
embeds Perl, the required CPAN modules, and the SSL/OpenSSL stack. The packaged
application invokes this binary directly (`bin/imapsync`, no separate Perl), so
it does not depend on the host's `PATH`, Homebrew, MacPorts, or system Perl.

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
    ...            (not built/verified — see status)
```

Runtime files are kept outside the application ASAR archive and are located via
`process.resourcesPath/runtime/<arch>` in a packaged build.

## Architecture mapping

| `process.arch` | runtime directory |
| -------------- | ----------------- |
| `x64`          | `darwin-x64`      |
| `arm64`        | `darwin-arm64`    |

Any other architecture is rejected explicitly with a typed
`architecture-mismatch` failure. No Rosetta 2 dependency is introduced.

## Resolution

`src/main/runtime/resolve.ts` implements deterministic resolution:

- **Packaged** (`app.isPackaged`): resolve only
  `<resources>/runtime/<arch>/bin/imapsync` with no prefix arguments. The
  `IMAPSYNC_EXECUTABLE` override and `PATH` are ignored.
- **Development** (`!app.isPackaged`): honor `IMAPSYNC_EXECUTABLE`, otherwise
  resolve `imapsync` from `PATH`.

`src/main/runtime/validate.ts` validates a packaged runtime before use:
directory exists, manifest parses and matches the architecture, and the bundled
binary exists.

## Runtime environment

`src/main/runtime/env.ts` constructs the child-process environment
deterministically: it copies the inherited baseline, removes developer Perl
configuration (`PERL5LIB`, `PERL_LOCAL_LIB_ROOT`, `PERL_MB_OPT`, `PERL_MM_OPT`,
`PERL5OPT`), and adds the ADR-007 credential variables
(`IMAPSYNC_PASSWORD1` / `IMAPSYNC_PASSWORD2`). Passwords never enter `argv`.

## Manifest

`manifest.json` records the runtime format version, architecture, `imapsync`
version, embedded Perl/OpenSSL versions, build timestamp, and the bundled
components. It is parsed and validated by `src/main/runtime/manifest.ts`.

## Build, validate, self-test

Repository commands (in `apps/desktop`):

- `pnpm runtime:build` — downloads the pinned binary (URL + SHA-256) and stages
  it with the manifest and license texts.
- `pnpm runtime:validate` — checks architecture, manifest, the binary's `file`
  output, and `otool -L` for developer-machine library paths.
- `pnpm runtime:self-test` — runs the staged binary offline in a host-isolation
  environment (restricted `PATH`, developer Perl variables cleared).

These are native/runtime verification commands and are intentionally **not**
part of `pnpm verify`, which remains deterministic and independent of any real
runtime or network.

## Packaged application

electron-builder copies the matching `runtime/<arch>` into
`Contents/Resources/runtime/<arch>` (outside ASAR) and produces per-architecture
`.zip` artifacts (`imapSyncGUI-<version>-mac-<arch>.zip`). A packaged build
resolves and launches only that bundled runtime. The packaged-runtime smoke
test (`pnpm package:smoke`) exercises the same resolution path offline, from
inside the packaged `.app`, in a host-isolation environment.

## Status and known limitations

- **`darwin-x64`:** self-contained official `imapsync` binary, staged, validated,
  self-tested, packaged, and smoke-tested successfully.
- **`darwin-arm64`:** built and verified natively via the GitHub Actions
  `macos-15` arm64 runner (ADR-014). The self-built PAR::Packer binary is arm64,
  links only system `libSystem`, passes host-isolation self-test, and the
  packaged smoke test passes from inside the arm64 `.app`. No official arm64
  standalone binary exists, so the runtime is self-built from the upstream
  `imapsync` script (ADR-013).
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

The x64 binary is pinned by URL + SHA-256; the arm64 recipe records the exact
`imapsync` version + script SHA-256. License texts are staged into the runtime
and shipped with the application.
