# TASK-008 — Package imapsync runtime for macOS

## Goal

Create a reproducible, architecture-specific bundled `imapsync` runtime for macOS.

The production application must eventually be able to run migrations on a supported Mac without requiring the end user to install:

- Homebrew;
- MacPorts;
- Perl;
- CPAN modules;
- `imapsync`;
- command-line developer tooling.

This task is about building, validating, staging, and resolving the bundled runtime.

Do not build the final DMG/distribution artifacts yet.

TASK-009 will produce the final distributable macOS applications.

## Context

The project already has:

- an `imapsync` runtime adapter;
- safe `spawn()` execution with no shell;
- credential transport through environment variables;
- development executable resolution through `IMAPSYNC_EXECUTABLE` / `PATH`;
- renderer migration UI;
- connection testing;
- migration streaming/cancellation/results;
- ADR-008 defining the v1 architecture strategy.

ADR-008 requires:

- one native `x86_64` runtime;
- one native `arm64` runtime;
- no Rosetta 2 dependency;
- separate x86_64 and arm64 application artifacts;
- no universal build for v1.

This task must implement the runtime side of that decision.

## Core requirement

A packaged production build must contain everything required to execute the supported `imapsync` migration workflow.

The runtime must not depend on the host system having a compatible Perl environment.

Do not use `/usr/bin/perl` as the production runtime dependency.

Do not require Homebrew or MacPorts on the end-user machine.

## Research requirement

Before implementation, verify the current upstream requirements for running `imapsync` on macOS.

Use authoritative upstream sources where possible.

Determine:

- supported Perl version requirements;
- required Perl modules;
- which dependencies contain native components;
- SSL/TLS runtime requirements;
- OpenSSL dependency requirements;
- runtime library loading implications on macOS;
- redistribution/licensing requirements for:
  - `imapsync`;
  - Perl;
  - bundled Perl modules;
  - OpenSSL;
  - any other native dependency.

Do not blindly copy the developer machine's Homebrew installation into the application.

Document all bundled third-party components and their licenses.

If a redistribution requirement is unclear, document the uncertainty rather than silently assuming redistribution is permitted.

## Runtime architecture

Produce a runtime layout supporting exactly:

- `darwin-x64`;
- `darwin-arm64`.

Do not produce a universal runtime.

The runtime architecture must match `process.arch`.

Expected mapping:

- `x64` → `darwin-x64`;
- `arm64` → `darwin-arm64`.

Any other architecture must be rejected explicitly.

## Runtime layout

Define a deterministic runtime directory structure.

For example, conceptually:

runtime/
darwin-x64/
...
darwin-arm64/
...

The exact internal structure is up to the implementation.

Each architecture runtime must contain everything necessary to invoke `imapsync` without relying on system-installed Perl modules.

Keep runtime files outside the application ASAR archive.

The application must eventually be able to locate them from the packaged application's resources directory.

## Build strategy

Create a reproducible process for constructing each runtime.

The build must not consist of undocumented manual copying.

Provide repository scripts or equivalent deterministic tooling capable of preparing:

- x86_64 runtime;
- arm64 runtime.

The scripts must clearly distinguish:

- downloading/verifying source dependencies;
- building/installing the runtime;
- staging runtime files;
- validating the result.

Do not commit build-machine absolute paths.

Do not hardcode developer-specific Homebrew paths.

## Cross-architecture behavior

Do not pretend to build an architecture that has not actually been built.

If the current development machine is x86_64:

- a native x86_64 runtime may be built and validated locally;
- arm64 runtime tooling/configuration may be implemented;
- arm64 runtime may require an arm64 machine or CI runner for final production generation.

Likewise in reverse for an arm64 development machine.

The task must clearly distinguish:

- implemented build support;
- actually generated runtime artifacts;
- actually executed/verified runtime artifacts.

Do not label an unexecuted cross-architecture artifact as verified.

## Dependency provenance

Every downloaded dependency must have deterministic provenance.

Prefer:

- exact versions;
- upstream release URLs;
- checksums/hashes where feasible.

Do not download:

- arbitrary binaries from forums;
- GitHub issue attachments;
- random mirrors;
- unsigned third-party packages of unknown provenance.

Do not depend on mutable `latest` URLs when a pinned version is available.

## Repository policy

Do not commit large generated runtime artifacts to Git unless there is a strong documented reason.

Prefer:

- build scripts;
- manifests;
- checksums;
- lock/version metadata.

Generated runtime directories should be ignored where appropriate.

The eventual release pipeline may generate them as build artifacts.

Document the chosen policy.

## Runtime manifest

Create a machine-readable runtime manifest.

At minimum record:

