# TASK-010 — Clean-machine end-to-end verification

## Goal

Verify the complete macOS user workflow on a clean compatible system using the actual packaged application artifacts.

This task validates the product as a user would experience it.

Signing and notarization are explicitly out of scope for this task.

Unsigned Gatekeeper behavior must be documented honestly and treated as an expected distribution limitation, not as an application failure.

## Context

The project now has:

- complete renderer migration workflow;
- correct IMAP STARTTLS behavior;
- real IMAP connection testing;
- migration start / streaming / cancellation / result UX;
- lifecycle race protection;
- explicit `imapsync --nolog` policy;
- controlled temp/work directory behavior;
- proven self-contained x86_64 runtime;
- proven self-contained arm64 runtime;
- architecture-specific packaged applications;
- native arm64 CI verification;
- packaged runtime smoke tests;
- no end-user Homebrew/system Perl dependency.

Remaining known release limitation:

- application artifacts are unsigned and not notarized because no Apple Developer Program credentials are currently available.

## Definition of clean machine

A clean-machine verification environment must not depend on the development repository or development runtime.

The target system must not require:

- Node.js;
- pnpm;
- Homebrew;
- MacPorts;
- Perl installation;
- `imapsync` installation;
- repository source files;
- developer build output outside the packaged application.

Testing on a normal user account is preferred.

Do not configure the machine to imitate the developer workstation.

## Architectures

Verify at least every architecture currently claimed as supported.

### x86_64

Test the Intel artifact on a compatible Intel macOS system.

### arm64

Test the Apple Silicon artifact on a compatible native Apple Silicon macOS system.

Do not use Rosetta as proof of arm64 support.

If clean physical hardware is unavailable for one architecture, use the strongest realistic native environment available and document the limitation precisely.

Do not claim a clean-machine test occurred when only CI packaging/runtime smoke tests were performed.

## Test artifact

Use the actual produced distribution artifact.

Do not:

- run `pnpm dev`;
- launch the unpackaged app;
- substitute staging runtime files;
- modify the `.app` contents after packaging;
- install runtime dependencies manually.

Record:

- application version;
- artifact filename;
- architecture;
- commit/release identifier;
- artifact SHA-256 where practical.

## Download / transfer simulation

Test the artifact through a realistic user-distribution path where possible.

For example:

- download from GitHub Actions artifact/release;
- transfer the `.zip` / selected distribution archive to the clean machine;
- extract normally.

Avoid testing only the exact local build directory copy if that bypasses quarantine/Gatekeeper behavior.

## Gatekeeper / unsigned behavior

The application is currently unsigned and not notarized.

Document exactly what macOS does on first launch.

Expected possibilities include:

- normal launch blocked;
- warning about unidentified/unverified developer;
- requirement to use macOS Privacy & Security / Open Anyway;
- context-menu Open behavior depending on macOS version.

Do not:

- disable Gatekeeper globally;
- run undocumented `xattr` removal as the normal user workflow;
- tell users to disable macOS security;
- describe the unsigned warning as a virus detection;
- mark expected unsigned Gatekeeper behavior as an application defect.

Document the minimum normal macOS user action required to launch the application.

## Application startup

After the user completes any expected unsigned-app approval flow:

Verify:

- application launches;
- renderer loads correctly;
- no terminal is required;
- no missing runtime error appears;
- no Homebrew/system Perl prompt appears;
- no crash occurs.

## Runtime isolation verification

On the clean machine, confirm the app performs runtime preflight successfully.

The user must not need to know where `imapsync` or Perl lives.

Where practical verify that:

- `imapsync` is not installed globally;
- Homebrew is absent or irrelevant;
- system Perl is not used by the application.

Do not modify the clean system merely to satisfy the test.

## Real IMAP connection test

Use controlled test mailboxes.

Do not use production/customer credentials for verification unless explicitly authorized.

Create or use test accounts containing non-sensitive mail.

Verify source connection testing for:

- host;
- port;
- selected security mode;
- authentication.

Verify destination connection testing likewise.

At minimum perform a real TLS-based scenario.

