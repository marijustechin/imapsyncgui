# TASK-010B — Diagnose and fix real-mac distribution failure

## Goal

Investigate and fix the macOS distribution failure discovered during the first real TASK-010 clean-machine test.

The objective is not merely to produce another artifact.

The objective is to determine, with evidence, why the GitHub-downloaded application:

- worked on the developer's x86_64 Hackintosh after normal Gatekeeper approval;
- but failed on another physical Mac running macOS Ventura before functional E2E testing could begin.

Then produce a new distribution artifact and release process that removes avoidable ambiguity and is suitable for the next real clean-machine test.

TASK-010 must remain incomplete until the physical E2E test is repeated successfully.

---

# Incident evidence

## Successful environment

The same GitHub release ZIP was downloaded on the developer's Hackintosh.

Observed behavior:

1. macOS presented the expected Gatekeeper warning.
2. User opened:
   `System Settings → Privacy & Security`
3. User selected `Open Anyway`.
4. The application launched successfully.
5. A real `Test connection` operation was successfully exercised.

No full migration was performed because a suitable donor/source mailbox was not available.

The developer machine is:

```text
x86_64 Hackintosh
```

This is evidence that at least one published architecture-specific application artifact can execute after normal Gatekeeper approval.

Do not describe the ZIP universally as corrupted based solely on the second machine's behavior.

---

## Failed environment

On Eimantas's physical Mac running macOS Ventura:

- the GitHub release ZIP was downloaded;
- macOS reported that the application/file was damaged and suggested moving it to Trash;
- the expected normal `Open Anyway` flow was not reached;
- attempting archive handling with iZip resulted in an "unknown archive" type error;
- moving the application into `/Applications` did not resolve the problem;
- application functional testing could not begin.

The exact Mac CPU architecture was not reliably recorded during the meeting.

Therefore architecture mismatch must be investigated as a first-class possibility.

---

# Investigation principle

Do not assume:

- the ZIP was corrupted;
- Gatekeeper was solely responsible;
- Ventura is incompatible;
- architecture mismatch was responsible;
- iZip behavior proves archive corruption;
- unsigned status alone explains the result.

Determine the failure mode from evidence.

---

# Part 1 — Inspect the published release artifacts

Use the existing GitHub pre-release:

```text
v0.1.0-e2e.1
```

Download the published assets again from GitHub itself.

Do not inspect only the local files that were originally uploaded.

For both:

```text
imapSyncGUI-0.1.0-mac-x64.zip
imapSyncGUI-0.1.0-mac-arm64.zip
```

verify:

```bash
shasum -a 256
file
unzip -t
zipinfo
```

Where appropriate also test extraction with native macOS tooling:

```bash
ditto -x -k <archive.zip> <destination>
```

Confirm that the archive is structurally valid.

Record whether third-party tools such as iZip are required.

They must not be required.

Native macOS Archive Utility / `ditto` is the supported baseline.

---

# Part 2 — Verify architecture identity

For each extracted `.app`, inspect the application executable.

Use appropriate tooling such as:

```bash
file imapSyncGUI.app/Contents/MacOS/imapSyncGUI
lipo -info imapSyncGUI.app/Contents/MacOS/imapSyncGUI
```

Also inspect the bundled runtime:

```bash
file imapSyncGUI.app/Contents/Resources/runtime/<arch>/...
```

Confirm:

## x86_64 artifact

```text
Electron executable = x86_64
imapsync runtime = x86_64
```

## arm64 artifact

```text
Electron executable = arm64
imapsync runtime = arm64
```

No Universal binary is required.

No Rosetta dependency is allowed as proof of native arm64 support.

---

# Part 3 — Make architecture selection unambiguous

The previous release required the tester to manually select an architecture-specific ZIP.

This is prone to human error.

Improve the release notes so a tester can reliably determine which artifact to download.

Document:

```bash
uname -m
```

Mapping:

```text
arm64  → Apple Silicon → download arm64
x86_64 → Intel Mac     → download x64
```

Also explain a GUI-only alternative where practical:

```text
Apple menu → About This Mac
```

Do not require technical knowledge to choose the correct download.