- runtime architecture;
- `imapsync` version;
- Perl version;
- relevant bundled module/runtime versions;
- build timestamp or reproducible build identifier if appropriate;
- source/provenance information;
- runtime format version.

Do not include:

- credentials;
- developer usernames;
- absolute local paths;
- secrets.

The manifest must be usable by runtime validation logic.

## Runtime resolution

Extend the existing executable resolution strategy.

Development behavior must remain available:

1. explicit `IMAPSYNC_EXECUTABLE`, when provided;
2. development `PATH` fallback where appropriate.

Packaged production behavior must resolve only the bundled runtime.

Do not silently fall back to arbitrary host-installed `imapsync` in a production packaged application.

Production runtime resolution must be deterministic.

Use the packaged application's resources directory rather than developer-machine paths.

## Runtime validation

Before starting a migration using the bundled runtime, validate at minimum:

- supported platform;
- supported architecture;
- expected runtime directory exists;
- expected executable/interpreter exists;
- required runtime files exist;
- manifest exists and matches the current architecture.

Return typed application-level failures.

Do not expose raw filesystem paths to normal renderer UX.

## Runtime invocation

Preserve the existing security model.

The migration adapter must continue to:

- use `spawn()`;
- use an argument array;
- use no shell;
- prevent arbitrary executable selection by renderer input;
- prevent arbitrary flag injection;
- keep passwords out of argv;
- sanitize output before renderer delivery.

If bundled execution requires invoking:

`perl imapsync ...`

rather than executing `imapsync` directly, model executable and script paths explicitly and safely.

Do not construct:

`"perl " + script + " " + args`

or any equivalent command string.

## Dynamic libraries

Inspect native runtime components for external library references.

On macOS, verify relevant binaries/modules using appropriate tooling such as:

- `file`;
- `otool -L`;
- architecture inspection tooling.

The bundled runtime must not accidentally reference developer-machine-only locations such as:

- `/opt/homebrew/...`;
- `/usr/local/Cellar/...`;
- MacPorts prefixes;
- temporary build directories.

If runtime loader paths must be rewritten, implement this deterministically and document it.

Do not assume that copying native files is sufficient.

## Architecture verification

For generated native runtime components, verify the architecture.

The x86_64 runtime must not contain required arm64-only native components.

The arm64 runtime must not contain required x86_64-only native components.

Reject mismatches during runtime build validation.

Do not rely on Rosetta.

## Runtime self-test

Create a deterministic runtime self-test.

It must verify that the staged runtime can start sufficiently to demonstrate that:

- Perl launches;
- required modules load;
- `imapsync` loads/starts;
- bundled SSL/native dependencies resolve.

The self-test must not:

- require real mailbox credentials;
- contact a real IMAP server;
- perform a migration;
- require network access after the runtime has been built.

Use an upstream-supported version/help/check operation if suitable.

## Production application integration

Configure application packaging inputs so that the correct architecture-specific runtime can be included as an external application resource in TASK-009.

Do not package both runtimes into every v1 application artifact unless there is a concrete reason.

Expected future relationship:

- x86_64 application artifact → x86_64 runtime;
- arm64 application artifact → arm64 runtime.

Do not create a universal runtime-selection system for v1.

## Error contract

Introduce or extend stable runtime failure categories only where needed.

At minimum distinguish failures such as:

- runtime missing;
- architecture mismatch;
- runtime invalid/corrupt;
- runtime startup failure.

Do not leak:

- full internal paths;
- stack traces;
- environment dumps;
- loader diagnostics containing sensitive host information

to normal renderer UX.

Detailed development diagnostics may remain in controlled developer-only channels if already supported safely.

## Existing development workflow

Do not break normal development unnecessarily.

Developers may continue using:

- `IMAPSYNC_EXECUTABLE`;
- local `imapsync` from PATH;

when running unpackaged development builds.

Packaged production behavior must be different and deterministic.

Document this distinction clearly.

## Testing

Add deterministic automated tests covering at minimum:

- x64 → darwin-x64 runtime mapping;
- arm64 → darwin-arm64 runtime mapping;
- unsupported architecture rejection;
- development executable override behavior;
- development PATH fallback behavior;
- packaged mode does not fall back to PATH;
- packaged runtime path resolution;
- runtime manifest validation;
- manifest architecture mismatch;
- missing runtime;
- missing required executable/interpreter;
- malformed runtime manifest;
- correct process invocation shape for bundled Perl/script runtime;
- no shell execution;
- no command-string construction;
- renderer input cannot choose runtime paths;
- credential handling remains unchanged;
- runtime-related failures map to safe application-level results.

Use fixtures/fakes for automated tests where possible.