If STARTTLS is relevant to supported deployments, perform one real STARTTLS server verification as well.

Do not rely only on mocks for this task.

## Failed authentication test

Enter an intentionally incorrect password for a test account.

Verify:

- authentication test fails clearly;
- no password is shown in the UI;
- no raw stack trace appears;
- the application remains usable afterward.

Then correct the password and verify recovery.

## Real migration test

Perform an actual small mailbox migration between controlled test accounts.

Prepare a source mailbox with a deterministic small dataset.

For example, include:

- several normal messages;
- nested folders if supported by the current migration behavior;
- messages with attachments;
- Unicode subject/sender/folder data where practical.

Do not use a huge mailbox for the initial E2E proof.

Record the expected test dataset.

## Migration workflow

Verify the complete user path:

1. enter source endpoint;
2. enter destination endpoint;
3. test source connection;
4. test destination connection;
5. start migration;
6. observe streamed output;
7. reach terminal success state;
8. return to the form.

Confirm that no terminal or external tool is required.

## Migration correctness

After migration, inspect the destination mailbox using an independent mail client/webmail where practical.

Verify at minimum:

- expected folders exist;
- expected messages arrived;
- attachments are present;
- message subjects/content are intact;
- Unicode test data survives;
- no obvious unexpected duplication occurred.

Do not claim full imapsync semantic correctness from a tiny test dataset.

This task proves the supported user workflow, not every possible IMAP edge case.

## Repeat migration flow

Use the application's "Start another migration" flow.

Verify:

- previous output is cleared;
- previous success state is cleared;
- endpoint values may remain;
- connection tests are no longer trusted;
- fresh connection tests are required;
- second migration can start normally.

## Cancellation E2E

Perform a controlled migration long enough to exercise cancellation if practical.

Verify:

- cancel action is available;
- UI enters cancelling state;
- output remains visible;
- process stops;
- final state is cancellation, not failure.

Do not claim rollback.

Document what remains in the destination mailbox after cancellation if observable.

## Failure E2E

Trigger at least one safe real migration failure where practical.

Examples:

- unreachable test host;
- deliberately invalid destination authentication before migration;
- controlled runtime-unavailable fixture only if this can be done without altering the release artifact.

Verify:

- safe user-facing message;
- no stack trace;
- no internal path leakage;
- app can recover to another migration attempt.

Do not corrupt the actual release runtime solely to manufacture a failure unless testing from a disposable copy.

## Persistent-file inspection

After connection tests and migrations, inspect normal user-accessible locations for unexpected application/runtime residue.

Specifically verify that the app does not leave uncontrolled:

- `LOG_imapsync/`;
- `W/`;
- repository-style temp folders;
- plaintext credential files.

Controlled OS temporary files may exist transiently.

Document any persistent application files that are intentionally created.

## Credential hygiene

During E2E verification, inspect:

- application UI;
- diagnostic output;
- streamed migration output;
- normal logs;
- obvious process invocation where practical.

Verify passwords do not appear.

Do not include real passwords in screenshots, CI logs, task documentation, or bug reports.

## Network/security behavior

Verify TLS certificate validation remains enabled.

Do not bypass certificate verification merely to make a test server work.

If using a test server with invalid/self-signed certificates, treat rejection as correct behavior unless product requirements explicitly support custom trust.

## Offline/runtime behavior

After the application has been downloaded/extracted, no network access should be required merely to load the bundled runtime.

The actual migration naturally requires network connectivity to the IMAP servers.

Do not confuse runtime self-containment with offline email migration.

## User-facing usability notes

Record obvious user-facing issues encountered during the test.

Only fix small release-blocking defects discovered during E2E.

Do not expand this task into a redesign.

If a larger UX issue is found:

- record it in backlog;
- keep TASK-010 focused.

## Architecture-specific differences

Record any behavior difference between x86_64 and arm64.

Expected application behavior should be equivalent.

Architecture-specific packaging/runtime internals must not leak into normal user UX.

## Evidence

Create a concise test report.

Suggested location:

`docs/e2e-macos.md`

Record for each tested architecture:

