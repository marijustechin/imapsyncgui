# macOS end-to-end verification

Status: **blocked on manual clean-machine testing** — automated and packaged
verification is complete, but a real clean-machine run with controlled test
mailboxes has not been performed (no clean macOS hardware or test IMAP accounts
are available in this environment).

This document is the honest record of what has and has not been verified.

## Signing / notarization

- Artifacts are **ad-hoc signed** but **not Developer ID signed** and **not
  notarized** (no Apple Developer Program credentials). See ADR-015.
- On first launch macOS Gatekeeper is expected to block the app or warn about an
  unidentified developer; the normal user action is System Settings →
  Privacy & Security → Open Anyway (or Control-click → Open), depending on macOS
  version.
- Ad-hoc signing is applied so the app has a *consistent, valid* signature. This
  matters on Apple Silicon, where macOS requires every executable to be signed
  and otherwise misreports the app as *damaged* (see "Incident investigation").
- This is an expected distribution limitation, not an application defect.
- Developer ID signing/notarization is optional, client-funded release hardening
  and is out of scope for this task.

## Distribution

Current test distribution is a GitHub pre-release (downloadable from the normal
GitHub Releases page):

- Release tag: `v0.1.0-e2e.2`
- Title: `imapSyncGUI v0.1.0 — E2E Test Build 2`
- URL: https://github.com/marijustechin/imapsyncgui/releases/tag/v0.1.0-e2e.2
- Format: architecture-specific **DMGs** (primary). `SHA256SUMS.txt` accompanies
  the release.

| Architecture | Filename | imapsync | Runtime | SHA-256 |
| ------------ | -------- | -------- | ------- | ------- |
| x86_64 (Intel) | `imapSyncGUI-0.1.0-mac-x64.dmg` | 2.314 (official binary) | self-contained `imapsync_bin_Darwin_x86_64` | `c8a1cc4d978a6c36324326c95faa103a3f7a76d3e046cbc685d35c4ebddd2ff9` |
| arm64 (Apple Silicon) | `imapSyncGUI-0.1.0-mac-arm64.dmg` | 2.324 (self-built) | self-contained PAR::Packer binary (Perl 5.44 embedded) | `d956b55a13184f83e39cb20a3417abf80e29ead3203991baec1e23f2aa219f9f` |

Application version `0.1.0`. Artifacts were produced from commit
`2a06298dfcf3667a3c2f2265211881f2be371a6c`. Both DMGs were re-downloaded from
the public release and their checksums verified (`shasum -a 256 -c
SHA256SUMS.txt`); `hdiutil verify` and native `hdiutil attach` both pass on
macOS for the re-downloaded assets.

### Choosing the right artifact

The filename always names the architecture.

| Your Mac | CPU | Download |
| -------- | --- | -------- |
| Apple Silicon (M1/M2/M3/M4…) | arm64 | `imapSyncGUI-0.1.0-mac-arm64.dmg` |
| Intel Mac | x86_64 | `imapSyncGUI-0.1.0-mac-x64.dmg` |

How to check:

- GUI: Apple menu → **About This Mac** ("Chip" = Apple silicon, "Processor" =
  Intel).
- Terminal: `uname -m` → `arm64` (Apple Silicon) or `x86_64` (Intel).

Downloading the wrong architecture is a common cause of "the app is damaged"
errors; verify the architecture before launching.

## Incident investigation (TASK-010B)

The first test distribution `v0.1.0-e2e.1` shipped architecture-specific ZIPs
built with no signing (`identity: null`). One tester (x86_64 Hackintosh) could
open it after `Open Anyway`; another (physical Mac, macOS Ventura, architecture
not recorded) saw "the application is damaged" and "move to Trash" and could not
reach the `Open Anyway` flow.

Findings, each backed by direct inspection of the re-downloaded
`v0.1.0-e2e.1` assets with native macOS tooling:

### 1. The archives were structurally valid

- `shasum -a 256 -c SHA256SUMS.txt` → both OK.
- `file` → both are Zip archives; `unzip -t` → no errors; `zipinfo` → valid
  entry tables.
- `ditto -x -k` (native macOS) extracted both successfully.

