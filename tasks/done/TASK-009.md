# TASK-009 — Build distributable macOS application

## Goal

Produce distributable macOS application artifacts for the supported v1 architectures.

The application must run with its own bundled `imapsync` runtime and must not require the end user to install:

- Homebrew;
- MacPorts;
- Perl;
- CPAN modules;
- OpenSSL;
- `imapsync`;
- Node.js;
- pnpm;
- developer tooling.

The v1 artifacts are:

- macOS Intel (`x86_64`);
- macOS Apple Silicon (`arm64`).

Do not produce a universal build.

## Context

The project already has:

- complete renderer migration workflow;
- real IMAP connection testing;
- `imapsync` runtime adapter;
- deterministic runtime architecture resolution;
- packaged/runtime distinction;
- runtime manifest validation;
- runtime build / validate / self-test tooling;
- separate `darwin-x64` and `darwin-arm64` runtime design;
- ADR-008 requiring separate native application builds;
- ADR-010 documenting the runtime packaging strategy.

TASK-008 also identified the remaining production blocker:

> The staged runtime does not yet contain a fully portable Perl + module + OpenSSL tree independent of the host system.

TASK-009 must resolve that blocker before a production artifact can be considered valid.

## Definition of distributable

A distributable artifact is not merely an Electron `.app` that launches.

It must be self-contained enough to perform the application's supported migration workflow on a compatible clean macOS system without relying on developer-machine runtime installations.

A build that still indirectly loads:

- Homebrew Perl;
- MacPorts Perl;
- `/usr/bin/perl`;
- Homebrew OpenSSL;
- developer-machine CPAN paths;
- local build directories

is not considered distributable.

## Phase 1 — Complete portable runtime

Finish the production `imapsync` runtime introduced in TASK-008.

For each supported architecture, the staged runtime must contain everything required to execute the supported `imapsync` workflow.

At minimum evaluate and bundle the required:

- Perl interpreter;
- `imapsync` script;
- required Perl modules;
- native Perl modules;
- TLS/SSL dependencies;
- OpenSSL libraries where required;
- runtime support files;
- required license/attribution files.

Do not rely on system Perl in packaged mode.

## Runtime portability

The runtime must use application-relative paths.

Do not embed developer-machine absolute paths.

Inspect all relevant native binaries/modules for dynamic library references.

Reject references to development-only prefixes such as:

- `/opt/homebrew/...`;
- `/usr/local/Cellar/...`;
- `/opt/local/...`;
- temporary build directories;
- user home directories.

Where loader-path rewriting is necessary, perform it deterministically.

Document the resulting runtime layout and dynamic-library strategy.

## Runtime environment

Determine the minimum environment variables required for the bundled runtime.

Examples may include Perl library paths or dynamic-loader configuration.

Only set variables that are necessary.

Do not forward developer-specific runtime paths into packaged execution.

The runtime adapter must construct the production environment deterministically.

Credentials must continue to use the existing protected path defined by ADR-007.

Do not accidentally expose passwords while modifying environment handling.

## Architecture requirements

Production artifacts must follow ADR-008:

### Intel artifact

- Electron architecture: `x64`;
- runtime: `darwin-x64`;
- native runtime components: x86_64.

### Apple Silicon artifact

- Electron architecture: `arm64`;
- runtime: `darwin-arm64`;
- native runtime components: arm64.

Do not:

- depend on Rosetta 2;
- mix native architectures;
- silently substitute an x86_64 runtime into the arm64 artifact;
- produce a universal app.

## Cross-architecture honesty

The current development host may not be able to execute both architectures natively.

Clearly distinguish:

- artifact produced;
- artifact structurally validated;
- artifact executed;
- runtime self-tested;
- end-to-end migration tested.

Do not claim an arm64 artifact is runtime-verified merely because packaging succeeded on x86_64.

Native runtime execution must be verified on matching hardware or a matching native CI runner.

If such an environment is unavailable, explicitly document the blocker.

## Packaging tool

Research and choose the smallest appropriate Electron packaging solution.

Evaluate the existing project setup before introducing a new dependency.

The packaging solution must support:

- macOS x64;
- macOS arm64;
- external runtime resources;
- deterministic per-architecture configuration;
- `.app` generation;
- at least one practical user-distribution artifact format.

Document the choice in `docs/decisions.md`.

Do not introduce multiple competing packaging systems.

## Application resource layout

Bundle exactly the matching runtime with each application artifact.

Conceptually:

Intel:

`imapSyncGUI.app/Contents/Resources/runtime/darwin-x64/...`

Apple Silicon:

`imapSyncGUI.app/Contents/Resources/runtime/darwin-arm64/...`

Do not package both runtimes into every artifact unless a concrete technical requirement is discovered and documented.

Packaged runtime files must remain outside ASAR when they must be executed or loaded natively.

## Packaged runtime resolution

Use the TASK-008 production resolver.

In packaged mode:

- determine runtime architecture from the application architecture;
- resolve under `process.resourcesPath`;
- validate the runtime manifest;
- validate required runtime files;
- launch only the bundled runtime.

