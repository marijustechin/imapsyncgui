# TASK-005 — Build migration form and validation UI

## Goal

Build the first real renderer UI for configuring a mailbox migration.

The user must be able to enter source and destination IMAP endpoint details, validate the form, test each connection independently, and prepare a migration request.

Do not implement migration progress or final result UI yet.

## Context

The project already has:

- a secure Electron main / preload / renderer boundary;
- a typed `ImapEndpoint` contract;
- runtime validation in the main process;
- a real `testConnection()` implementation;
- typed connection-test result codes;
- a `startMigration()` operation;
- a `cancelMigration()` operation;
- migration output streaming support;
- an `imapsync` runtime adapter.

This task is focused on the renderer form and user interaction around endpoint configuration.

## UI structure

Create one primary migration screen containing two clearly separated endpoint sections:

- Source server
- Destination server

Each endpoint section must contain:

- host;
- port;
- security mode;
- username;
- password.

Use the existing `SecurityMode` contract.

Do not invent provider-specific fields.

## Defaults

Use sensible IMAP defaults.

At minimum:

- TLS should default to port 993;
- STARTTLS should default to port 143;
- plaintext should default to port 143.

Changing the security mode may update the port only when doing so would not unexpectedly overwrite a clearly user-edited custom port.

Document the chosen behavior in code/tests.

## Password fields

Password inputs must:

- use password input type;
- not persist values;
- not log values;
- not expose credentials through debug output.

A show/hide password toggle is optional.

Do not add password-manager integration in this task.

## Client-side validation

Implement immediate renderer-side validation for obvious input errors.

At minimum validate:

- host is non-empty;
- port is an integer between 1 and 65535;
- username is non-empty;
- password is non-empty;
- security mode is valid.

Client-side validation exists for user experience only.

The main-process validation remains authoritative and must not be removed or bypassed.

Avoid duplicating validation logic in a way that creates inconsistent rules.

Prefer reusing shared validation concepts where practical without moving privileged logic into the renderer.

## Form behavior

The user must be able to edit source and destination independently.

The form must clearly represent:

- idle;
- editing;
- validating;
- connection test running;
- connection test success;
- connection test failure.

Do not introduce a global application state library.

Use local React state unless there is a concrete reason not to.

## Connection test controls

Each endpoint section must have its own connection-test action.

For example:

- `Test source connection`
- `Test destination connection`

The exact wording may be refined.

When a connection test is running:

- the relevant test button must be disabled;
- duplicate test requests for the same endpoint must be prevented;
- the other endpoint may remain independently testable unless there is a concrete technical reason not to allow it.

Use the existing:

`window.api.testConnection(endpoint)`

Do not bypass the preload API.

## Connection test results

Display clear user-facing feedback.

Success should clearly indicate that:

- connection succeeded;
- authentication succeeded.

Failure feedback must be derived from the typed failure codes.

Map application-level failure codes to concise user-facing messages.

At minimum handle:

- invalid input;
- DNS failure;
- connection failure;
- timeout;
- TLS failure;
- authentication failure;
- protocol failure;
- internal failure.

Do not display:

- stack traces;
- raw Node.js errors;
- raw socket errors;
- credentials;
- low-level debug dumps.

## Migration readiness

The form must determine whether the migration can be started.

The primary migration action must remain disabled until:

- source input is valid;
- destination input is valid;
- source connection test has succeeded for the current source values;
- destination connection test has succeeded for the current destination values.

If a tested endpoint value changes afterward, its previous successful test must become stale and migration readiness must be revoked.

This is important.

Do not allow a successful test for old credentials or host values to remain valid after editing.

## Start migration action

Add a primary action such as:

`Start migration`

When clicked:

- validate both endpoints again;
- ensure both successful connection tests still match the current values;
- call the existing `window.api.startMigration(...)`.

This task does not need to implement progress or completion UI.

After a successful start request, transition only to a minimal "migration started" state sufficient to prevent duplicate starts.

Do not build TASK-006 or TASK-007 functionality early.

## Start failure

If `startMigration()` immediately returns a typed failure, display a concise user-facing message.

Do not attempt to interpret streamed runtime output in this task.

## State model

Keep state explicit and understandable.

At minimum maintain:

- source endpoint values;
- destination endpoint values;
- validation state;
- connection-test state for each side;
- whether each successful test still corresponds to current values;
- migration-start state.

