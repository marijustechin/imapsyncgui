# Product

## Product name

Working name: imapSyncGUI

## Goal

Provide a simple desktop interface for migrating email between IMAP servers
using `imapsync`, without requiring the end user to use a terminal.

## Primary user

A non-technical or moderately technical user who has:

- source IMAP credentials;
- destination IMAP credentials;
- one or more mailboxes to migrate.

The user should not need Homebrew, Perl knowledge, or command-line experience.

## Initial platform

macOS.

Other operating systems are explicitly out of scope for the first release.

## Core workflow

1. Open the application.
2. Enter source IMAP server details.
3. Enter destination IMAP server details.
4. Enter source and destination mailbox credentials.
5. Test both connections.
6. Start migration.
7. Observe migration progress.
8. Cancel migration if needed.
9. Receive a clear success or failure result.

## Required fields

For each side:

- IMAP hostname;
- port;
- TLS/SSL setting;
- email / username;
- password.

## Core requirements

The application must:

- validate obvious input errors before execution;
- invoke `imapsync` without exposing shell injection vulnerabilities;
- stream relevant migration output to the UI;
- show whether migration is running, successful, failed, or cancelled;
- prevent accidental concurrent execution of the same migration;
- allow cancellation;
- provide useful error messages;
- work on a clean supported macOS installation without requiring the user
  to manually install development dependencies.

## Security requirements

Passwords are sensitive transient data.

For the first release:

- passwords must not be written to application logs;
- passwords must not be persisted to normal application storage;
- passwords must not appear in renderer console output;
- passwords must not be embedded in command strings;
- IPC interfaces must expose only narrowly scoped operations.

## Explicit non-goals for v1

Do not implement:

- mailbox password storage;
- cloud synchronization;
- user accounts;
- telemetry;
- automatic updates;
- Windows support;
- Linux support;
- migration history database;
- multi-user administration;
- remote migration service;
- OAuth mail providers;
- Exchange-specific APIs.

These may be considered later.
