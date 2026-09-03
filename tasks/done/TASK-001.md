# TASK-001 — Bootstrap desktop application

Create the initial Electron application foundation.

## Requirements

Use:

- Electron;
- React;
- TypeScript;
- Vite;
- pnpm.

The project must establish a secure Electron process boundary:

- main process;
- preload script;
- renderer process.

The renderer must not have direct Node.js access.

## Deliverables

Create the initial desktop application under:

`apps/desktop`

Add repository-level commands required for development and verification.

## Verification

The following command must succeed:

`pnpm verify`

At minimum it must run:

- lint;
- TypeScript checking;
- tests;
- production build.

## UI

For now the renderer only needs to display:

`imapSyncGUI`

and a short placeholder description.

Do not implement migration functionality yet.

## Acceptance criteria

- `pnpm install` succeeds.
- `pnpm verify` succeeds.
- development mode launches Electron.
- production build succeeds.
- renderer has no direct Node.js access.
- preload exists but exposes no unnecessary API.
- no migration functionality has been implemented.
- README explains how to install, verify and run the project.

## Status

Complete.
