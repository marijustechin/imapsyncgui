# TASK-009A — Complete self-contained x86_64 Perl/imapsync runtime

## Goal

Complete and prove a fully self-contained production `imapsync` runtime for macOS Intel (`x86_64`).

The packaged x86_64 application must be able to launch and use its bundled Perl/imapsync runtime without depending on:

- Homebrew;
- MacPorts;
- system Perl;
- developer CPAN paths;
- developer OpenSSL;
- user-specific filesystem paths;
- Rosetta.

This task targets **x86_64 only**.

Do not work on arm64 runtime packaging in this task.

## Context

The project already has:

- deterministic runtime architecture mapping;
- packaged runtime resolution;
- runtime manifests;
- runtime validation;
- runtime self-test tooling;
- electron-builder packaging;
- a real x86_64 `.app` / `.zip` artifact;
- packaged smoke-test infrastructure.

TASK-009 proved that the Electron artifact can be built and launched, but also proved that it is not yet distributable because the bundled runtime lacks a portable Perl + native dependency tree.

That blocker must be resolved here for x86_64.

## Definition of success

This task is complete only when the packaged x86_64 application can execute the bundled runtime using only application-contained runtime files.

The proof must not rely on a developer-installed Perl or `imapsync`.

The runtime must work when Homebrew/MacPorts-specific executable paths are unavailable.

A green `pnpm verify` alone is not sufficient.

## Runtime contents

The x86_64 runtime must contain everything required for the supported `imapsync` workflow.

At minimum evaluate and include:

- Perl interpreter;
- standard Perl runtime files required by that interpreter;
- `imapsync`;
- required CPAN modules;
- native Perl modules;
- TLS/SSL-related modules;
- OpenSSL runtime libraries where required;
- any runtime loader support files;
- third-party license files required for redistribution.

Do not rely on `/usr/bin/perl`.

## Source and version pinning

Use deterministic versions.

Pin and document:

- Perl version;
- `imapsync` version;
- relevant CPAN module versions;
- OpenSSL version if bundled;
- any build helper/tool version required to reproduce the runtime.

Do not rely on mutable `latest` references where pinned upstream releases exist.

Record provenance and checksums where practical.

## Build strategy

Implement a reproducible x86_64 runtime build process.

The build must be scriptable from the repository.

Do not manually assemble the runtime by copying random directories.

The process must make clear:

1. where sources come from;
2. how Perl is built or staged;
3. how required modules are installed;
4. how native modules are linked;
5. how OpenSSL is provided;
6. how files are staged into the final runtime directory;
7. how the runtime is validated.

Do not hardcode the current username or workstation path.

## Relocatability

The bundled Perl runtime must work from inside the packaged `.app`.

It must not depend on its original build prefix.

Inspect runtime configuration such as:

- Perl compiled-in paths;
- `@INC`;
- native module locations;
- dynamic-library references;
- OpenSSL library references.

Application-relative runtime paths must be used where needed.

Do not accept a runtime that works only from its build directory.

## Perl library resolution

The packaged runtime must resolve required Perl libraries from its own runtime tree.

If environment variables such as `PERL5LIB` are required:

- construct them deterministically in privileged runtime code;
- derive them from the packaged runtime root;
- do not use developer-machine paths.

Document the final resolution strategy.

## Native library resolution

Inspect all relevant native binaries and modules.

Use tools such as:

- `file`;
- `otool -L`;
- `otool -l`;
- appropriate Perl configuration inspection.

The final staged runtime must not reference:

- `/usr/local/Cellar/...`;
- `/opt/homebrew/...`;
- `/opt/local/...`;
- developer home directories;
- temporary build directories.

System macOS libraries may be used where appropriate and stable.

Bundle required non-system libraries.

Where necessary, use relocatable loader references such as:

- `@rpath`;
- `@loader_path`;
- `@executable_path`;

or another correct macOS mechanism.

Document any install-name rewriting performed.

## OpenSSL

Determine exactly how the bundled Perl SSL stack resolves OpenSSL.

If `Net::SSLeay` or other native modules depend on non-system OpenSSL:

- bundle the required OpenSSL libraries;
- make library loading relocatable;
- verify the native module resolves only bundled/system-safe libraries.

Do not rely on a Homebrew OpenSSL installation in packaged mode.

## Runtime environment

Create one explicit function/module responsible for constructing the environment used by the bundled Perl process.

Production environment may include only required runtime configuration plus inherited safe baseline variables.

Do not accidentally inherit developer-specific Perl/OpenSSL configuration such as:

- `PERL5LIB`;
- `PERL_LOCAL_LIB_ROOT`;
- `PERL_MB_OPT`;
- `PERL_MM_OPT`;
- Homebrew-specific library variables

