# TASK-009C — Native arm64 CI build and verification

## Goal

Provide a native Apple Silicon macOS CI environment and use it to execute the existing arm64 runtime/build verification flow.

This task exists to remove the infrastructure blocker preventing TASK-009B from being completed.

Do not redesign the arm64 runtime strategy unless the native CI execution proves the current recipe invalid.

## Context

TASK-009B is blocked because:

* there is no official upstream arm64 standalone `imapsync` binary;
* the selected strategy is a self-built arm64 standalone binary via PAR::Packer;
* the local development host is x86_64;
* native Apple Silicon verification is mandatory;
* no local Apple Silicon hardware is available.

The repository already contains:

* an arm64 runtime build recipe;
* architecture guards;
* packaged arm64 resolution logic;
* deterministic tests;
* x86_64 packaged-runtime proof;
* separate x64 / arm64 packaging configuration.

TASK-009C must provide the missing native arm64 execution environment.

## CI platform

Use GitHub Actions with a GitHub-hosted native Apple Silicon macOS runner.

Choose a currently supported arm64 macOS runner label based on current GitHub Actions documentation.

Do not assume a runner is arm64 based only on its name.

The workflow must explicitly verify:

```sh
uname -m
```

and require:

```text
arm64
```

If the runner is not arm64, fail immediately.

## Workflow scope

Create a dedicated workflow for native arm64 runtime and packaging verification.

Suggested location:

`.github/workflows/macos-arm64.yml`

or equivalent.

Do not overload unrelated CI workflows unless there is a strong reason.

## Triggering

Support at minimum:

* manual `workflow_dispatch`.

Optionally also support selected pull-request / branch triggers if that is useful and cost-conscious.

Do not run expensive native packaging work unnecessarily on every trivial commit unless justified.

## Environment verification

At workflow start, record:

* macOS version;
* kernel architecture;
* Node.js version;
* pnpm version;
* Electron version;
* architecture reported by Node (`process.arch`).

Fail unless both OS/runtime architecture checks confirm native arm64.

Do not use Rosetta.

Do not invoke commands with:

```sh
arch -x86_64
```

or otherwise force x86 execution.

## Toolchain setup

Install only the build-time tools required by the existing arm64 recipe.

Build-time Homebrew usage is allowed if needed.

Clearly distinguish:

* CI build dependencies;
* packaged runtime dependencies.

The produced application must not depend on Homebrew at runtime.

Use pinned or controlled versions where practical.

## Node / pnpm setup

Use the repository's canonical Node/pnpm requirements.

Respect the pinned `packageManager` version.

Prefer Corepack rather than installing an arbitrary pnpm version independently.

Run:

```sh
pnpm install --frozen-lockfile
```

or the repository-equivalent deterministic install command.

## Baseline verification

Before native runtime build work, run:

```sh
pnpm verify
```

This must pass on the native arm64 runner.

If deterministic unit tests fail specifically on arm64, investigate and fix only genuine cross-platform assumptions.

Do not weaken tests simply to make CI green.

## arm64 runtime build

Execute the existing repository-controlled arm64 runtime build command.

For example, if currently defined:

```sh
pnpm runtime:build:arm64
```

Use the actual canonical project command.

Do not duplicate runtime-building logic inside YAML.

The workflow must call repository scripts.

## Runtime validation

After building, execute the native arm64 runtime validation command.

Validate at minimum:

* manifest;
* architecture;
* required files;
* executable permissions;
* dynamic-library references;
* absence of developer-machine runtime paths.

The validation must prove native runtime components are arm64.

## Runtime self-test

Run the offline native arm64 runtime self-test.

The test must execute the actual staged runtime and verify:

* runtime starts;
* `imapsync` starts;
* required modules load;
* SSL/native stack loads;
* runtime executes as arm64;
* no Rosetta is involved.

The core smoke test must not require mailbox credentials or external IMAP servers.

## Host-isolation verification

Execute the arm64 runtime under the existing sanitized/restricted environment.