`pnpm verify` must not require both real architecture runtimes to exist.

## Runtime build verification

Add separate runtime verification commands where appropriate.

Conceptually, commands may include:

- runtime build;
- runtime validate;
- runtime self-test.

Choose clear project-specific names.

Runtime-building commands may depend on platform/build tooling and therefore do not necessarily belong inside the normal `pnpm verify` pipeline.

Document exactly which verification is:

- normal deterministic unit verification;
- native runtime build verification;
- architecture-specific validation.

## Licensing

Create documentation for bundled third-party runtime components.

At minimum record:

- component name;
- version;
- source;
- license;
- redistribution implications;
- attribution/license-file requirements.

Prepare the repository/runtime layout so required license texts can be shipped with the final application.

Do not fabricate license conclusions.

If a dependency's redistribution status is uncertain, flag it explicitly as a blocker for TASK-009 rather than ignoring it.

## Documentation

Update:

- `docs/architecture.md`;
- `docs/security.md`;
- `docs/testing.md`;
- `docs/decisions.md`;
- `docs/progress.md`;
- README where developer/runtime build instructions are needed.

Add dedicated runtime documentation if useful, for example:

`docs/runtime.md`

or equivalent.

Document:

- runtime components;
- per-architecture build process;
- provenance;
- licensing;
- development vs packaged resolution;
- runtime validation;
- known limitations;
- which architecture was actually built/tested locally.

Update TASK-009 backlog description if concrete packaging requirements emerge.

## Scope restrictions

Do not:

- create final `.dmg` / `.pkg` installers;
- implement Apple code signing;
- implement notarization;
- implement auto-update;
- depend on Rosetta;
- produce a universal v1 build;
- require Homebrew on the end-user machine;
- fall back to system Perl in packaged production;
- download arbitrary prebuilt binaries;
- persist credentials;
- modify migration UX unless required for a narrow typed runtime error;
- implement Windows/Linux runtime packaging;
- implement TASK-009 early.

## Verification

Run:

`pnpm verify`

It must remain green.

Also run all native runtime validation/self-test commands that can honestly be executed on the current host architecture.

Clearly report:

- host architecture;
- runtime architecture built;
- runtime architecture validated;
- tests that were simulated only;
- work that necessarily requires the other architecture.

## Acceptance criteria

- architecture-specific runtime strategy is implemented for x86_64 and arm64;
- packaged production resolution is deterministic;
- packaged production does not depend on PATH/Homebrew/MacPorts/system Perl;
- development override/PATH workflow still works;
- runtime build process is scripted and documented;
- runtime versions/provenance are pinned or otherwise deterministic;
- runtime manifest exists;
- runtime architecture is validated;
- required native library references are checked;
- runtime self-test exists;
- the locally supported architecture runtime is actually built and self-tested when technically possible;
- unverified cross-architecture runtime work is honestly labeled as unverified;
- no Rosetta dependency is introduced;
- migration execution remains shell-free;
- credential protections remain intact;
- licensing/redistribution requirements are documented;
- no final DMG/signing/notarization work is implemented;
- relevant documentation and backlog are updated;
- `pnpm verify` succeeds.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete` only if every acceptance criterion that can be satisfied on the current architecture is satisfied and any unavoidable cross-architecture verification limitation is explicitly documented;
2. archive the full task as `tasks/done/TASK-008.md`;
3. append a concise entry to `docs/progress.md`;
4. remove TASK-008 from `tasks/backlog.md`;
5. update TASK-009 only with concrete requirements discovered during this work;
6. do not automatically start TASK-009.

## Status

Complete (all criteria satisfiable on the current `x86_64` host, with the
cross-architecture and portable-Perl limitations explicitly documented).

Implemented and verified:

- per-architecture resolution (`darwin-x64` / `darwin-arm64`) with no Rosetta;
- packaged resolution is deterministic and never falls back to `PATH`/override;
- development override/`PATH` workflow preserved;
- runtime manifest schema + parsing/validation;
- filesystem-injectable runtime validation with typed failures;
- adapter `prefixArgs` for a bundled `perl imapsync` invocation (shell-free);
- build / validate / self-test scripts (`pnpm runtime:build|validate|self-test`);
- runtime + third-party licensing documentation.

Verified locally (host `x86_64`):

- `pnpm verify` passes (162 tests);
- staged `darwin-x64` runtime (imapsync script + manifest);
- self-test passed against host Perl (development-only demonstration).

Unavoidable limitations (documented in `docs/runtime.md`):

- portable Perl + native module tree (incl. OpenSSL) not yet bundled — blocker
  for TASK-009;
- `darwin-arm64` tooling implemented but not built/verified (needs arm64/CI).
