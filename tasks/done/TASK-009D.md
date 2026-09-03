# TASK-009D — Pre-release correctness and security fixes

## Goal

Fix the known pre-release correctness and security issues identified by independent review before signing, notarization, and clean-machine end-to-end verification.

This task is intentionally narrow.

It must address:

1. IMAP STARTTLS protocol correctness;
2. migration lifecycle subscription race;
3. explicit `imapsync` persistent-log policy.

Do not add unrelated features.

## Context

The project now has proven native packaged runtimes for:

- macOS x86_64;
- macOS arm64.

Both architecture-specific packaged application flows are verified.

Before proceeding to release-hardening tasks, an independent review identified several correctness/security risks that are not reliably caught by the current test suite.

These must be resolved before TASK-010.

---

## Part 1 — Correct IMAP STARTTLS flow

### Problem

Review the current STARTTLS connection-test implementation.

The existing flow may incorrectly expect a second IMAP server greeting after the TLS upgrade.

A standards-compliant STARTTLS flow must not rely on receiving a new greeting after TLS negotiation.

### Research requirement

Verify the expected IMAP STARTTLS behavior against the relevant RFC(s), including RFC 2595 and any applicable current IMAP requirements.

Document the protocol sequence actually implemented.

Do not rely on existing test fixtures as proof of protocol correctness.

### Required behavior

For STARTTLS mode, the connection test must follow a standards-compliant sequence conceptually equivalent to:

1. open plaintext TCP connection;
2. receive initial IMAP greeting;
3. issue `STARTTLS`;
4. receive successful tagged response;
5. upgrade the existing socket to TLS;
6. continue the IMAP session without waiting for a second server greeting;
7. issue `CAPABILITY` after the TLS upgrade where required/recommended by the protocol;
8. authenticate using `LOGIN`.

Do not send credentials before TLS negotiation completes.

### CAPABILITY

If the implementation uses CAPABILITY:

- parse only what is necessary;
- do not build a general IMAP parser;
- do not add provider-specific behavior.

If the server does not support STARTTLS when STARTTLS mode is requested, return a stable protocol/TLS-related failure.

### Error handling

Preserve the existing stable application-level error model.

STARTTLS failures must not expose:

- passwords;
- raw socket objects;
- stack traces;
- raw protocol buffers.

### Tests

Update/add tests covering at minimum:

- initial greeting received once;
- STARTTLS tagged success;
- TLS upgrade;
- no second greeting expected after TLS upgrade;
- post-upgrade CAPABILITY flow;
- LOGIN occurs only after TLS is active;
- STARTTLS rejection;
- malformed STARTTLS response;
- TLS upgrade failure;
- timeout during STARTTLS;
- credential-safe errors.

The old incorrect second-greeting fixture must be removed or corrected.

---

## Part 2 — Eliminate migration lifecycle subscription race

### Problem

Review the renderer migration-start flow.

A race may exist if output/lifecycle listeners are registered only after `startMigration()` resolves and the renderer transitions into the running state.

A fast child process may terminate before the lifecycle subscription is active, leaving the renderer stuck in a running state.

### Required guarantee

The renderer must not be able to miss the authoritative terminal lifecycle event for a migration it started.

Fix this architecturally.

### Acceptable strategies

Prefer the smallest robust solution.

Examples include:

- register output/lifecycle listeners before invoking `startMigration()`;
- or introduce migration identifiers plus retained/replayable authoritative main-process state;
- or another narrowly scoped approach that guarantees no terminal-event loss.

Do not add a global event bus or generic IPC subscription system.

### Preferred simplicity

If pre-subscribing before start is sufficient and reliable with the existing single-migration model, prefer it.

Do not introduce migration IDs unless they are genuinely needed.

### Listener lifecycle

Ensure:

- listeners are registered before the process can emit lifecycle completion;
- no duplicate listeners accumulate;
- failed `startMigration()` calls clean up listeners;
- successful terminal completion cleans up listeners;
- cancellation still works;
- repeated migrations remain isolated.

### Tests

Add a deterministic regression test that simulates a migration which:

1. starts;
2. emits terminal lifecycle immediately;
3. completes before React would otherwise render the running view.

The renderer must still reach the correct terminal result.

Also test:

- immediate start failure cleanup;
- listener cleanup after terminal result;
- no stale listeners on second migration;
- output events remain ordered;
- cancellation behavior remains intact.

---

## Part 3 — Explicit imapsync log policy

### Problem

`imapsync` can create persistent runtime files such as:

- `LOG_imapsync/`;
- `W/`;
- temporary/cache/test files.

These directories have already appeared in the development workspace.

Ignoring them in Git is not sufficient.

The production application must define an explicit logging policy.

### Goal

Prevent unintended persistent `imapsync` logs containing mailbox/server/runtime information from being written to uncontrolled locations.

### Research requirement

Review current `imapsync` options for controlling:

- log creation;
- log directories;
- temporary/cache/work directories.

Use upstream documentation.

### Production policy

Choose and document one explicit v1 policy.

Preferred policy:

- disable persistent `imapsync` logging where supported;
- stream only sanitized stdout/stderr through the existing renderer path.

If `imapsync` requires temporary/work directories:

- create/use a controlled application temporary location;
- do not use the repository working directory;
- do not use arbitrary current working directory;
- clean up when safe and appropriate.