At minimum:

* restrict PATH;
* clear developer Perl environment variables;
* ensure no runtime Homebrew fallback;
* ensure no system Perl fallback;
* ensure no x86_64 binary fallback.

The self-test must still pass.

## arm64 Electron packaging

Build the actual arm64 application artifact using the existing project packaging command.

Do not use universal packaging.

Expected architecture:

```text
arm64
```

The artifact must contain only the arm64 runtime expected by the current v1 packaging strategy.

## Artifact inspection

Inspect the packaged `.app`.

At minimum verify:

* Electron executable is arm64;
* bundled runtime executable is arm64;
* native runtime components are arm64;
* runtime resides in the expected `Contents/Resources` path;
* dynamic-library references contain no CI/Homebrew/build-machine paths;
* runtime manifest reports arm64.

Use appropriate native macOS tooling.

## Packaged smoke test

Run the existing packaged-runtime smoke test against the arm64 `.app`.

This must use the actual packaged resource path.

Verify:

* packaged resolver selects `darwin-arm64`;
* manifest validation passes;
* runtime starts;
* offline `imapsync` self-test passes;
* no PATH/system Perl fallback occurs.

## Application launch verification

Launch the packaged Electron `.app` natively on the Apple Silicon runner if the CI environment permits GUI application startup.

If full GUI launch is not technically possible on the selected hosted runner:

* attempt the strongest reliable application-start verification available;
* document the runner limitation precisely;
* do not claim a GUI launch occurred if it did not.

Do not weaken runtime verification because GUI launch may be constrained in CI.

## Runtime strategy validation

The current TASK-009B strategy is:

> self-built native arm64 standalone `imapsync` via PAR::Packer.

Native CI must prove or disprove this strategy.

If the PAR::Packer build fails:

1. investigate the actual technical cause;
2. fix the recipe if the failure is reproducible and reasonably scoped;
3. preserve provenance/licensing/security requirements.

Do not silently switch to:

* Rosetta;
* x86_64 binary;
* system Perl;
* end-user Homebrew.

If the selected strategy proves fundamentally unworkable, keep TASK-009B blocked and document the evidence.

## Security

Preserve all existing guarantees:

* no passwords in argv;
* no shell-based migration execution;
* no generic IPC;
* no runtime PATH fallback in packaged mode;
* no credential logging;
* no environment dumping containing credential variables.

CI logs must not expose secrets.

Do not print full process environments.

## Caching

Build caching may be introduced only if it does not compromise reproducibility or provenance.

Do not cache generated runtime artifacts in a way that makes it unclear which source/version produced them.

If caching CPAN/build dependencies, key caches using relevant version/lock inputs.

Correctness is more important than CI speed.

## Artifacts

Upload useful CI artifacts after a successful build.

At minimum consider:

* arm64 `.app` archive / project-standard distribution artifact;
* runtime manifest;
* verification summary.

Do not upload:

* credentials;
* arbitrary build caches;
* private environment dumps.

Use clear artifact names including architecture and version.

## Verification report

Generate or preserve enough CI output to demonstrate:

* runner architecture;
* runtime architecture;
* Electron architecture;
* self-test success;
* packaged smoke-test success;
* dynamic-library inspection;
* artifact path/name.

Do not treat workflow success alone as sufficient evidence.

## TASK-009B integration

TASK-009C does not replace TASK-009B.

Its purpose is to provide the native execution proof required by TASK-009B.

If the workflow succeeds and all TASK-009B native acceptance criteria are satisfied:

* update TASK-009B status from Blocked to Complete;
* archive TASK-009B to `tasks/done/TASK-009B.md`;
* update progress;
* remove the arm64-runtime blocker from backlog.

Do this only if the evidence genuinely satisfies TASK-009B.

If native CI reveals unresolved failures:

* keep TASK-009B Blocked;
* document the exact blocker;
* do not archive it as Complete.

## Signing and notarization

Do not implement Apple signing or notarization in this task.