Conclusion: the ZIPs were **not** corrupted. The third-party `iZip` "unknown
archive" report is an iZip limitation, not evidence of corruption. Native
Archive Utility / `ditto` is the supported baseline; no third-party tool is
required.

### 2. Architectures were correct

- x64 ZIP: app executable `Mach-O x86_64`, runtime `Mach-O x86_64`.
- arm64 ZIP: app executable `Mach-O arm64`, runtime `Mach-O arm64`.

### 3. The arm64 bundle had an invalid signing state (the key finding)

- x64 `.app`: `codesign -dv` → "code object is not signed at all" (fully
  unsigned). `spctl --assess` reports "accepted" only because spctl does not
  enforce policy on binaries with no signature at all; the actual Gatekeeper
  runtime flow is "unidentified developer" → `Open Anyway`, which the Hackintosh
  exercised successfully.
- arm64 `.app`: the main executable is **linker-signed only**
  (`Signature=adhoc`, flags `0x20002 adhoc,linker-signed`), but the bundle has no
  `_CodeSignature/CodeResources`, `Info.plist` is not bound, and
  `Sealed Resources = none`. `codesign --verify --deep --strict` fails with
  `code has no resources but signature indicates they must be present`, and
  `spctl --assess` (with a quarantine attribute) **rejects** it with the same
  error.

On Apple Silicon, macOS requires every executable to carry a valid signature; a
bundle that is only linker-signed (with no sealed resources) is classified by
Gatekeeper as *damaged* ("move to Trash") rather than *unidentified developer*.
This is the most probable cause of the Ventura failure — not archive corruption,
and not (by itself) an architecture mismatch.

### 4. Wrong-architecture behavior is distinct from "damaged"