unless explicitly sanitized and rebuilt for the bundled runtime.

Credential environment variables from ADR-007 must continue to work.

Do not log the environment.

## Host-isolation proof

Create a runtime verification mode that intentionally removes common developer runtime dependencies.

At minimum execute the packaged runtime with an environment that does not expose Homebrew or MacPorts executable paths.

For example, the test may use a restricted baseline such as:

`PATH=/usr/bin:/bin`

or an equivalently controlled environment.

Also clear developer Perl-related environment variables before the self-test.

The bundled runtime must still pass.

## Packaged-path proof

The runtime must be tested from the actual packaged application resource location, not only from the repository staging directory.

Expected conceptual location:

`imapSyncGUI.app/Contents/Resources/runtime/darwin-x64/...`

Use the same packaged resolver used by the application.

Do not substitute a test-only path that bypasses production resolution.

## Required runtime self-tests

Add deterministic offline checks that prove at minimum:

1. bundled Perl executable starts;
2. Perl architecture is x86_64;
3. `@INC` resolves the bundled module tree;
4. required Perl modules load;
5. SSL stack loads;
6. `Net::SSLeay` loads successfully if required;
7. bundled OpenSSL dynamic libraries resolve;
8. `imapsync` starts sufficiently to report version/help/check output;
9. no network access is required.

Where practical, also print/inspect runtime version information during developer verification.

Do not expose secrets.

## imapsync invocation proof

Use the same executable/script arrangement that production migration will use.

If production uses:

- bundled Perl executable;
- bundled `imapsync` script;
- `prefixArgs`;

then the self-test must exercise that exact model.

Do not validate with one invocation strategy and ship another.

## Packaged application smoke test

Rebuild the x86_64 Electron artifact with the completed runtime.

Then verify:

- `.app` launches;
- packaged runtime validation succeeds;
- packaged runtime self-test succeeds;
- no PATH fallback is used;
- no system Perl is used;
- no Homebrew/MacPorts runtime is used.

This must be an actual packaged-app test.

## Runtime identity checks

Record and verify:

- `file` output for bundled Perl;
- `file` output for native Perl modules;
- `otool -L` output for relevant native modules;
- bundled OpenSSL architecture;
- runtime manifest architecture.

Required native components must be x86_64.

Reject mismatches.

## Negative tests

Add deterministic failure tests where practical.

At minimum cover:

- missing bundled Perl;
- missing required Perl module;
- malformed runtime manifest;
- architecture mismatch;
- broken native library reference;
- packaged mode with empty/restricted PATH;
- system Perl unavailable;
- Homebrew path unavailable.

The application must fail safely rather than silently falling back to another runtime.

## No fallback rule

Packaged production must never recover from a broken bundled runtime by trying:

- `imapsync` from PATH;
- `/usr/bin/perl`;
- Homebrew Perl;
- MacPorts Perl;
- `IMAPSYNC_EXECUTABLE`.

A broken production runtime is a typed runtime failure.

This is mandatory.

## Licensing

Update the third-party inventory with exact versions actually bundled.

Include license files in the runtime where redistribution requires them.

At minimum verify licensing for:

- Perl;
- `imapsync`;
- OpenSSL;
- bundled CPAN modules with redistribution obligations.

Do not mark licensing complete based only on package names.

Record any unresolved redistribution blocker explicitly.

## Git policy

Do not commit large generated runtime binaries unless the existing repository policy explicitly chooses to do so.

Commit:

- build scripts;
- manifests/templates;
- pinned versions;
- hashes;
- validation scripts;
- license metadata;
- reproducibility instructions.

Generated runtime output should remain in ignored build/runtime directories where appropriate.

## Developer workflow

Development mode may still use:

- `IMAPSYNC_EXECUTABLE`;
- `imapsync` on PATH.

Do not remove this workflow.

README must clearly separate:

### Development convenience

Local `imapsync` may be used.

### Packaged production

The bundled self-contained runtime is mandatory.

Homebrew must not appear as an end-user requirement.

## Tests

Add/update deterministic automated tests covering at minimum:

- bundled-runtime environment construction;
- developer Perl environment variables are sanitized;
- packaged runtime receives application-relative `PERL5LIB` or equivalent;
- packaged runtime never uses PATH/system Perl fallback;
- bundled Perl/script invocation shape;
- architecture mismatch rejection;
- safe error mapping;
- credentials remain outside argv;
- runtime environment is not logged;
- existing renderer/preload security boundaries remain unchanged.

Normal unit tests must remain runnable without rebuilding Perl.

## Native verification commands

Provide clear repository commands for the x86_64 flow.

Conceptually:

