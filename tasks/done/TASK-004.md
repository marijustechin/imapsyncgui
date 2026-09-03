# TASK-004 — Implement real IMAP connection testing

## Goal

Implement real IMAP connection testing for source and destination endpoints.

This task must replace the placeholder `testConnection()` behavior with a real privileged connectivity/authentication check.

Do not build the migration form UI yet.

## Context

The project already has:

- a secure Electron main / preload / renderer boundary;
- a typed `ImapEndpoint` contract;
- runtime validation at the IPC boundary;
- a narrow `testConnection()` preload operation;
- an `imapsync` runtime adapter;
- a documented macOS runtime strategy.

The renderer must continue to communicate only through the existing narrow application API.

## Research and design requirement

Before implementing connection testing, determine the most appropriate mechanism for this application.

Evaluate at minimum:

1. testing the endpoint through `imapsync`;
2. using a dedicated IMAP protocol implementation/library;
3. implementing only the minimal protocol interaction required for:
   - TCP connection;
   - TLS negotiation where applicable;
   - IMAP authentication.

Prefer the smallest reliable solution.

The chosen mechanism must be documented in `docs/decisions.md` if it introduces a meaningful dependency or architectural decision.

Do not choose a library only because it makes implementation shorter.

Consider:

- dependency size;
- maintenance state;
- security;
- TLS support;
- authentication support;
- timeout behavior;
- cancellation/cleanup;
- credential handling;
- future reuse.

## Connection test behavior

`testConnection(endpoint)` must perform a real test against the supplied IMAP endpoint.

A successful result means that the application has:

1. established a connection to the configured host and port;
2. completed the required TLS negotiation;
3. authenticated successfully with the supplied username and password.

A simple TCP socket connection is not sufficient.

## Supported security modes

Use the security modes already defined by the shared contract.

The implementation must clearly define the behavior of each supported mode.

At minimum distinguish between:

- implicit TLS;
- plaintext connection upgraded with STARTTLS, if supported by the current contract;
- plaintext connection only, if the current product explicitly supports it.

Do not silently reinterpret the existing contract.

If the current contract is insufficient or ambiguous, make the smallest necessary contract change and document it.

## Authentication

Use the endpoint username and password only for the active connection attempt.

Credentials must:

- remain transient;
- never be persisted;
- never be logged;
- never appear in returned error messages;
- never appear in renderer diagnostics;
- never be included in generic telemetry or debugging output.

Do not weaken ADR-007 or existing credential security rules.

## Result contract

Return a typed result that clearly distinguishes success from failure.

Failure results must allow the UI to eventually present meaningful messages without exposing sensitive low-level details.

Define stable application-level failure categories.

At minimum distinguish:

- invalid input;
- DNS / host resolution failure;
- connection refused / unreachable host;
- timeout;
- TLS failure;
- authentication failure;
- server/protocol failure;
- unexpected internal failure.

Exact naming is up to the implementation.

Do not expose raw Node.js errors directly to the renderer.

## Error mapping

Create a dedicated error mapping layer.

Low-level errors must be translated into stable application-level result codes.

Error messages must:

- be useful;
- avoid credentials;
- avoid dumping complete low-level objects;
- avoid exposing arbitrary stack traces to the renderer.

Tests must prove that passwords are never present in returned messages.

## Timeout

Connection testing must have a finite timeout.

The application must not wait indefinitely for:

- DNS resolution;
- TCP connection;
- TLS negotiation;
- server greeting;
- authentication response.

Choose and document a reasonable default timeout.

The timeout mechanism must clean up the underlying connection.

Do not introduce configurable timeout UI in this task.

## Resource cleanup

Every test attempt must clean up its resources.

Ensure cleanup on:

- success;
- authentication failure;
- TLS failure;
- timeout;
- connection error;
- unexpected exception.

No socket or protocol client should remain alive after the operation completes.

## Concurrency

Testing source and destination endpoints sequentially or concurrently is an implementation detail.

However, each `testConnection()` invocation must be isolated.

One failed or timed-out test must not corrupt future attempts.

Do not introduce a global connection singleton.

## IPC integration

