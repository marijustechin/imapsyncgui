# Windows end-to-end verification

Status: **not yet performed** — native Windows CI builds, validates, self-tests,
packages, and smoke-tests the application and its bundled runtime, but a real
physical clean-machine Windows E2E test has **not** been performed in this
environment. This document is the honest record and the checklist for the
future manual run.

## Signing / SmartScreen

- The Windows NSIS installer and the installed application are **unsigned**: no
  Authenticode certificate is applied (ADR-017).
- Microsoft Defender SmartScreen is expected to warn (or block with an "Unknown
  publisher" interstitial) on first run of a freshly downloaded unsigned
  installer.
- This is a known distribution limitation, separate from malware detection, and
  must not be worked around by disabling Defender/SmartScreen or by instructing
  users to disable Windows security.
- Authenticode signing is deferred, optional, client-funded release hardening.

## What has been verified (automated / native CI)

Native Windows x64 CI (`.github/workflows/windows-x64.yml`, GitHub-hosted
`windows-latest` runner) proves:

- `process.platform === 'win32'` and `process.arch === 'x64'` on the runner;
- `pnpm verify` passes on Windows;
- the bundled runtime is the official upstream `imapsync.exe` (2.314), staged
  from the pinned `imapsync_2.314.zip` with SHA-256 verification;
- the runtime is a PE32+ AMD64 executable (verified with native .NET tooling and
  the repository's own PE-header check);
- the runtime self-test passes in a host-isolation environment (restricted
  `PATH`, no developer Perl);
- the Windows x64 NSIS installer builds;
- the packaged app's bundled runtime smoke test passes from inside
  `win-unpacked/resources`;
- the installer silently installs into a disposable location, the installed
  `imapSyncGUI.exe` and `resources/runtime/win32-x64/bin/imapsync.exe` are
  verified present, the installed runtime passes the smoke test, and the
  application uninstalls cleanly;
- the installer is a valid PE (AMD64) executable and its SHA-256 is recorded.

This is **not** a substitute for a physical clean-machine run; see below.

## Distribution

Current Windows test distribution is a GitHub pre-release:

- Release tag: `v0.1.0-e2e.3`
- Title: `imapSyncGUI v0.1.0 — Windows x64 test build (unsigned)`
- URL: https://github.com/marijustechin/imapsyncgui/releases/tag/v0.1.0-e2e.3
- Installer: `imapSyncGUI-0.1.0-windows-x64-setup.exe`
- Installer SHA-256:
  `770a7c72108f8b6fec27c9d9e947e6c293bae0b0d3b58d060b370fe798103fd8`
- Bundled `imapsync.exe` SHA-256:
  `329c0bfecab410a2bf5e57cc3319aa00b8e494fd792fe3a5476db9efdb1d2aab`
- Produced from commit `e84c5cd46d3c6adcc8c7531af95515299514c6eb`.

The public installer was re-downloaded from the release and its SHA-256 verified
against the recorded value; it is a valid PE executable (a Nullsoft NSIS
installer, whose 32-bit stub is normal and expected). The identical bytes were
silently installed, smoke-tested (installed `imapsync.exe` = AMD64), and
uninstalled in native Windows x64 CI.

## Manual clean-machine checklist

The future physical Windows E2E must fill in this record:

```text
Machine:
Windows version:
CPU architecture:
release tag:
installer filename:
installer SHA-256:
SmartScreen behavior:
installation result:
application launch:
source connection:
destination connection:
migration:
cancellation:
repeat migration:
residue inspection:
```

## Real mailbox E2E criteria

The future physical Windows E2E must eventually test:

1. download installer from GitHub;
2. observe real SmartScreen behavior;
3. install application;
4. launch without developer tooling;
5. test source connection;
6. test destination connection;
7. perform a real controlled mailbox migration;
8. inspect destination independently;
9. test cancellation;
10. test repeat migration;
11. inspect logs/temp residue;
12. uninstall application.

Do not claim Windows clean-machine verification until these are performed and
recorded here with real native evidence.
