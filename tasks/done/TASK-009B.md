# TASK-009B — Complete self-contained arm64 Perl/imapsync runtime

## Goal

Complete and prove a fully self-contained production `imapsync` runtime for macOS Apple Silicon (`arm64`).

The packaged arm64 application must be able to execute migrations using only its bundled runtime and must not depend on Homebrew, MacPorts, system Perl, developer CPAN paths, developer OpenSSL, Rosetta 2, x86_64 compatibility execution, or user-specific filesystem paths.

## Context

- x86_64: proven production runtime using the official upstream `imapsync_bin_Darwin_x86_64` (standalone PAR::Packer binary).
- arm64: no equivalent proven official standalone binary exists.

## Definition of success

Native arm64 packaged application can execute a self-contained arm64 `imapsync` runtime without Rosetta or host-installed runtime dependencies.

## Strategy (ADR-013)

No official arm64 standalone binary exists (`imapsync_bin_Darwin_arm64` → HTTP 404). Strategy hierarchy:

1. official upstream native arm64 standalone binary (does not exist);
2. reproducibly build a native arm64 standalone binary via PAR::Packer (chosen);
3. bundle a relocatable native arm64 Perl runtime + modules + OpenSSL;
4. document a blocker.

## Acceptance criteria

- a self-contained native arm64 `imapsync` runtime exists;
- runtime contains/embeds all required non-system dependencies;
- no Rosetta, system/Homebrew/MacPorts Perl, or developer-machine library paths;
- runtime architecture verified arm64; native modules/libraries arm64;
- runtime relocatable; restricted-PATH host-isolation passes;
- runtime self-test passes natively on Apple Silicon;
- packaged resolver selects only `darwin-arm64`;
- packaged runtime smoke test succeeds from inside the arm64 `.app`;
- the arm64 Electron `.app` launches on Apple Silicon;
- no x64 fallback; x86_64 behavior intact;
- licensing documentation matches the runtime;
- `pnpm verify` succeeds.

## Status

Complete (native arm64 evidence).

The arm64 runtime is self-built via PAR::Packer (ADR-013) using the current
Homebrew `perl` and the full required CPAN module set, and verified natively on
a GitHub-hosted `macos-15` arm64 runner (ADR-014):

- runtime binary is Mach-O arm64, links only system `libSystem`;
- runtime validation OK; self-test OK under host isolation;
- packaged arm64 `.app` built; packaged smoke test OK from inside the `.app`;
- `.app` launched (best effort); artifacts uploaded;
- manifest records imapsync 2.324 + script SHA-256.

x86_64 behavior is unchanged; no Rosetta/x64/PATH fallback is used.