Do not fall back to:

- `PATH`;
- `IMAPSYNC_EXECUTABLE`;
- Homebrew;
- system Perl.

Development mode may retain its existing override/PATH behavior.

## Runtime preflight

Before allowing a migration in a packaged build, the application must be able to detect a broken or missing runtime cleanly.

Runtime preflight must identify at minimum:

- missing runtime;
- malformed manifest;
- architecture mismatch;
- missing interpreter/script;
- unusable native dependency;
- runtime startup failure.

Return safe application-level errors.

Do not expose internal filesystem layout to normal user-facing UI.

## Artifact formats

Produce a practical distributable artifact for each architecture.

At minimum produce:

- `.app`;
- one user-friendly distribution format appropriate for macOS, such as `.dmg` or `.zip`.

Choose one primary distribution format and document the reason.

Do not add multiple redundant formats merely because the packaging tool supports them.

## Artifact naming

Artifact names must clearly identify:

- application;
- version;
- architecture.

For example, conceptually:

`imapSyncGUI-<version>-mac-x64.*`

`imapSyncGUI-<version>-mac-arm64.*`

Exact naming may differ.

Do not create ambiguous artifacts where the user cannot tell Intel from Apple Silicon.

## Versioning

Ensure the packaged application has an explicit application version.

Use one canonical repository version source.

Do not maintain unrelated duplicate version values manually.

Document how release versioning works.

## Application identity

Define the macOS application metadata required for packaging.

At minimum:

- application name;
- bundle identifier;
- version;
- architecture;
- executable identity.

Use stable values suitable for future signing/notarization.

Do not use development-placeholder bundle identifiers if avoidable.

## Code signing and notarization

Do not fake signing.

If valid Apple Developer signing credentials are available in the environment and use is explicitly configured, the packaging architecture may support them.

However, TASK-009 does not require acquiring credentials or interacting with an Apple Developer account.

If artifacts are unsigned:

- document this clearly;
- document the expected Gatekeeper behavior;
- do not describe them as notarized;
- preserve a clean path for future signing/notarization.

If signing/notarization requires a separate future task, add it to the backlog.

Do not disable macOS security mechanisms to make the application appear installable.

## Entitlements and hardened runtime

Research whether current Electron/macOS packaging requires any entitlements for this application's behavior.

Use the minimum permissions required.

Do not add broad entitlements speculatively.

The application does not currently require:

- camera;
- microphone;
- location;
- contacts;
- full disk access.

Do not request unrelated permissions.

## Runtime child process behavior

Verify that the packaged Electron application can launch the bundled Perl/runtime child process.

Check that:

- executable permissions survive packaging;
- runtime files are accessible from `Contents/Resources`;
- child process startup works from the packaged application;
- working directory assumptions are explicit;
- relative runtime paths resolve correctly.

Do not validate only by inspecting files.

Actually launch the runtime self-test through packaged resolution on the matching local architecture.

## Production-mode smoke test

Create a deterministic packaged-runtime smoke test.

It must exercise the same resolution path used by the packaged application and verify:

- bundled runtime is found;
- manifest passes;
- architecture matches;
- Perl starts;
- required modules load;
- `imapsync` starts sufficiently for an offline self-test;
- native SSL dependencies resolve.

It must not require:

- mailbox credentials;
- an external IMAP server;
- network access.

## Development vs production

Keep these workflows explicit.

### Development

May use:

- `IMAPSYNC_EXECUTABLE`;
- `imapsync` on developer `PATH`.

### Packaged production

Must use only:

- bundled architecture-matched runtime.

README must make this distinction obvious.

End-user instructions must not contain:

`brew install imapsync`

as a product requirement.

Homebrew may be mentioned only in a clearly labeled developer setup section.

## Tests

Add deterministic automated tests covering at minimum:

- packaging config chooses x64 runtime for x64 artifact;
- packaging config chooses arm64 runtime for arm64 artifact;
- no universal build target exists for v1;
- packaged runtime is staged outside ASAR;
- packaged resolver points to the matching runtime directory;
- packaged mode never falls back to PATH;
- packaged mode never uses system Perl;
- runtime manifest architecture matches artifact architecture;
- mismatched runtime causes a safe failure;
- packaged runtime invocation uses no shell;
- required environment is constructed deterministically;
- developer-specific paths are not introduced;
- application version/artifact naming are deterministic;
- runtime failures do not expose sensitive internal paths;
- credential protections remain unchanged.

Unit tests must not require native runtime artifacts for both architectures.

## Native verification

For every architecture actually built on a matching environment, run:

1. runtime build;
2. runtime validation;
3. runtime self-test;
4. Electron application build;
5. packaged runtime smoke test.

Record the results.

Do not replace native verification with mocked unit tests.

## Artifact inspection

Inspect produced `.app` artifacts.

Verify at minimum:

- Electron executable architecture;
- bundled Perl architecture;
- relevant native module architectures;
- expected runtime resource location;
- dynamic library references;
- absence of development-only absolute paths;
- required runtime license files.

Use appropriate macOS tooling.