Per Apple support (article 102527), opening an Intel-only app on Apple Silicon
without Rosetta prompts the user to **install Rosetta** ("you're asked to
install it"). The normal "unknown developer" flow is System Settings →
Privacy & Security → Open Anyway (Apple macOS User Guide, mh40616). Neither is
the "damaged / move to Trash" message, which is the signature-integrity failure
demonstrated above. This was documented, not reproduced on Apple Silicon
hardware.

### 5. Quarantine

GitHub browser downloads apply the `com.apple.quarantine` extended attribute;
extraction propagates it to the `.app`, triggering the Gatekeeper assessment on
first launch. The supported path is the normal `Open Anyway` approval; removing
quarantine is not part of the installation workflow and is not recommended.

### Resolution

electron-builder now ad-hoc signs the whole `.app` (`identity: '-'`,
`hardenedRuntime: false`), producing a consistent, valid signature. After this
change `codesign --verify --deep --strict` passes and Gatekeeper presents the
normal "unidentified developer" flow for both architectures. The bundled
`imapsync` binary is excluded from the seal (`signIgnore`) because the official
x86_64 binary cannot be re-signed and the arm64 binary is already linker-signed.
See ADR-015.

## Real test attempts

### Attempt 1 — physical Mac (failed before launch)

```text
Machine: Eimantas's physical Mac
macOS: Ventura
architecture: not recorded
release: v0.1.0-e2e.1
distribution: architecture-specific ZIP
```

Observed:

- application/download was reported as damaged by macOS;
- macOS offered to move it to Trash;
- normal Gatekeeper Open Anyway flow was not successfully reached;
- iZip reported an unknown archive;
- moving the app to Applications did not resolve the issue;
- no IMAP E2E test was performed.

Result: inconclusive distribution failure at the time; subsequently explained by
the arm64 bundle's invalid signing state (see "Incident investigation"). The
machine architecture was never recorded, so the exact cause cannot be proven,
only strongly indicated.

### Attempt 2 — developer x86_64 Hackintosh (launch + connection test)

```text
Machine: developer's x86_64 Hackintosh
macOS: not recorded (Sonoma 14.8.7 at packaging time)
architecture: x86_64
release: v0.1.0-e2e.1
distribution: architecture-specific ZIP (x64)
```

Observed:

- Gatekeeper warning shown;
- Open Anyway used;
- application launched;
- a real `Test connection` operation succeeded.

This proves application launch and IMAP connectivity on that environment, but
does **not** prove mailbox migration or clean-machine compatibility, and does
not complete TASK-010.

## Automated / packaged verification (completed)

- `pnpm verify` passes (192 tests): lint, typecheck, tests, build.
- Packaging config is regression-tested (`packaging.test.ts`,
  `electron-builder-config.test.ts`): DMG+ZIP targets, ad-hoc signing identity,
  `hardenedRuntime: false`, architecture-bearing filenames, DMG `/Applications`
  link, per-architecture `extraResources` mapping.
- x86_64 DMG built on the developer's x86_64 macOS 14.8.7:
  - `hdiutil verify` → checksum VALID;
  - `hdiutil attach` → mounts; volume contains `imapSyncGUI.app` and an
    `/Applications` link;
  - app + runtime are `x86_64`;
  - app copied from the DMG passes the packaged runtime smoke test
    (`package:smoke --arch x64 --app <copied>`);
  - `codesign --verify --deep --strict` passes (ad-hoc);
  - app launches.
- arm64 DMG built by native arm64 CI (`.github/workflows/macos-arm64.yml`,
  GitHub-hosted `macos-15` arm64 runner):
  - host is `arm64` (`uname -m` + Node `process.arch`);
  - `pnpm verify` passes;
  - runtime built natively, validated, self-tested (host isolation);
  - `hdiutil verify` → checksum VALID; DMG mounts; volume contains the app and
    an `/Applications` link;
  - app + runtime are `arm64`;
  - `codesign --verify --deep --strict` passes (ad-hoc);
  - app copied from the DMG passes the packaged runtime smoke test;
  - app launches.
- Both DMGs re-downloaded from the public GitHub release and independently
  re-verified: `shasum -a 256 -c SHA256SUMS.txt` OK, `hdiutil verify` VALID,
  `hdiutil attach` mounts, architectures correct.
- Both runtimes link only system `libSystem`; no Homebrew/MacPorts/developer
  paths; no Rosetta; no system Perl.

## Manual clean-machine E2E (not yet performed)

The following steps require clean macOS hardware and controlled test mailboxes
and have **not** been executed. TASK-010 is not complete until they are, and no
architecture is described as "clean-machine verified".

Before attempting launch, record (this prevents ambiguity after a failed
session):

```text
Mac model:
macOS version:
uname -m:
selected release artifact:
artifact SHA-256:
```

Then:

- [ ] Download the correct DMG from the GitHub release.
- [ ] Verify the architecture matches `uname -m` (see "Choosing the right
      artifact").
- [ ] Open the DMG and drag `imapSyncGUI` to Applications (no terminal
      required).
- [ ] Document the actual first-launch Gatekeeper behavior on the target macOS
      version.
- [ ] Launch after the normal unsigned/ad-hoc approval flow; confirm the
      renderer loads, no terminal is required, no runtime/Perl prompt appears.
- [ ] Real source + destination connection tests against controlled test
      accounts (TLS at minimum; STARTTLS if relevant).
- [ ] Failed-authentication test (wrong password): clear failure, no password
      shown, no stack trace, app remains usable; then recover with the correct
      password.
- [ ] Real small mailbox migration (several messages, nested folders,
      attachments, Unicode subject/sender/folder) via the full UI workflow.
- [ ] Independent inspection of the destination mailbox (folders, messages,
      attachments, subjects, Unicode, no unexpected duplication).
- [ ] "Start another migration" flow: output/state cleared, fresh connection
      tests required, second migration starts.
- [ ] Cancellation E2E (cancelling state, output preserved, cancellation not
      failure); document destination residue.
- [ ] One safe real failure (unreachable host / bad destination auth): safe
      message, no stack trace, no path leak, recovery works.
- [ ] Residue inspection: no uncontrolled `LOG_imapsync/` or `W/`, no plaintext
      credential files; document any intentional persistent files.
- [ ] Credential hygiene: confirm passwords never appear in UI, output, or logs.

## Known limitations

- Ad-hoc signed, not Developer ID signed, not notarized (Gatekeeper approval
  expected).
- Only a tiny deterministic dataset is in scope for the first E2E proof; it does
  not prove all IMAP edge cases.
- A real clean-machine run requires clean hardware + test mailboxes + an
  interactive session, none of which are available in the agent environment.
