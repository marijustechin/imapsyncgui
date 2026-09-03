# TASK-002 — Define migration domain model and secure IPC contract

Create the typed application contract required for IMAP connection testing and mailbox migration.

This task establishes the boundary between the renderer and privileged Electron code.

Do not execute `imapsync` yet.

## Goal

The renderer must be able to interact with a narrowly scoped, typed preload API without gaining access to generic Electron or Node.js capabilities.

Define the data structures and IPC contract that later tasks will implement.

## Domain model

Define types for an IMAP endpoint.

An endpoint must contain:

- host;
- port;
- security mode;
- username;
- password.

Security mode must be represented as an explicit finite type rather than arbitrary strings.

Define migration input containing:

- source endpoint;
- destination endpoint.

Define typed result structures for:

- connection test;
- migration start;
- migration cancellation.

Do not introduce persistence.

## Security requirements

Credentials are transient sensitive data.

The implementation must ensure that:

- passwords are never logged;
- passwords are never persisted;
- passwords are never included in error messages;
- passwords are never interpolated into command strings;
- generic `ipcRenderer`, `ipcMain`, Electron, or Node.js APIs are not exposed to the renderer.

Do not create generic IPC helpers that allow the renderer to invoke arbitrary channels.

Every renderer-accessible operation must be explicitly defined.

## Preload API

Replace the empty preload surface with a typed API shaped around application operations.

The public renderer API must expose only:

- `testConnection(...)`
- `startMigration(...)`
- `cancelMigration(...)`

The exact type signatures may be refined during implementation, but all operations must use explicit request and response types.

No implementation of actual IMAP communication or `imapsync` execution is required in this task.

Handlers may return explicit typed "not implemented" results where necessary.

## Shared types

Place shared contract types somewhere that can be safely imported by:

- main;
- preload;
- renderer.

The shared module must not depend on Electron, Node.js, React, or browser-specific APIs.

If introducing a workspace package is justified, document the architectural decision.

Do not create a package merely for hypothetical future reuse.

## Validation

Define runtime validation at the privileged boundary.

At minimum validate:

- host is non-empty;
- port is an integer between 1 and 65535;
- username is non-empty;
- password is non-empty;
- security mode is one of the supported values.

Do not rely only on TypeScript types for data received over IPC.

Choose the smallest appropriate validation approach.

If adding a dependency, document why it is needed.

## Testing

Add tests covering:

- valid endpoint input;
- invalid ports;
- empty host;
- empty username;
- empty password;
- invalid security mode;
- renderer API exposes only the expected operations;
- arbitrary IPC channel access is impossible through the preload API.

Security-related tests are required.

## Documentation

Update:

- `docs/architecture.md`
- `docs/security.md`
- `docs/testing.md`

Update `docs/decisions.md` only if a meaningful architectural decision is introduced.

## Scope restrictions

Do not:

- execute `imapsync`;
- spawn child processes;
- test real IMAP connections;
- build the migration UI;
- persist credentials;
- add migration history;
- implement logging infrastructure;
- add state-management libraries;
- add styling frameworks.

These belong to later tasks.

## Verification

Run:

`pnpm verify`

All checks must pass.

## Acceptance criteria

- shared migration contract exists;
- endpoint input has runtime validation;
- preload exposes only the three required operations;
- renderer has no generic IPC access;
- credentials are not logged or persisted;
- tests verify validation and IPC boundary behavior;
- no real IMAP or `imapsync` execution exists;
- `pnpm verify` succeeds.

## Status

Complete.
