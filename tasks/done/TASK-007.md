# TASK-007 — Implement migration result and error UX

## Goal

Implement the final user-facing migration outcome experience.

After a migration reaches a terminal lifecycle state, the renderer must clearly distinguish:

- success;
- failure;
- cancellation.

The user must be able to understand what happened and return to the migration form to start another migration in the same application session.

Do not implement macOS runtime packaging or distributable application builds yet.

## Context

The project already has:

- source and destination endpoint forms;
- validation and connection testing;
- migration readiness gating;
- migration start/cancel support;
- incremental sanitized migration output;
- a bounded renderer output buffer;
- lifecycle events from the privileged runtime;
- renderer migration states including running/cancelling/finished;
- terminal lifecycle states emitted by the main process rather than inferred from log text.

TASK-006 intentionally stopped at a neutral finished state.

This task must turn terminal lifecycle events into a complete, safe, understandable result experience.

## Result states

Represent terminal migration outcomes explicitly.

At minimum distinguish:

- succeeded;
- failed;
- cancelled.

Do not collapse these into a generic "finished" state.

The renderer state model must preserve which terminal outcome occurred.

## Success UX

On successful migration:

- clearly show that migration completed successfully;
- show safe source and destination identities;
- preserve the migration output from the completed run;
- provide a primary action to return to the migration form and start another migration.

Do not show passwords.

Do not infer additional metrics from textual `imapsync` output.

Do not claim:

- number of migrated messages;
- transferred bytes;
- skipped messages;
- zero errors;

unless those values are explicitly provided by a typed runtime result.

For this task, a clear success result is sufficient.

## Failure UX

On migration failure:

- clearly show that migration failed;
- preserve the migration output;
- show a concise safe user-facing explanation;
- allow the user to return to the form and try again.

The user-facing failure must not expose:

- raw process errors;
- stack traces;
- executable paths;
- environment variables;
- passwords;
- arbitrary stderr dumps as the primary error message.

The detailed sanitized output panel may remain visible for diagnostic context.

## Failure result contract

Review the existing `MigrationLifecycleEvent` / runtime result contract.

If a failed lifecycle event currently carries insufficient structured information for useful UX, make the smallest narrow contract extension necessary.

Prefer stable application-level migration failure codes.

At minimum consider categories such as:

- runtime unavailable;
- runtime start failure;
- authentication / connection issue discovered during migration;
- process failure / non-zero exit;
- cancellation-related failure;
- internal error.

Do not create speculative categories that cannot currently be produced reliably.

If the runtime adapter cannot reliably classify a failure beyond a generic process failure, keep the contract honest rather than parsing arbitrary output.

Do not infer failure categories from free-form `imapsync` output unless there is an explicitly documented and deterministic upstream contract.

## Cancelled UX

On cancellation:

- clearly show that migration was cancelled;
- do not present cancellation as failure;
- preserve already received migration output;
- allow the user to return to the form.

The UI must not claim that all partially transferred data was rolled back.

Do not imply transactional rollback.

## Return-to-form behavior

Provide an explicit action such as:

`Start another migration`

or equivalent.

When used:

- remove active migration subscriptions if any remain;
- clear terminal migration state;
- clear previous migration output;
- clear previous cancellation errors/messages;
- return to the endpoint form.

Preserve source/destination field values in React memory if that improves usability.

However:

- previous successful connection tests must not automatically remain trusted after a completed migration;
- migration readiness must require fresh connection tests before a new migration starts.

This is important.

Do not persist values across application restart.

## Fresh-test requirement

Starting a new migration after a previous terminal result must require new successful connection tests for both endpoints.

The old test results belonged to the previous migration attempt.

Returning to the form must therefore invalidate prior connection-test success state.

Endpoint field values may remain populated, but test state must reset.

## Output handling

Completed migration output must remain visible on the result screen.

It must continue to obey the existing bounded output strategy.

Do not:

- persist output;
- add export functionality;
- write output to disk;
- add search/filtering;
- parse it into metrics.

The result screen may label the output as diagnostic details.

## Runtime unavailable behavior

If migration cannot start because the `imapsync` runtime is unavailable:

- show a clear safe message;
- do not expose raw executable paths unless explicitly useful for development-only diagnostics;
- do not tell non-technical users to install Homebrew in the production UX.

Development-specific setup belongs in README/documentation.

Production runtime availability will be solved in TASK-008/TASK-009.

If the current start result already represents this condition generically, do not over-engineer it.

## Lifecycle correctness

Terminal UI state must be driven only by typed lifecycle/runtime results.

Do not inspect log output for strings such as:

- success;
- failed;
- errors;
- done;
- completed.

Do not derive migration success from process text.

The privileged runtime remains authoritative.

## Repeated migration isolation