Architecture must also remain obvious in artifact filenames.

---

# Part 4 — Investigate wrong-architecture behavior

Determine how macOS behaves when:

- an x86_64 build is opened on native Apple Silicon;
- an arm64 build is opened on Intel macOS.

Do not depend on assumptions.

Use native environments / CI / documented tooling where possible.

Determine whether the observed:

```text
"damaged" / move to Trash
```

behavior could plausibly result from an incompatible architecture or whether macOS normally reports a distinct error.

Document findings.

Do not attempt to make Intel execute arm64 binaries.

Do not use Rosetta to hide an architecture-selection problem.

---

# Part 5 — Inspect signing and Gatekeeper state

The application is intentionally unsigned/unnotarized.

Inspect the extracted apps using tools such as:

```bash
codesign -dv --verbose=4 <app>
codesign --verify --deep --strict --verbose=4 <app>
spctl --assess --type execute --verbose=4 <app>
```

Interpret failures carefully.

Differentiate:

- unsigned;
- ad-hoc signed;
- invalid signature;
- damaged bundle;
- Gatekeeper rejection;
- architecture mismatch.

Do not conflate these states.

Record the exact expected result for the current unsigned release.

---

# Part 6 — Quarantine behavior

Because TASK-010 tests a real downloaded artifact, inspect macOS quarantine behavior.

Where possible inspect:

```bash
xattr -l <archive-or-app>
```

and specifically:

```text
com.apple.quarantine
```

Determine:

- whether GitHub-downloaded ZIP receives quarantine;
- whether extraction propagates quarantine to `.app`;
- whether the normal `Open Anyway` path works for the resulting app.

Do not remove quarantine as part of the normal user workflow.

Commands such as:

```bash
xattr -dr com.apple.quarantine
```

may be used only as a diagnostic comparison if genuinely necessary.

They must not become the documented installation solution.

Never recommend disabling Gatekeeper globally.

---

# Part 7 — Produce proper DMG distribution artifacts

The original TASK-010A required DMG artifacts but published ZIP artifacts instead.

Correct this.

Configure the existing Electron packaging pipeline to produce:

```text
imapSyncGUI-0.1.0-mac-x64.dmg
imapSyncGUI-0.1.0-mac-arm64.dmg
```

Preserve architecture-specific builds.

Do not create a Universal build.

---

## DMG UX

The DMG should provide a conventional macOS flow:

```text
imapSyncGUI.app  →  Applications
```

A simple standard layout is sufficient.

Do not spend significant time on branding/custom backgrounds.

The goal is predictable macOS distribution behavior.

---

# Part 8 — Validate DMGs before publication

For each generated DMG, validate using native tooling.

At minimum:

```bash
hdiutil verify <artifact.dmg>
hdiutil attach <artifact.dmg>
```

Inspect the mounted volume.

Confirm:

- `.app` exists;
- `/Applications` shortcut exists where configured;
- application executable has correct architecture;
- bundled runtime has correct architecture;
- expected runtime files are present;
- no development files are included.

Then cleanly detach:

```bash
hdiutil detach <mounted-volume>
```

Failure to mount/verify is release-blocking.

---

# Part 9 — Validate application copied from DMG

Do not stop at verifying that the DMG mounts.

Copy the `.app` from the mounted DMG into a temporary Applications-like destination and run the existing packaged smoke checks against that copied app.

Where a suitable native environment exists, attempt launch.

For arm64, use the existing native Apple Silicon CI.

For x86_64, use the strongest available native x86_64 environment.

---

# Part 10 — Native arm64 CI

Because packaging/distribution changes affect the final app artifact, rerun native arm64 CI.

The native CI must prove:

```text
uname -m = arm64
Node process.arch = arm64
Electron executable = arm64
bundled runtime = arm64
DMG verifies
DMG mounts
app copied from DMG retains correct architecture
package/runtime smoke passes
```

Do not claim the new arm64 DMG is proven without a successful native run.

---

# Part 11 — x86_64 validation

On the developer's x86_64 macOS environment:

- build the x64 DMG;
- `hdiutil verify`;
- mount it;
- copy app;
- run packaged smoke;
- launch it if practical.

The previously successful Hackintosh Gatekeeper test is useful historical evidence but does not replace validation of the newly generated DMG.

---

# Part 12 — Publish a new GitHub pre-release

Do not modify `v0.1.0-e2e.1` and pretend it is the same tested release.

Publish a new immutable pre-release, for example:

```text
v0.1.0-e2e.2
```

Suggested title:

```text
imapSyncGUI v0.1.0 — E2E Test Build 2
```

Assets:

```text
imapSyncGUI-0.1.0-mac-x64.dmg
imapSyncGUI-0.1.0-mac-arm64.dmg
SHA256SUMS.txt
```

ZIP assets may optionally also be retained, but the DMGs are the primary TASK-010 test distribution.

---

# Part 13 — Download the published release again

After publication, re-download the DMGs from the normal GitHub release.

Do not validate only pre-upload local copies.

Verify:

```bash
shasum -a 256 -c SHA256SUMS.txt
hdiutil verify <downloaded.dmg>
```

Where practical:

```bash
hdiutil attach <downloaded.dmg>
```

This must prove the exact public GitHub asset is:

- downloadable;
- checksum-correct;
- a valid DMG;
- mountable by native macOS tooling.

---

# Part 14 — Release notes

Release notes must explicitly state:

## Architecture

```text
Apple Silicon Mac (M1/M2/M3/M4...) → arm64 DMG
Intel Mac                          → x64 DMG
```

Include the simple check:

```bash
uname -m
```

## Unsigned status

Explain:

- app is unsigned;
- app is not notarized;
- Gatekeeper warning is expected;
- normal `Privacy & Security → Open Anyway` may be required.

Do not describe an actual "damaged" failure as expected unless it has been proven to be merely Gatekeeper behavior.

## Installation

Preferred user flow:

1. download correct DMG;
2. open DMG;
3. drag `imapSyncGUI` to Applications;
4. launch;
5. if macOS blocks the unsigned app, use normal Privacy & Security approval.

No terminal should be required for normal installation.

---

# Part 15 — Add a pre-test architecture checklist to TASK-010 documentation

Update:

```text
docs/e2e-macos.md
```

The very first manual test step must now record:

```text
Mac model:
macOS version:
uname -m:
selected release artifact:
artifact SHA-256:
```

This information must be collected before attempting launch.

This prevents ambiguity after a failed test session.

---

# Part 16 — Record the failed Ventura attempt

Add the first real test attempt to `docs/e2e-macos.md`.

Record only known facts.

Example:

```text
Attempt 1
---------
Machine: Eimantas's physical Mac
macOS: Ventura
architecture: not recorded
release: v0.1.0-e2e.1
distribution: architecture-specific ZIP

Observed:
- application/download was reported as damaged by macOS;
- macOS offered to move it to Trash;
- normal Gatekeeper Open Anyway flow was not successfully reached;
- iZip reported an unknown archive;
- moving the app to Applications did not resolve the issue;
- no IMAP E2E test was performed.

Result:
Inconclusive distribution failure.
Root cause not yet established.
```

Do not retroactively invent the architecture or root cause.

---

# Part 17 — Record successful Hackintosh evidence

Also record the comparison case:

```text
Developer x86_64 Hackintosh
same release generation
Gatekeeper warning shown
Open Anyway used
application launched
real Test connection succeeded
```

Clearly distinguish this from complete TASK-010 E2E.

It proves application launch/connectivity on that environment but does not prove mailbox migration or clean-machine compatibility.

---

# Security constraints

Preserve all TASK-009D protections:

- `--nolog`;
- controlled tmpdir/cwd;
- credential sanitization;
- no passwords in argv;
- no shell execution;
- narrow IPC;
- TLS certificate validation.

Do not weaken macOS security mechanisms to make the release launch.

---

# Automated regression tests

Add deterministic tests where useful for:

- artifact naming;
- architecture mapping;
- packaging configuration;
- DMG target definitions;
- release helper behavior.

Do not attempt to mock Gatekeeper as proof of real Gatekeeper behavior.