Do not persist migration logs by default.

### Process working directory

Set an explicit controlled `cwd` for the spawned production process if needed.

Do not inherit an arbitrary application launch directory.

The chosen directory must not contain credentials in its name/path.

### Runtime arguments

Add only explicitly supported log-control arguments.

Do not expose log flags to renderer/user input.

Keep the existing argument allowlist model.

### Security

Ensure:

- passwords remain out of argv;
- persistent logs are disabled or controlled;
- app-generated logs do not contain credentials;
- runtime output reaching renderer remains sanitized;
- temp/work paths are not exposed in normal UI errors.

### Cleanup

If controlled temporary directories are created:

- clean them up after migration where safe;
- tolerate cleanup failure without crashing;
- do not delete unrelated directories;
- do not follow arbitrary renderer-provided paths.

### Tests

Add tests covering at minimum:

- production invocation includes the chosen explicit log policy;
- no uncontrolled `LOG_imapsync` path is used;
- no uncontrolled `W` path is used;
- process `cwd` is deterministic if introduced;
- renderer cannot influence log/temp paths;
- credentials remain absent from argv;
- cleanup targets only app-owned paths;
- failure messages do not expose internal temp paths.

---

## Regression protection

All previously proven guarantees must remain intact.

Preserve:

- shell-free `spawn()`;
- narrow preload IPC;
- credential handling through ADR-007;
- x86_64 packaged runtime behavior;
- arm64 packaged runtime behavior;
- packaged runtime isolation;
- deterministic architecture resolution;
- connection-test failure mapping;
- migration output sanitization;
- bounded renderer output;
- cancellation behavior.

Do not regress either architecture-specific packaging strategy.

---

## Native/package verification

This task should not require rebuilding both architecture runtimes unless implementation touches runtime packaging.

However, if invocation arguments, cwd, environment, or runtime adapter behavior changes, run the strongest relevant packaged smoke verification available.

At minimum:

- `pnpm verify`;
- x86_64 packaged/runtime smoke verification locally where practical;
- arm64 deterministic tests locally.

If the change materially affects packaged runtime invocation, also push and run the existing native arm64 CI workflow.

Do not claim arm64 packaged verification for changed runtime behavior unless CI actually reruns successfully.

---

## Documentation

Update:

- `docs/architecture.md`;
- `docs/security.md`;
- `docs/testing.md`;
- `docs/decisions.md` if a meaningful architectural decision is introduced;
- `docs/progress.md`;
- `docs/runtime.md` if runtime cwd/log behavior changes;
- README only if developer/release behavior changes.

Document explicitly:

- correct STARTTLS sequence;
- lifecycle-listener race resolution;
- final `imapsync` log/temp policy.

---

## Scope restrictions

Do not:

- add OAuth;
- add provider-specific IMAP handling;
- create a full IMAP protocol library;
- add migration history;
- add user-facing log export;
- persist logs;
- add global state management;
- redesign the renderer;
- change architecture-specific runtime strategy;
- implement signing/notarization;
- start TASK-010;
- add unrelated refactors.

---

## Verification

Run:

`pnpm verify`

It must remain green.

If packaged runtime invocation changed, run relevant packaged smoke verification.

If arm64 runtime behavior is affected, push and confirm the native arm64 GitHub Actions workflow passes again.

---

## Acceptance criteria

TASK-009D is complete only when:

- STARTTLS connection testing follows the correct protocol sequence;
- no second greeting is expected after TLS upgrade;
- post-upgrade CAPABILITY/authentication behavior is correct;
- STARTTLS regression tests exist;
- migration lifecycle terminal events cannot be lost due to subscription timing;
- a deterministic regression test proves immediate completion is handled;
- listener cleanup remains correct;
- `imapsync` persistent logging behavior is explicit;
- uncontrolled `LOG_imapsync/` and `W/` output is prevented in production;
- process cwd/temp behavior is controlled where necessary;
- credentials remain protected;
- x86_64 and arm64 runtime assumptions remain valid;
- relevant packaged smoke tests pass if invocation behavior changed;
- documentation is updated;
- `pnpm verify` succeeds.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete`;
2. archive the task as `tasks/done/TASK-009D.md`;
3. append the result to `docs/progress.md`;
4. update the backlog only with concrete remaining blockers;
5. do not automatically start signing/notarization or TASK-010.

## Status

Complete.

All three parts are resolved and verified:

1. **STARTTLS correctness** — the connection test now follows the
   standards-compliant sequence (greeting → STARTTLS → TLS upgrade with no
   second greeting → CAPABILITY → LOGIN), with regression tests for rejection,
   malformed response, upgrade failure, timeout, and credential-safe errors.
2. **Lifecycle subscription race** — output/lifecycle listeners are registered
   before `startMigration()`, the terminal handler accepts `starting`/`running`/
   `cancelling`, and a deterministic regression test proves an
   immediately-terminating migration still reaches the correct terminal result.
   Listeners are cleaned up on terminal completion, start failure, and unmount.
3. **imapsync log policy** — production invocation adds `--nolog`, `--tmpdir
   <cwd>`, and a controlled `cwd` (OS temporary directory), preventing
   `LOG_imapsync/` and `W/` from being written into the app/working directory;
   log/temp paths are never derived from renderer input.

`pnpm verify` passes (183 tests).