The CI artifact may remain unsigned.

Do not introduce Apple Developer secrets.

Preserve signing/notarization as a separate backlog item.

## Documentation

Update:

* `README.md`;
* `docs/runtime.md`;
* `docs/architecture.md`;
* `docs/testing.md`;
* `docs/security.md` if CI/runtime handling introduces relevant changes;
* `docs/decisions.md` if a meaningful CI/build decision is introduced;
* `docs/progress.md`;
* `tasks/backlog.md`.

Document:

* selected GitHub Actions runner;
* why it qualifies as native arm64;
* workflow trigger;
* exact native verification sequence;
* build-time dependencies;
* uploaded artifacts;
* limitations of hosted runner GUI execution if any.

## Tests

Add deterministic tests only where code/config helpers justify them.

At minimum preserve coverage proving:

* x86_64 behavior remains unchanged;
* arm64 runtime resolution remains isolated;
* no fallback paths are introduced.

Do not write meaningless tests for static YAML text merely to increase test count.

## Scope restrictions

Do not:

* use Rosetta;
* run x86_64 runtime as the arm64 solution;
* produce a universal build;
* require Homebrew on end-user machines;
* implement signing/notarization;
* implement TASK-010 clean-machine E2E;
* weaken runtime validation;
* weaken credential protections;
* mark TASK-009B Complete before native evidence exists.

## Verification

Locally:

```sh
pnpm verify
```

must remain green.

In native arm64 CI, run the full sequence:

1. verify native arm64 host;
2. install dependencies;
3. `pnpm verify`;
4. build arm64 runtime;
5. validate arm64 runtime;
6. self-test arm64 runtime;
7. build arm64 application;
8. inspect artifact architectures;
9. packaged runtime smoke test;
10. application launch/start verification where technically possible.

## Acceptance criteria

TASK-009C is complete when:

* a GitHub Actions native Apple Silicon workflow exists;
* the workflow proves the runner is arm64;
* repository tests pass on arm64;
* the existing arm64 runtime recipe is executed natively;
* runtime validation executes natively;
* runtime self-test executes natively;
* restricted-environment host isolation passes;
* arm64 Electron artifact is produced;
* Electron/runtime architectures are inspected and verified;
* packaged runtime smoke test runs from inside the arm64 `.app`;
* no Rosetta/x64/runtime fallback is used;
* useful build artifacts/evidence are retained;
* CI behavior is documented;
* local `pnpm verify` remains green.

TASK-009C may be Complete even if the native build proves the current TASK-009B runtime strategy has a genuine blocker, provided that blocker is documented accurately.

However, TASK-009B may only become Complete if its own native runtime acceptance criteria actually pass.

## Task lifecycle

On completion:

1. mark `tasks/current.md` TASK-009C as Complete;
2. archive it as `tasks/done/TASK-009C.md`;
3. append a concise entry to `docs/progress.md`;
4. update TASK-009B based strictly on native CI evidence;
5. update backlog blockers;
6. do not automatically start signing/notarization or TASK-010.

## Status

Complete.

The native arm64 workflow (`.github/workflows/macos-arm64.yml`, ADR-014) has
been executed on the GitHub-hosted `macos-15` arm64 runner and passes end to
end:

- runner verified arm64 (`uname -m`, Node `process.arch`);
- `pnpm verify` passes on arm64;
- `runtime:build:arm64` produces a Mach-O arm64 PAR::Packer binary;
- `runtime:validate` → arch/manifest/`otool -L` OK (only system `libSystem`);
- `runtime:self-test` → OK under host isolation;
- `package:mac:arm64` → arm64 `.app` built;
- architecture inspection → Electron and runtime binary both arm64;
- `package:smoke` → OK from inside the arm64 `.app`;
- application launched (best effort); artifact uploaded.

This native evidence satisfies TASK-009B's acceptance criteria, so TASK-009B is
now Complete (archived as `tasks/done/TASK-009B.md`); the arm64-runtime blocker
has been removed from the backlog.
