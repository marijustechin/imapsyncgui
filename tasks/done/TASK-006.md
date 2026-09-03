# TASK-006 — Stream migration progress to renderer

## Goal

Implement the renderer experience for an actively running mailbox migration.

After `startMigration()` succeeds, the user must be able to see sanitized migration output arriving incrementally and must be able to cancel the running migration.

Do not implement the final migration success/failure result experience yet.

## Context

The project already has:

- source and destination endpoint forms;
- client-side validation;
- independent connection testing;
- migration-readiness gating;
- `startMigration()` wired to the privileged `imapsync` adapter;
- `cancelMigration()`;
- sanitized migration output emitted from the main process;
- a narrow preload subscription API for migration output;
- runtime lifecycle handling in `MigrationAdapter`.

TASK-005 intentionally stopped after a minimal "migration started" state.

This task must consume the existing streaming output safely in the renderer.

## Migration view

When a migration starts successfully, transition the renderer into an active migration state.

The active migration view must clearly show:

- that migration is running;
- source mailbox identity;
- destination mailbox identity;
- incremental migration output;
- a cancel action.

Do not display passwords.

Do not expose the complete endpoint objects if doing so risks rendering credentials.

Use only safe identifying information such as username and host.

## Output subscription

Use the existing narrow preload subscription API.

Do not:

- access `ipcRenderer` directly;
- expose new generic IPC functionality;
- poll the main process;
- read process stdout directly from the renderer.

Subscribe when the active migration view needs output.

Unsubscribe when:

- the migration view is unmounted;
- the migration is no longer active;
- the application component is disposed.

The renderer must not accumulate duplicate listeners across repeated migrations.

## Streaming behavior

Migration output must be displayed incrementally as it arrives.

Requirements:

- preserve event ordering;
- append new output without replacing previous output;
- handle stdout and stderr output uniformly unless the existing contract explicitly distinguishes them;
- do not parse the full `imapsync` protocol/log format in this task.

The main process remains responsible for sanitizing process output before it reaches the renderer.

The renderer must nevertheless avoid introducing credentials into derived status messages.

## Output buffer

Do not allow renderer memory usage to grow without bound during very large migrations.

Introduce a simple bounded output buffer.

Choose and document a reasonable deterministic limit based on:

- maximum number of lines;
- maximum text size;
- or another simple bounded strategy.

When the limit is exceeded, discard the oldest output.

Do not implement persistent log files in this task.

Do not persist migration output anywhere.

## Output presentation

Use a simple log/progress panel.

It should:

- be readable;
- preserve whitespace where useful;
- support long lines without destroying layout;
- allow scrolling;
- automatically keep the newest output visible when the user has not intentionally scrolled away.

A sophisticated terminal emulator is not required.

Do not add a terminal/ANSI rendering dependency.

Plain sanitized text is sufficient.

## Automatic scrolling

Implement sensible log auto-scroll behavior.

Preferred behavior:

- while the user remains near the bottom, new output keeps the view at the newest content;
- if the user scrolls significantly upward to inspect earlier output, new events must not forcibly yank the view back to the bottom;
- returning near the bottom resumes automatic scrolling.

If this behavior adds disproportionate complexity, a simpler always-scroll-to-bottom implementation is acceptable only if explicitly documented and tested.

## Migration state

Model the renderer migration state explicitly.

At minimum distinguish:

- idle;
- starting;
- running;
- cancelling.

TASK-007 will handle terminal states in detail.

Do not infer migration completion by parsing log text.

Do not search for strings such as:

- `Migration successful`;
- `Done`;
- `Error`;
- or similar output.

Runtime/process lifecycle must remain authoritative.

## Completion boundary

If the current IPC/preload contract does not yet expose migration lifecycle completion to the renderer, make the smallest narrow contract extension necessary.

A lifecycle event may report that the process reached a terminal state, but TASK-006 must not build detailed result/error UX.

For this task, terminal completion may transition to a simple neutral state such as:

- "Migration finished";
- "Migration stopped";
- "Migration ended";

Detailed success/failure explanations belong to TASK-007.

Do not derive lifecycle state from output text.

## Cancellation

Provide a visible `Cancel migration` action while migration is running.

When clicked:

1. transition immediately to `cancelling`;
2. prevent duplicate cancel requests;
3. call `window.api.cancelMigration()`;
4. keep the existing output visible;
5. continue accepting output events until the privileged runtime actually terminates.

The cancel button must be disabled while cancellation is already in progress.

Do not assume that process termination is instantaneous.

## Cancel failure

If `cancelMigration()` immediately reports that cancellation could not be requested:

- return to an appropriate running state if the process is still active;
- show a concise safe message;
- allow retry when appropriate.

Do not display raw internal errors.

## Form interaction

While a migration is active:

- source and destination endpoint editing must not be possible;
- another migration must not be startable;
- connection-test controls must not be usable.

The simplest acceptable implementation is to replace the form with the active migration view.

Do not persist form state specifically for application restart.

Keeping the values in React memory during the current application session is acceptable.

## Repeated migration safety

