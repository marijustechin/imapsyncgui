# TASK-003A — Define macOS architecture and runtime distribution matrix

## Goal

Define the supported macOS architecture strategy for `imapSyncGUI` and its future bundled `imapsync` runtime.

This is primarily a research and architecture task.

Do not implement final packaging yet.

## Context

TASK-003 established the `imapsync` runtime adapter and documented that:

- `imapsync` is primarily distributed as a Perl script;
- development currently resolves `IMAPSYNC_EXECUTABLE` or `imapsync` from `PATH`;
- full runtime bundling is deferred to TASK-008 / TASK-009;
- available standalone Darwin binaries are x86_64-only.

The project must now explicitly define how macOS architecture differences affect distribution.

## Research

Determine and document the implications of supporting:

- Intel macOS (`x86_64`);
- Apple Silicon macOS (`arm64`);
- Electron universal macOS builds.

Use authoritative Electron, Apple, Node.js, and upstream `imapsync` documentation where appropriate.

Do not assume that an Electron universal build automatically makes bundled native/runtime dependencies universal.

## Questions to resolve

Document explicit answers to:

1. Can the Electron application be built separately for:
   - `x86_64`;
   - `arm64`;
   - universal macOS?

2. What happens to the `imapsync` runtime for each architecture?

3. If using the Perl-script distribution:
   - does the bundled Perl runtime need to match the host architecture?
   - which Perl modules contain native components, if any?
   - would runtime dependencies need separate builds for x86_64 and arm64?

4. If using the available x86_64 standalone Darwin `imapsync` binary:
   - can it run on Apple Silicon through Rosetta 2?
   - is Rosetta 2 guaranteed to be present?
   - should the application depend on Rosetta 2?

5. Can a universal Electron `.app` contain architecture-specific runtime resources and select the correct runtime at startup?

6. Would separate x64 and arm64 application distributions be simpler or safer than one universal build?

7. What should happen when the application is running on an unsupported architecture or when the expected runtime is unavailable?

## Architecture matrix

Create a clear matrix covering at minimum:

| App architecture | Host architecture | imapsync runtime | Expected behavior |
| ---------------- | ----------------- | ---------------- | ----------------- |
| x86_64           | x86_64            | TBD              | TBD               |
| arm64            | arm64             | TBD              | TBD               |
| universal        | x86_64            | TBD              | TBD               |
| universal        | arm64             | TBD              | TBD               |

Include Rosetta-dependent scenarios separately if they remain viable.

## Decision

Choose the recommended distribution strategy for the first production release.

Prefer simplicity and reliability over minimizing artifact count.

The decision must state whether v1 should use:

- separate x86_64 and arm64 builds;
- one universal build;
- or another explicitly justified approach.

Also state whether the application should depend on Rosetta 2.

Do not leave the recommendation ambiguous.

## Documentation

Update:

- `docs/decisions.md`
- `docs/architecture.md`
- `docs/progress.md`

Add a new ADR dedicated to macOS architecture and runtime distribution.

Update `tasks/backlog.md` if TASK-008 or TASK-009 need clarification based on the result.

## Scope restrictions

Do not:

- build distributable `.dmg` / `.pkg` artifacts;
- bundle Perl yet;
- bundle `imapsync` yet;
- modify the migration UI;
- implement Windows or Linux support;
- introduce Rosetta installation logic;
- download architecture-specific binaries into the repository;
- change TASK-003 runtime behavior unless strictly required to correct a documented architectural flaw.

## Verification

Run:

`pnpm verify`

Documentation-only changes must not break existing verification.

## Acceptance criteria

- Intel (`x86_64`) and Apple Silicon (`arm64`) behavior is explicitly documented;
- Electron x64, arm64, and universal options are compared;
- `imapsync` runtime architecture implications are documented;
- Rosetta 2 implications are explicitly evaluated;
- the project has a clear v1 distribution recommendation;
- the ADR states whether Rosetta 2 is a dependency;
- TASK-008 / TASK-009 backlog descriptions are updated if needed;
- no production packaging has been implemented;
- `pnpm verify` succeeds.

## Status

Complete. Intel (`x86_64`) and Apple Silicon (`arm64`) behavior is documented in
`docs/architecture.md` with a matrix; Electron x64/arm64/universal are compared;
`imapsync` runtime architecture implications (native Perl/SSL components) are
documented; Rosetta 2 is explicitly evaluated and rejected; the v1
recommendation is separate x86_64/arm64 builds with no Rosetta dependency
(ADR-008); TASK-008/TASK-009 backlog descriptions are updated; no packaging was
implemented; `pnpm verify` succeeds.
