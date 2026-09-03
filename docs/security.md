# Security

## Process boundary

The renderer has no direct Node.js access. The main process creates every
`BrowserWindow` with:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

The preload script is the only bridge to privileged code and exposes a narrowly
scoped, explicitly typed API (`window.api`) with exactly three operations:
`testConnection`, `startMigration`, and `cancelMigration`. No generic
`ipcRenderer`, `ipcMain`, Electron, or Node.js API is exposed to the renderer,
and there is no generic IPC helper that lets the renderer invoke arbitrary
channels.

## Runtime validation

Data received over IPC is not trusted. The main process runtime-validates every
request (`src/main/validation.ts`) before use:

- host is a non-empty string;
- port is an integer between 1 and 65535;
- username is a non-empty string;
- password is a non-empty string;
- security mode is one of the supported values.

Validation messages are static and never echo credential values.

## Process execution

`imapsync` is launched from the main process using `spawn()` with an argument
array:

- no `exec()`;
- no `sh`, `bash`, `zsh`, or other shell;
- no single command string;
- the executable path and arguments are passed separately.

Only an explicit allowlist of `imapsync` arguments is generated
(`src/main/imapsync/arguments.ts`). Renderer input is never used to select the
executable path and never introduces arbitrary flags; each user value is passed
as a single argument value.

## imapsync log and temp policy

Production invocation disables persistent `imapsync` file logging (`--nolog`),
directs temporary files to a controlled directory (`--tmpdir <cwd>`), and sets
an explicit process `cwd` equal to the OS temporary directory. Persistent
`LOG_imapsync/` and `W/` directories are therefore not created in the
application or working directory, and only sanitized stdout/stderr is streamed
to the renderer. Log/temp paths are never derived from renderer input.

## Passwords

Passwords are sensitive transient data. For the first release:

- passwords must not be written to application logs;
- passwords must not be persisted to normal application storage;
- passwords must not appear in renderer console output;
- passwords must not be embedded in command strings;
- IPC interfaces must expose only narrowly scoped operations.

The adapter passes passwords via the `IMAPSYNC_PASSWORD1` /
`IMAPSYNC_PASSWORD2` environment variables rather than on the command line,
avoiding the argument vector and any command string. Process output is
sanitized with `redactSecrets` before leaving the main process, so credential
values never reach the renderer.

Known limitation: environment variables may still be observable with
`ps -E` on macOS. A stronger alternative (`--passfile1` / `--passfile2` with a
0600 temporary file) is recorded as future hardening and would require a
documented trade-off against the no-on-disk rule.

## Runtime resolution

In a packaged application, `imapsync` is resolved only from the bundled
per-architecture runtime (`<resources>/runtime/<arch>`); the `IMAPSYNC_EXECUTABLE`
override and `PATH` are ignored, so a packaged build never falls back to
host-installed `imapsync` or system Perl. The bundled runtime is validated
before use (directory, manifest, architecture, and the self-contained binary)
and failures are mapped to safe application-level messages that never leak
internal paths, environment dumps, or loader diagnostics.

The self-contained runtime is the official `imapsync` binary (ADR-012); it
links only system `libSystem` and embeds its own Perl, modules, and OpenSSL.
The child-process environment is constructed deterministically in
`src/main/runtime/env.ts`, which removes developer Perl configuration
(`PERL5LIB`, `PERL_LOCAL_LIB_ROOT`, `PERL_MB_OPT`, `PERL_MM_OPT`, `PERL5OPT`)
and adds only the ADR-007 credential variables.

## Current state

Connection testing is implemented (connect + TLS + `LOGIN`). Migration
start/cancel and sanitized output streaming are wired to the runtime adapter.

## Connection testing

Connection testing stays entirely in the main process; the renderer only calls
`window.api.testConnection(...)` and receives a typed result. No sockets, TLS
objects, raw protocol clients, or Node.js APIs cross the IPC boundary.

- Credentials are used only for the active `LOGIN` attempt and are never
  persisted, logged, or returned in results or error messages.
- Low-level errors (DNS, connection, TLS, timeout) are translated into stable
  application-level codes; raw errors and stack traces never reach the renderer.
- Every attempt has a finite timeout (10s) and destroys its connection on every
  completion path.
- `none` mode transmits credentials in clear text by design; `tls` and
  `starttls` negotiate TLS before the `LOGIN` command is sent.

## Renderer credential handling

The renderer holds endpoint credentials only in React component state, which is
transient. Password inputs use `type="password"`, values are never persisted or
logged, and credentials are never written into status or error output. The
renderer has no access to filesystem, storage, or networking APIs, so there is
no path to persist or exfiltrate credentials outside the narrow preload API.

## Migration output and lifecycle

Migration output reaches the renderer only through the sanitized
`migration:output` channel; the main process redacts credentials before
broadcast. Migration terminal state is delivered through the typed
`migration:lifecycle` channel and is authoritative — the renderer never infers
completion from output text. The renderer's output buffer is bounded
(100,000 characters) and output is never persisted, logged, or copied into
debug output by application code.

Failure results carry only a concise, safe message from the runtime adapter
(e.g. a non-zero exit reason); no raw `Error`, stack trace, executable path, or
environment variable crosses IPC. The result screen shows safe `username@host`
identities and never renders passwords or complete credential-bearing objects.

## Code signing and notarization

Distributable artifacts are currently **unsigned and not notarized**. No
Apple Developer identity is used and no signing is faked. Unsigned macOS apps
are subject to Gatekeeper; users must explicitly allow the app to run, and this
must not be worked around by disabling macOS security mechanisms. Signing and
notarization are a deferred follow-up task (see `tasks/backlog.md`).

## Packaged runtime

In a packaged build the application resolves and launches only the bundled
architecture-matched runtime under `Contents/Resources/runtime/<arch>`; it never
falls back to `PATH`, `IMAPSYNC_EXECUTABLE`, Homebrew, or system Perl. Runtime
validation runs before migration start and reports safe, non-leaking failures.