The architecture must support a later migration in the same application session without:

- duplicate output listeners;
- output from the previous migration appearing in the new migration;
- stale cancellation state;
- stale lifecycle state.

TASK-007 may add a proper "start another migration" flow later.

Tests must at least prove subscription cleanup and output-state isolation.

## Security

Existing credential protections remain mandatory.

Migration output shown by the renderer must:

- come only through the sanitized preload channel;
- never contain passwords;
- never be persisted;
- never be copied into debugging logs by application code.

Do not call `console.log()` with:

- endpoint objects;
- migration input;
- output payloads that may contain server-generated sensitive information.

Do not introduce analytics or telemetry.

## Accessibility

The active migration state must be understandable without relying solely on color.

At minimum:

- migration status is represented in text;
- cancel button has meaningful text;
- streamed output region has an accessible label;
- status changes are exposed accessibly where practical.

Do not over-engineer an accessibility framework.

## Styling

Continue using the existing renderer styling approach.

Do not add:

- Tailwind;
- shadcn/ui;
- terminal libraries;
- ANSI renderer libraries;
- component frameworks;
- animation libraries.

Keep the interface functional and clear.

## Testing

Add renderer/application tests covering at minimum:

- successful `startMigration()` transitions to the active migration view;
- migration output events append incrementally;
- event ordering is preserved;
- output buffer is bounded;
- oldest output is discarded when the limit is exceeded;
- credentials do not appear in application-generated progress/status UI;
- output subscription is registered exactly once for an active migration;
- subscription is removed on cleanup;
- repeated migration setup does not accumulate listeners;
- output from an old subscription does not contaminate a new migration;
- cancel button calls `cancelMigration()`;
- duplicate cancel clicks are prevented;
- UI enters a cancelling state;
- cancellation does not immediately erase existing output;
- immediate cancellation failure is handled safely;
- form controls cannot be used while migration is active;
- no direct generic IPC or Node.js access is introduced.

If a lifecycle event is added, test:

- running → terminal transition;
- terminal state is driven by the lifecycle event, not by output text.

Renderer tests must mock the preload API.

No test may execute real `imapsync` or require network access.

## Main/preload tests

If the IPC contract is extended for lifecycle notifications, add tests proving:

- only the specific lifecycle subscription is exposed;
- no raw `ipcRenderer` leaks through preload;
- lifecycle payload is typed and runtime-safe where appropriate;
- listener cleanup works.

Do not add a generic event-subscription API.

## Documentation

Update:

- `docs/architecture.md`;
- `docs/security.md`;
- `docs/testing.md`;
- `docs/progress.md`.

Update `docs/decisions.md` only if a meaningful architectural decision is introduced.

Document the output-buffer strategy.

Update `tasks/backlog.md` only for concrete follow-up work discovered during implementation.

## Scope restrictions

Do not:

- implement detailed final success UX;
- implement detailed final failure UX;
- parse `imapsync` output into semantic progress percentages;
- calculate mailbox/message percentages;
- persist logs;
- add log export;
- add migration history;
- add retry;
- add automatic restart;
- add batch migrations;
- add desktop notifications;
- add provider-specific behavior;
- add global state management;
- add a terminal emulator;
- modify `imapsync` packaging;
- implement TASK-007 early.

Do not infer process success/failure from textual output.

## Verification

Run:

`pnpm verify`

All verification must remain deterministic and must not require:

- network access;
- real IMAP servers;
- a real `imapsync` installation.

## Acceptance criteria

- successful migration start transitions to a running migration view;
- sanitized migration output is displayed incrementally;
- output ordering is preserved;
- renderer output buffering is bounded;
- output is not persisted;
- output subscription is cleaned up correctly;
- repeated migrations cannot accumulate stale listeners;
- cancellation can be requested from the UI;
- duplicate cancellation requests are prevented;
- cancellation keeps existing output visible;
- form interaction is unavailable during active migration;
- lifecycle state is not inferred from log text;
- any new lifecycle IPC surface is narrow and typed;
- credentials are not introduced into renderer output or diagnostics;
- no detailed final migration-result UX has been implemented;
- relevant documentation is updated;
- `pnpm verify` succeeds.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete`;
2. archive the full task as `tasks/done/TASK-006.md`;
3. append a concise entry to `docs/progress.md`;
4. remove TASK-006 from `tasks/backlog.md`;
5. update future backlog items only for concrete discovered work;
6. do not automatically start TASK-007.

## Status

Complete. A successful start transitions to the running migration view showing
source/destination identities, incremental sanitized output, and a cancel
action; output ordering is preserved and buffering is bounded (100,000 chars,
oldest discarded); output is never persisted; output/lifecycle subscriptions are
registered once and cleaned up on termination/unmount; cancellation is
requestable with duplicate-cancel prevention and keeps existing output visible;
form interaction is replaced while active; terminal state is driven by the typed
`migration:lifecycle` event, never by log text; the new IPC surface is narrow
and typed; credentials never enter renderer output/diagnostics; no detailed
result UX was built; documentation updated; `pnpm verify` succeeds.