Native/macOS artifact verification remains required.

---

# Verification

Run:

```bash
pnpm verify
```

It must pass.

Current baseline:

```text
183 tests
```

A higher count is acceptable.

Also require:

```text
x86_64 DMG verification: PASS
arm64 native CI: PASS
GitHub-downloaded DMG checksum: PASS
GitHub-downloaded DMG hdiutil verify: PASS
```

---

# Task lifecycle

TASK-010B is a corrective preparation task for TASK-010.

After completion:

1. archive:
   `tasks/done/TASK-010B.md`
2. restore TASK-010 as the active task;
3. keep TASK-010 incomplete / awaiting physical clean-machine test;
4. update `docs/progress.md`;
5. update `docs/e2e-macos.md`;
6. do not mark TASK-010 complete.

---

# Scope restrictions

Do not:

- buy Apple Developer membership;
- implement signing/notarization;
- create a Universal binary;
- disable Gatekeeper;
- make `xattr` removal part of installation;
- add auto-update;
- redesign the UI;
- add new mail features;
- perform unrelated refactoring;
- claim the Ventura incident's root cause without evidence;
- mark TASK-010 complete.

Signing/notarization remains optional/client-funded release hardening.

---

# Acceptance criteria

TASK-010B is complete only when:

- the `v0.1.0-e2e.1` ZIP artifacts have been independently re-downloaded and structurally inspected;
- ZIP validity or invalidity is established with native tooling;
- x64 and arm64 app/runtime architectures are independently verified;
- architecture-selection risk is documented;
- Gatekeeper/signature state is inspected and distinguished from archive corruption;
- quarantine behavior is investigated sufficiently to document the supported launch path;
- a real x86_64 DMG is produced;
- a real arm64 DMG is produced;
- both DMGs pass `hdiutil verify`;
- both DMGs mount successfully in appropriate native environments;
- application copied from DMG passes relevant packaged/runtime smoke verification;
- native arm64 CI passes for the new DMG path;
- x86_64 DMG is validated on the available x86_64 macOS environment;
- new immutable GitHub pre-release is published;
- exact public GitHub DMGs are re-downloaded;
- checksums pass for the re-downloaded assets;
- `hdiutil verify` passes against the public downloaded DMGs;
- release notes make architecture selection unambiguous;
- failed Ventura attempt is recorded honestly;
- successful Hackintosh comparison evidence is recorded honestly;
- `docs/e2e-macos.md` starts future tests by recording architecture before download;
- `pnpm verify` passes;
- TASK-010 remains incomplete pending another physical clean-machine E2E attempt.

## Status

Complete.

The investigation was carried out as an incident investigation, not as an
assumption of a single cause, and the corrected distribution was produced,
validated, and published:

- `v0.1.0-e2e.1` ZIPs re-downloaded from GitHub and proven structurally valid
  with native tooling (`unzip -t`, `zipinfo`, `ditto -x -k`); the "iZip unknown
  archive" report is an iZip limitation, not corruption.
- x64/arm64 app+runtime architectures independently verified correct.
- Likely root cause established with evidence: the arm64 `.app` was only
  linker-signed (no sealed resources), which Gatekeeper on Apple Silicon
  rejects as "damaged" rather than "unidentified developer".
- Distribution switched to ad-hoc-signed, architecture-specific DMGs
  (`v0.1.0-e2e.2`) with an `/Applications` link and `SHA256SUMS.txt`; the
  bundled `imapsync` binary is excluded from the seal (`signIgnore`).
- x86_64 DMG validated locally (verify/mount/copy/smoke/launch); arm64 DMG
  validated by native arm64 CI; both public DMGs re-downloaded and independently
  checksum- and `hdiutil`-verified.
- `pnpm verify` passes (192 tests).
- Documentation updated (ADR-015, `docs/security.md`, `docs/architecture.md`,
  `docs/e2e-macos.md`, `docs/runtime.md`, `docs/testing.md`, `README.md`).

TASK-010 remains **incomplete** pending another physical clean-machine E2E run;
the new architecture-checklist-first manual procedure is recorded in
`docs/e2e-macos.md`.
