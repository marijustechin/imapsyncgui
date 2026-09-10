# TASK-012 — Migration UX and live log streaming in the packaged app

> **Status: Complete.**

## Goal

Fix the migration feedback UX in the packaged application on Windows and macOS:
the migration log must stream imapsync output live instead of appearing only
after the process exits, the migration screen must clearly show that the
migration is active, the log must follow/scroll sensibly, and the initial form
must fit the default window without page-level scrollbars.

## Context

Real-world testing on both Windows and macOS reported:

- the initial migration form did not fit cleanly in the default window and
  produced unnecessary page scrollbars;
- the migration log remained empty while the migration was running;
- the complete log appeared only after imapsync exited.

## Investigation

The main-process streaming path was inspected directly:

- `src/main/imapsync/launcher.ts` attaches `data` listeners to the child
  `stdout` and `stderr` pipes (no accumulation).
- `src/main/imapsync/adapter.ts` forwards each chunk to `onOutput`
  incrementally; the main process broadcasts each chunk on `migration:output`.
- the renderer appends each chunk to its bounded buffer as it arrives.

An end-to-end harness (real Electron main + preload + built renderer, a local
fake IMAP server, and both a fake slow executable and the real bundled
`imapsync`) confirmed output is delivered incrementally: chunks reached the
renderer while the process was still running, in both development and packaged
mode. The launcher/adapter/IPC path therefore did not accumulate output.

The reproduced UX gaps were:

- no visible activity indication during imapsync's startup and quiet periods
  (the log stayed empty and only the static status text changed);
- the default window (900×700) and form spacing overflowed by a few pixels,
  producing page-level scrollbars.

## Implemented changes

- **Streaming hardening** — each child stream is decoded with a Node
  `StringDecoder` so a multi-byte UTF-8 character split across two OS reads is
  reassembled rather than emitted as replacement characters; any trailing
  partial sequence is flushed on exit. Output remains chunk-by-chunk and is
  never accumulated until exit. imapsync arguments are unchanged.
- **Real-time migration screen** — the renderer now shows the migration view as
  soon as a migration starts (including the `starting` phase). An animated
  running indicator is shown while the migration is active, and a
  `Waiting for imapsync output…` placeholder is shown until the first output
  arrives. Cancel is available during both `starting` and `running`.
- **Scrolling** — the existing auto-follow behaviour is preserved: the log
  follows new output while the user is at/near the bottom and stops forcing the
  view when the user scrolls up.
- **Completion** — success/failure/cancelled states and the preserved, bounded
  log are unchanged; terminal state is still driven by the `migration:lifecycle`
  event, never by parsing output text.
- **Layout** — the default window is 1080×720 with `minWidth: 640` /
  `minHeight: 520`; the form spacing was compacted so the initial form fits a
  1366×768 desktop with no page-level vertical scrollbar, and the migration
  output panel grows and scrolls internally.

## Files changed

- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/imapsync/adapter.ts`
- `apps/desktop/src/main/imapsync/adapter.test.ts`
- `apps/desktop/src/main/imapsync/launcher.test.ts`
- `apps/desktop/src/renderer/src/App.tsx`
- `apps/desktop/src/renderer/src/App.test.tsx`
- `apps/desktop/src/renderer/src/MigrationView.tsx`
- `apps/desktop/src/renderer/src/MigrationView.test.tsx` (new)
- `apps/desktop/src/renderer/src/index.css`
- `docs/architecture.md`
- `docs/testing.md`
- `docs/progress.md`
- `tasks/current.md`, `tasks/done/TASK-012.md`, `tasks/backlog.md`

## Verification

- `pnpm verify`: PASS (234 tests).
- Packaged macOS x64 app rebuilt and exercised end to end with a local IMAP
  fixture and the real bundled `imapsync`:
  - the view shows `Starting migration…` immediately, then `Migration running`
    with the spinner and placeholder;
  - output is visible while the status is still `Migration running`
    (0 → 1899 → 11503 → 12314 characters) rather than only after exit;
  - the complete log remains visible after success;
  - cancellation stops the process, preserves the partial log, and shows
    `Migration cancelled.` with a `Start another migration` action;
  - the initial form has no page-level vertical scrollbar at the default window
    size.

## Notes and limitations

- A physical Windows clean-machine E2E was not performed in this environment;
  the streaming path is platform-independent Node `spawn` pipe handling and the
  renderer is identical across platforms. Windows verification remains covered
  by the existing native Windows CI (`docs/e2e-windows.md`).
- Existing connection-test behaviour, migration arguments, and migration
  correctness were not changed.