Avoid clever generic form abstractions if they make credential handling or stale-test invalidation harder to understand.

## Accessibility

Use semantic HTML.

At minimum:

- every input must have a visible label;
- form errors must be associated with the relevant field;
- buttons must have meaningful text;
- disabled/loading state must be perceivable;
- status messages must be accessible to assistive technology where practical.

Do not implement a full accessibility framework.

## Styling

Create a clean, functional desktop UI.

Use the project's existing styling approach.

Do not add:

- Tailwind;
- shadcn/ui;
- Material UI;
- Chakra;
- Bootstrap;
- another component framework.

Do not introduce a design system in this task.

Basic CSS is sufficient.

Prefer clarity over decoration.

## Dependency policy

Do not add a form library or schema library unless clearly justified.

The form is small enough that React state plus existing validation logic should be sufficient.

If a new dependency is introduced, document why it is necessary.

## Testing

Add renderer tests covering at minimum:

- form renders source and destination sections;
- default ports/security modes are correct;
- changing security mode updates the default port appropriately;
- custom port values are not unexpectedly overwritten;
- required field validation;
- invalid port validation;
- source test calls `testConnection()` with the correct endpoint;
- destination test calls `testConnection()` with the correct endpoint;
- test success is displayed;
- each typed test failure is mapped to appropriate user-facing feedback;
- connection test buttons show/disable during active tests;
- a successful connection test becomes stale when endpoint values change;
- migration action remains disabled until both current endpoint configurations have passed connection testing;
- migration action becomes enabled after both tests succeed;
- changing either tested endpoint disables migration again;
- `startMigration()` receives the current source/destination values;
- duplicate migration starts are prevented;
- credentials are never rendered in status/error output.

Mock the preload API.

Renderer tests must not perform real network access or execute `imapsync`.

## Documentation

Update:

- `docs/architecture.md`;
- `docs/testing.md`;
- `docs/progress.md`.

Update `docs/security.md` if renderer credential-handling behavior requires clarification.

Update `docs/decisions.md` only if a meaningful new architectural decision is introduced.

## Scope restrictions

Do not:

- implement migration progress UI;
- consume or render `migration:output`;
- implement detailed migration result UI;
- implement migration history;
- persist endpoint data;
- persist passwords;
- add saved server presets;
- add provider auto-detection;
- add Gmail/Microsoft-specific behavior;
- add OAuth;
- add automatic retries;
- add batch migrations;
- add theme switching;
- add global state management;
- add a UI framework;
- change `imapsync` packaging;
- weaken Electron sandboxing.

Do not implement TASK-006 or TASK-007 early.

## Verification

Run:

`pnpm verify`

All verification must remain deterministic and must not depend on external IMAP servers or a real `imapsync` installation.

## Acceptance criteria

- source and destination endpoint forms exist;
- all endpoint fields are editable;
- client-side validation provides immediate useful feedback;
- main-process validation remains authoritative;
- source and destination connection tests work independently;
- typed connection failures are mapped to user-facing messages;
- successful connection tests become stale when relevant values change;
- migration cannot start until both current endpoint configurations have successfully authenticated;
- `startMigration()` is called only with the current validated/tested endpoints;
- duplicate migration starts are prevented;
- credentials are not persisted or emitted in UI diagnostics;
- renderer uses only the narrow preload API;
- no migration progress or final result UI has been implemented;
- relevant documentation is updated;
- `pnpm verify` succeeds.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete`;
2. archive the full task as `tasks/done/TASK-005.md`;
3. append a concise entry to `docs/progress.md`;
4. remove TASK-005 from `tasks/backlog.md`;
5. update future backlog items only if this task reveals concrete follow-up work;
6. do not automatically start TASK-006.

## Status

Complete. Source and destination endpoint forms exist with all fields editable;
client-side validation gives immediate feedback while main-process validation
stays authoritative; connection tests run independently per side; typed
failures map to user-facing messages; successful tests become stale when values
change (revoking readiness); migration starts only after both current endpoints
authenticate; `startMigration()` receives current validated/tested values;
duplicate starts are prevented; credentials are neither persisted nor emitted;
the renderer uses only the narrow `window.api`; no migration progress/result UI
was built; documentation updated; `pnpm verify` succeeds.