- hardware/model category;
- CPU architecture;
- macOS version;
- artifact version/name;
- artifact SHA-256 if available;
- Gatekeeper first-launch behavior;
- runtime preflight;
- source connection test result;
- destination connection test result;
- real migration result;
- cancellation result if tested;
- repeat migration result;
- residue/log inspection;
- known limitations.

Do not record credentials.

## Screenshots

Screenshots are optional.

If used:

- redact addresses/credentials when sensitive;
- do not capture passwords;
- keep them out of Git if they are large or contain private test data unless explicitly useful.

## Signing/notarization status

State clearly in the E2E report:

- artifact is unsigned;
- artifact is not notarized;
- Gatekeeper approval is therefore expected;
- signing/notarization is optional future/client-funded release hardening.

Do not mark TASK-010 blocked solely because notarization is absent.

## Automated verification

Run:

`pnpm verify`

before producing the test artifact.

Existing CI/runtime tests must remain green.

TASK-010 itself requires manual/native E2E evidence in addition to automated verification.

## Regression handling

If E2E finds a real release-blocking application defect:

1. reproduce it;
2. add a deterministic automated regression test where appropriate;
3. fix it narrowly;
4. run `pnpm verify`;
5. rebuild the affected artifact;
6. repeat the relevant E2E step.

Do not merely document a reproducible correctness/security bug as a known limitation when it can reasonably be fixed.

## Scope restrictions

Do not:

- enroll in Apple Developer Program;
- implement signing/notarization;
- disable Gatekeeper globally;
- require users to install Homebrew;
- add migration history;
- add provider-specific features;
- implement OAuth;
- redesign the UI;
- add auto-update;
- add Windows/Linux support;
- use customer production mailboxes without authorization.

## Acceptance criteria

TASK-010 is complete when:

- `pnpm verify` passes;
- actual packaged artifact is used;
- at least one clean/native environment completes the full user workflow;
- every architecture claimed as clean-machine verified has real native evidence;
- first-launch Gatekeeper behavior is documented honestly;
- application launches after normal unsigned-app approval;
- bundled runtime works without end-user Homebrew/system Perl setup;
- real source/destination IMAP authentication succeeds with controlled test accounts;
- at least one real mailbox migration succeeds;
- destination mailbox is independently inspected;
- repeat-migration flow works;
- credentials do not appear in UI/output/logs;
- uncontrolled `LOG_imapsync/` / `W/` residue is absent;
- failures remain safe and recoverable;
- signing/notarization limitation is documented;
- `docs/e2e-macos.md` records the evidence and remaining limitations.

If an architecture has not undergone a real clean/native E2E run, do not describe that architecture as clean-machine verified.

## Task lifecycle

On completion:

1. mark `tasks/current.md` as `Complete`;
2. archive the task as `tasks/done/TASK-010.md`;
3. append the result to `docs/progress.md`;
4. update backlog with concrete remaining release/UX work;
5. leave signing/notarization as optional/client-funded unless requirements change.

## Status

Blocked — requires manual clean-machine testing with real test mailboxes.

Done (automated/package verification):

- `pnpm verify` passes (183 tests).
- The actual distribution artifacts were produced and recorded with SHA-256
  (see `docs/e2e-macos.md`):
  - x86_64 `imapSyncGUI-0.1.0-mac-x64.zip` (rebuilt with the latest code);
  - arm64 `imapSyncGUI-0.1.0-mac-arm64.zip` (downloaded from native CI).
- Packaged runtime smoke tests pass for x86_64 (local) and arm64 (native CI);
  the native arm64 workflow passes end to end.
- `docs/e2e-macos.md` documents the artifact details, signing/notarization
  limitation, and the remaining manual steps.

Remaining blocker (cannot be performed by the agent environment):

- a clean macOS machine without developer tooling;
- controlled test IMAP mailboxes (credentials);
- an interactive manual session for the real connection-test/migration workflow.

Per the task, this cannot be marked Complete without real clean/native E2E
evidence, and no architecture is described as "clean-machine verified". The
task remains blocked; `docs/e2e-macos.md` records the exact remaining steps.