Replace the existing placeholder `testConnection` IPC handler with the real implementation.

The renderer must continue to call:

`window.api.testConnection(...)`

Do not expose:

- sockets;
- TLS objects;
- raw protocol clients;
- filesystem APIs;
- Node.js APIs;
- arbitrary IPC channels.

Keep all networking inside privileged main-process code.

## Dependency injection and testability

The connection-testing implementation must be testable without requiring real external IMAP servers.

External network access must not be required by `pnpm verify`.

Use dependency injection or a similarly lightweight boundary so tests can simulate:

- successful connection and authentication;
- DNS failure;
- connection refusal;
- timeout;
- TLS failure;
- authentication failure;
- malformed/unexpected server behavior;
- cleanup after failure.

Avoid introducing a heavyweight dependency injection framework.

## Optional integration test

You may add a manually runnable integration test against a real IMAP server if useful.

It must:

- not run as part of `pnpm verify`;
- not contain committed credentials;
- use environment variables for credentials;
- be clearly documented as optional.

Do not require real account credentials for automated verification.

## Tests

Add automated tests covering at minimum:

- successful connection;
- successful authentication;
- invalid input remains rejected before network access;
- DNS failure mapping;
- connection-refused/unreachable mapping;
- timeout behavior;
- TLS failure mapping;
- authentication failure mapping;
- server/protocol failure mapping;
- unexpected error mapping;
- resource cleanup after success;
- resource cleanup after failure;
- repeated independent connection tests;
- credential values never appear in returned results or application logs;
- renderer still has no generic networking or Node.js access.

If a third-party library is used, do not merely test the library itself.

Test the application-level behavior and error mapping.

## Documentation

Update:

- `docs/architecture.md`;
- `docs/security.md`;
- `docs/testing.md`;
- `docs/progress.md`.

Update `docs/decisions.md` if the task introduces:

- a new IMAP library;
- a meaningful protocol strategy;
- a new dependency;
- a significant TLS/authentication decision.

Update README only if developer setup or manually runnable integration testing changes.

## Scope restrictions

Do not:

- build the migration form UI;
- add server presets;
- persist endpoints;
- persist passwords;
- add OAuth;
- implement Gmail/Microsoft provider-specific flows;
- implement migration progress UI;
- implement migration results UI;
- modify `imapsync` packaging;
- implement batch mailbox testing;
- add retry loops;
- add automatic server discovery;
- add global state-management libraries;
- weaken Electron sandboxing.

Do not implement features merely because the selected IMAP library supports them.

## Verification

Run:

`pnpm verify`

All verification must remain deterministic and must not depend on external network access.

## Acceptance criteria

- `testConnection()` performs a real IMAP connection and authentication attempt;
- connection testing runs only in privileged main-process code;
- TLS behavior matches the shared security-mode contract;
- connection attempts have a finite timeout;
- resources are cleaned up on every completion path;
- low-level failures are mapped to stable typed application-level results;
- authentication failures can be distinguished from network/TLS failures;
- credentials are never persisted, logged, or exposed in returned errors;
- automated tests do not require real IMAP servers;
- IPC remains narrow;
- no migration UI has been implemented;
- relevant documentation is updated;
- `pnpm verify` succeeds.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete`;
2. archive the full task as `tasks/done/TASK-004.md`;
3. append a concise entry to `docs/progress.md`;
4. remove TASK-004 from `tasks/backlog.md`;
5. update future backlog items only if this task reveals concrete follow-up work;
6. do not automatically start TASK-005.

## Status

Complete. `testConnection()` performs a real IMAP connect + TLS + `LOGIN`
entirely in the main process (`src/main/imap/`); TLS behavior matches the
`none`/`tls`/`starttls` contract; attempts have a 10s timeout and clean up the
connection on every path; low-level failures are mapped to stable typed codes
(`dns`, `connection`, `timeout`, `tls`, `authentication`, `protocol`,
`internal`, `invalid-input`); credentials are never persisted, logged, or
returned; automated tests use an injected socket layer (no real IMAP servers);
IPC stays narrow; no migration UI was built; documentation updated (ADR-009);
`pnpm verify` succeeds.
