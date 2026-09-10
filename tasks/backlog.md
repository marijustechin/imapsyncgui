# Backlog

## Planned

- TASK-010 — End-to-end verification on clean macOS environment
- Apple code signing and notarization
- Physical clean-machine Windows E2E test (TASK-011 follow-up; see
  `docs/e2e-windows.md`)
- Windows Authenticode code signing (currently unsigned, SmartScreen warns;
  see ADR-017)

## Later

- Batch mailbox migrations
- Saved server presets without passwords
- Linux support
- Application auto-update
- Stronger credential handling via `--passfile` temp files (see ADR-007)
- Remove the redundant source `imapsync` script staged alongside the packed
  binary during the arm64 runtime build (`runtime/darwin-arm64/imapsync` in
  addition to `bin/imapsync`)