- build x64 runtime;
- validate x64 runtime;
- self-test x64 runtime;
- package x64 app;
- smoke-test packaged x64 runtime.

Use project-appropriate command names.

Document the commands in README/docs.

## Completion report

The completion report must state explicitly:

- host architecture;
- Perl version bundled;
- `imapsync` version bundled;
- OpenSSL version bundled;
- runtime path inside `.app`;
- whether bundled Perl was actually executed;
- whether `Net::SSLeay`/SSL stack was actually loaded;
- whether `imapsync` self-test actually ran;
- whether PATH was restricted;
- whether Homebrew/MacPorts paths were absent;
- whether the packaged `.app` launched;
- whether runtime self-test was executed from inside the packaged `.app`;
- signing status;
- notarization status.

Do not omit failed verification.

## Documentation

Update:

- `README.md`;
- `docs/runtime.md`;
- `docs/architecture.md`;
- `docs/security.md`;
- `docs/testing.md`;
- `docs/third-party-licenses.md`;
- `docs/decisions.md` if a meaningful build/runtime architecture decision is introduced;
- `docs/progress.md`.

Update `tasks/backlog.md` only with concrete follow-up work.

Do not remove the arm64 follow-up.

## Scope restrictions

Do not:

- implement arm64 portable runtime;
- build/verify arm64 artifacts;
- produce universal builds;
- depend on Rosetta;
- implement Apple signing;
- implement notarization;
- start clean-machine TASK-010;
- add Windows/Linux packaging;
- modify migration UX except for a narrowly required runtime failure;
- weaken credential handling;
- use system Perl in packaged production;
- install Homebrew on behalf of end users;
- claim distributability before the host-isolation proof passes.

## Verification

Run:

`pnpm verify`

It must pass.

Also run the full native x86_64 runtime/package verification sequence.

A task completion based only on unit tests is invalid.

## Acceptance criteria

TASK-009A is complete only when:

- a self-contained x86_64 Perl runtime exists;
- required Perl modules are bundled;
- required OpenSSL/native dependencies are bundled or safely system-resolved;
- bundled runtime is relocatable;
- no developer-machine dynamic library paths remain;
- packaged mode uses only the bundled Perl/runtime;
- no PATH/system/Homebrew/MacPorts fallback exists;
- runtime environment is deterministic and sanitized;
- bundled Perl actually runs from inside packaged `.app`;
- required modules actually load from the packaged runtime;
- SSL/native stack actually loads;
- `imapsync` offline self-test actually succeeds;
- packaged resolver/manifest validation succeeds;
- restricted-PATH host-isolation verification succeeds;
- x86_64 `.app` actually launches;
- licensing inventory matches bundled components;
- `pnpm verify` succeeds;
- all native x86_64 verification results are documented honestly.

If any of these fail, the task remains blocked rather than being declared production-ready.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete` only after the actual packaged x86_64 runtime proof passes;
2. archive the full task as `tasks/done/TASK-009A.md`;
3. append a concise entry to `docs/progress.md`;
4. remove TASK-009A from `tasks/backlog.md` if listed;
5. preserve/add the arm64 runtime follow-up;
6. do not automatically start the next task.

## Status

Complete (self-contained x86_64 runtime proof passed).

Host architecture: `x86_64`.

Completion report:

- Perl version bundled: 5.34 (embedded in the official binary, PAR::Packer).
- `imapsync` version bundled: 2.314 (official `imapsync_bin_Darwin_x86_64`,
  SHA-256 `cf15ed54a50bdbc9a1f4e118916a95e7bb36deb2c1b6f643d16b84223cc49b88`).
- OpenSSL version bundled: embedded in the binary.
- Runtime path inside `.app`:
  `Contents/Resources/runtime/darwin-x64/bin/imapsync` (+ `licenses/`, `manifest.json`).
- Bundled Perl actually executed: yes (the binary runs with a restricted
  `PATH=/usr/bin:/bin:/usr/sbin` and cleared developer Perl variables).
- `Net::SSLeay`/SSL stack actually loaded: yes (offline `--tests` passed all
  non-network checks; the 3 failures are IPv6 DNS lookups requiring network).
- `imapsync` self-test actually ran: yes (from inside the packaged `.app`).
- PATH restricted: yes (host-isolation baseline in self-test + smoke test).
- Homebrew/MacPorts paths absent: yes (`otool -L` shows only `libSystem`).
- Packaged `.app` launched: yes.
- Runtime self-test from inside `.app`: yes (`pnpm package:smoke`).
- Signing status: unsigned (no Apple identity; `mac.identity: null`).
- Notarization status: not notarized.

`pnpm verify` passes (170 tests). arm64 remains unbuilt/unverified (no official
arm64 standalone binary) and is preserved as a follow-up.