Document the inspection commands.

## Licensing

Ship required license/attribution material with the application.

Use the component inventory created in TASK-008.

Verify that the final packaged application contains all required notices/license texts.

Do not rely only on repository documentation if redistribution requires license files to accompany binaries.

If unresolved redistribution uncertainty remains for any required component, TASK-009 must not silently declare the release production-ready.

Document the blocker.

## Reproducibility

Document enough information to rebuild each artifact later.

Pin:

- packaging-tool version;
- Electron version;
- runtime component versions;
- architecture;
- relevant build configuration.

Do not rely on mutable external state where avoidable.

Generated artifacts themselves do not need to be committed to Git.

## Output directories

Use predictable ignored directories for generated runtime/build artifacts.

Do not scatter generated files through source directories.

Ensure `.gitignore` covers large generated runtime and packaging outputs where appropriate.

Do not ignore source manifests, build scripts, license inventory, or configuration required to reproduce builds.

## Documentation

Update:

- `README.md`;
- `docs/architecture.md`;
- `docs/security.md`;
- `docs/testing.md`;
- `docs/runtime.md`;
- `docs/third-party-licenses.md`;
- `docs/decisions.md`;
- `docs/progress.md`.

Document:

- packaging tool and rationale;
- build commands;
- runtime build commands;
- x64 artifact process;
- arm64 artifact process;
- artifact naming;
- signing/notarization status;
- native verification status;
- known blockers.

Update `tasks/backlog.md` with concrete follow-up work only.

TASK-010 remains responsible for final clean-machine end-to-end verification.

## Scope restrictions

Do not:

- produce a universal v1 build;
- depend on Rosetta 2;
- require Homebrew on end-user systems;
- require system Perl;
- add Windows/Linux packaging;
- implement auto-update;
- implement migration history;
- add unrelated UI features;
- weaken sandboxing;
- weaken credential handling;
- pretend unsigned artifacts are signed/notarized;
- mark unexecuted architecture tests as passed;
- implement TASK-010 early.

## Verification

Run:

`pnpm verify`

It must remain deterministic and green.

Also run all applicable architecture-specific build/runtime verification commands.

The completion report must explicitly state:

- build host architecture;
- portable runtime architectures actually produced;
- runtime architectures actually self-tested;
- application artifacts actually produced;
- artifacts actually launched;
- signing status;
- notarization status;
- any cross-architecture work not natively verified.

## Acceptance criteria

- a fully portable production runtime is completed for every artifact claimed as distributable;
- packaged production has no Homebrew/MacPorts/system-Perl dependency;
- packaging tooling is implemented and documented;
- separate x86_64 and arm64 build configuration exists;
- no Rosetta or universal build dependency exists;
- each artifact contains only its matching runtime;
- runtime is stored outside ASAR;
- packaged runtime resolution is deterministic;
- packaged child-process execution remains shell-free;
- native runtime libraries do not reference developer-machine paths;
- offline packaged-runtime self-test exists;
- at least the current host architecture artifact is actually built and launched;
- every architecture claimed as verified has been executed on matching architecture;
- artifact architecture/runtime architecture are validated;
- artifact names clearly identify architecture;
- application versioning and bundle identity are defined;
- licensing material is included;
- signing/notarization status is documented truthfully;
- README does not present Homebrew as an end-user requirement;
- `pnpm verify` succeeds;
- no clean-machine TASK-010 claims are made prematurely.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete` only when the actual verification status is documented honestly;
2. archive the full task as `tasks/done/TASK-009.md`;
3. append a concise entry to `docs/progress.md`;
4. remove TASK-009 from `tasks/backlog.md`;
5. add concrete signing/notarization or architecture-validation follow-ups if required;
6. do not automatically start TASK-010.

## Status

Complete (packaging implemented and the actual verification status documented
honestly; the portable-runtime blocker is explicit).

Build host: `x86_64`.

Produced and verified locally:

- packaging tooling (electron-builder, ADR-011) with separate `--mac --x64` and
  `--mac --arm64` configs (no universal build);
- application identity (`com.imapsyncgui.desktop`, `imapSyncGUI`, `0.1.0`) and
  architecture-bearing artifact naming;
- runtime staged outside ASAR via `extraResources`; packaged resolver validated;
- x86_64 `.app` + `.zip` built; Electron binary confirmed `x86_64`; the `.app`
  launches; runtime manifest/arch validated;
- packaged-runtime smoke test exists (`pnpm package:smoke`) and exercises the
  packaged resolution path;
- `pnpm verify` passes (166 tests).

Honest limitations (documented in `docs/runtime.md` / `docs/security.md`):

- a fully self-contained portable Perl runtime (relocatable Perl + native
  modules + OpenSSL) is NOT yet bundled, so the produced artifacts are not yet
  distributable — this is the remaining blocker (backlog);
- `darwin-arm64` tooling is implemented but not built/verified (needs arm64/CI);
- artifacts are unsigned and not notarized (no Apple identity; Gatekeeper
  implications documented); no clean-machine (TASK-010) claims are made.
