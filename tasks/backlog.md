# Backlog

## Planned

- TASK-010 — End-to-end verification on clean macOS environment
- Apple code signing and notarization

## Later

- Batch mailbox migrations
- Saved server presets without passwords
- Windows support
- Linux support
- Application auto-update
- Stronger credential handling via `--passfile` temp files (see ADR-007)
- Remove the redundant source `imapsync` script staged alongside the packed
  binary during the arm64 runtime build (`runtime/darwin-arm64/imapsync` in
  addition to `bin/imapsync`)