A second migration in the same application session must start cleanly.

Ensure:

- previous output is not shown in the new migration;
- previous terminal state is cleared;
- previous cancel state is cleared;
- old event listeners are not active;
- connection-test success state is fresh;
- no output from the old migration can appear in the new one.

## Security

Existing security rules remain mandatory.

Result UX must never render:

- passwords;
- complete credential-bearing endpoint objects;
- environment variables;
- raw process objects;
- stack traces.

Use safe endpoint identity only, such as:

`username@host`

Sanitized migration output may be shown.

Do not add application logging of sensitive runtime data.

## Accessibility

Terminal outcome must not rely only on color.

At minimum:

- result is expressed in text;
- result heading is semantic;
- diagnostic output remains accessible;
- retry/start-another-migration action has clear text;
- failure messages are associated with the result state.

## Styling

Continue using the existing renderer styling approach.

Do not introduce:

- Tailwind;
- shadcn/ui;
- component frameworks;
- icon libraries solely for this task;
- animation frameworks.

Simple visual distinction between success/failure/cancelled is enough.

## Testing

Add renderer/application tests covering at minimum:

- lifecycle `succeeded` renders success result;
- lifecycle `failed` renders failure result;
- lifecycle `cancelled` renders cancelled result;
- terminal state is not inferred from migration output text;
- source/destination safe identities are shown;
- passwords are never shown;
- completed migration output remains visible;
- output remains bounded;
- failure UX does not show raw stack traces/errors;
- cancellation is not labeled as failure;
- returning to the form clears previous output;
- returning to the form clears terminal state;
- returning to the form invalidates both previous successful connection tests;
- endpoint field values may remain populated;
- migration cannot immediately restart without fresh successful connection tests;
- repeated migration setup has no stale listeners;
- old migration output cannot contaminate a later migration;
- no direct IPC/Node.js capability is introduced.

If migration failure codes are added, test each supported code-to-message mapping.

Renderer tests must mock the preload API.

No automated test may:

- execute real `imapsync`;
- require a real IMAP server;
- require network access.

## Main/preload tests

If the migration lifecycle/result contract is extended:

- test runtime-to-IPC result mapping;
- test the preload surface remains narrow;
- test only explicitly supported result data reaches the renderer;
- ensure no raw Error object crosses IPC.

## Documentation

Update:

- `docs/architecture.md`;
- `docs/security.md`;
- `docs/testing.md`;
- `docs/progress.md`.

Update `docs/decisions.md` only if a meaningful architectural decision is introduced.

Update `tasks/backlog.md` only when concrete follow-up work is discovered.

## Scope restrictions

Do not:

- bundle `imapsync`;
- bundle Perl;
- build `.dmg` / `.pkg`;
- implement code signing or notarization;
- add migration history;
- persist migration results;
- add log export;
- implement semantic parsing of `imapsync` logs;
- add migration metrics;
- add automatic retry;
- add resume migration;
- add batch migrations;
- add saved credentials;
- add provider-specific behavior;
- add desktop notifications;
- add global state management;
- implement TASK-008 or TASK-009 early.

## Verification

Run:

`pnpm verify`

All verification must remain deterministic and must not depend on:

- external network access;
- real IMAP servers;
- a real `imapsync` installation.

## Acceptance criteria

- successful migration has a clear success result UX;
- failed migration has a clear failure result UX;
- cancelled migration has a distinct non-failure UX;
- terminal state is driven by typed lifecycle/runtime results only;
- completed output remains visible and bounded;
- safe endpoint identities are displayed without credentials;
- raw errors/stack traces do not reach the renderer;
- user can return to the migration form;
- previous migration output/state is cleared before another migration;
- previous successful connection tests are invalidated;
- a new migration requires fresh successful connection tests;
- repeated migrations do not accumulate stale listeners or output;
- no migration history or persistence is introduced;
- no packaging work is implemented;
- relevant documentation is updated;
- `pnpm verify` succeeds.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete`;
2. archive the full task as `tasks/done/TASK-007.md`;
3. append a concise entry to `docs/progress.md`;
4. remove TASK-007 from `tasks/backlog.md`;
5. update future backlog items only for concrete discovered work;
6. do not automatically start TASK-008.

## Status

Complete. Terminal outcomes are shown distinctly (success / failure /
cancelled) driven only by the typed `migration:lifecycle` event, extended to a
discriminated union carrying a concise failure message; safe `username@host`
identities are shown without credentials; raw errors/stack traces never reach
the renderer; completed output remains visible and bounded; the user can return
to the form via `Start another migration`, which clears state/output, invalidates
prior connection tests, and requires fresh tests; repeated migrations do not
accumulate stale listeners or output; no migration history/persistence or
packaging work was introduced; documentation updated; `pnpm verify` succeeds.
