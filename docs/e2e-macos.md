# macOS end-to-end verification

Status: **blocked on manual clean-machine testing** — automated and packaged
verification is complete, but a real clean-machine run with controlled test
mailboxes has not been performed (no clean macOS hardware or test IMAP accounts
are available in this environment).

This document is the honest record of what has and has not been verified.

## Signing / notarization

- Artifacts are **unsigned** and **not notarized**.
- On first launch macOS Gatekeeper is expected to block the app or warn about an
  unidentified developer; the normal user action is System Settings →
  Privacy & Security → Open Anyway (or Control-click → Open), depending on macOS
  version.
- This is an expected distribution limitation, not an application defect.
- Signing/notarization is optional, client-funded release hardening and is out
  of scope for this task.

## Artifacts

| Architecture | Filename | imapsync | Runtime | SHA-256 |
| ------------ | -------- | -------- | ------- | ------- |
| x86_64 | `imapSyncGUI-0.1.0-mac-x64.zip` | 2.314 (official binary) | self-contained `imapsync_bin_Darwin_x86_64` | `b136ba52a3b58d61560617dae4368fce2943bebeb4df2c0b9ddef2abeb974c5a` |
| arm64 | `imapSyncGUI-0.1.0-mac-arm64.zip` | 2.324 (self-built) | self-contained PAR::Packer binary (Perl 5.44 embedded) | `d9bb1165bfad2bd7a075028851ae07f00ae162c0946894c912946ecf6c947e9a` |

Application version `0.1.0`. Artifacts were produced from commit `1559874`
(`Fix STARTTLS flow, migration lifecycle race, and imapsync log policy`).

## Automated / packaged verification (completed)

- `pnpm verify` passes (183 tests): lint, typecheck, tests, build.
- x86_64 packaged runtime smoke test passes (`pnpm package:smoke --arch x64`):
  manifest/arch OK, runtime binary is x86_64, `imapsync --version` runs.
- arm64 native CI workflow (`.github/workflows/macos-arm64.yml`) passes on a
  GitHub-hosted `macos-15` arm64 runner: runtime validation, host-isolation
  self-test, packaged smoke test, and application launch all succeed.
- Both runtimes link only system `libSystem`; no Homebrew/MacPorts/developer
  paths; no Rosetta; no system Perl.
- Runtime self-containment is proven by the host-isolation self-test (restricted
  `PATH`, cleared Perl variables).

## Manual clean-machine E2E (not yet performed)

The following steps require clean macOS hardware and controlled test mailboxes
and have **not** been executed. TASK-010 is not complete until they are, and no
architecture is described as "clean-machine verified".

- [ ] Download the distribution artifact from GitHub Actions/release and extract
      normally (to exercise quarantine/Gatekeeper behavior).
- [ ] Document the actual first-launch Gatekeeper behavior on the target macOS
      version.
- [ ] Launch after the normal unsigned-app approval flow; confirm the renderer
      loads, no terminal is required, no runtime/Perl prompt appears.
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

- Unsigned/not notarized (Gatekeeper approval expected).
- Only a tiny deterministic dataset is in scope for the first E2E proof; it does
  not prove all IMAP edge cases.
- A real clean-machine run requires clean hardware + test mailboxes + an
  interactive session, none of which are available in the agent environment.
