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
per-architecture runtime (`<resources>/runtime/<arch>` — `darwin-x64` /
`darwin-arm64` / `win32-x64`); the `IMAPSYNC_EXECUTABLE` override and `PATH`
are ignored, so a packaged build never falls back to host-installed `imapsync`
or system/Strawberry Perl. On Windows the executable is `bin/imapsync.exe`
instead of `bin/imapsync`. The bundled runtime is validated before use
(directory, manifest — including platform, architecture, artifact filename and
SHA-256 — and the self-contained binary) and failures are mapped to safe
application-level messages that never leak internal paths, environment dumps,
or loader diagnostics.

The self-contained runtime is the official `imapsync` binary on macOS x86_64
(ADR-012) and Windows x64 (ADR-016), and a self-built PAR::Packer binary on
macOS arm64 (ADR-013); it embeds its own Perl, modules, and OpenSSL. The
child-process environment is constructed deterministically in
`src/main/runtime/env.ts`, which removes developer Perl configuration
(`PERL5LIB`, `PERL_LOCAL_LIB_ROOT`, `PERL_MB_OPT`, `PERL_MM_OPT`, `PERL5OPT`,
`PERL6LIB`) and adds only the ADR-007 credential variables. On Windows the
inherited environment is otherwise preserved so system temp resolution, TLS,
DNS, networking, and Windows system DLL resolution continue to work.

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

Failure results carry a stable `MigrationFailureCode` and a concise, safe
message from the runtime adapter; no raw `Error`, stack trace, executable path,
or environment variable crosses IPC. The failure classification is based on
typed adapter state and a narrow, documented loader-failure signature — it never
parses free-form imapsync output to guess a category. The primary result screen
shows the concise message plus safe `username@host` identities; raw diagnostics
(which may contain absolute filesystem paths or loader output) are confined to a
collapsed `Technical details` section and never shown as the dominant failure
UI. It never renders passwords or complete credential-bearing objects.

## Code signing and notarization

Distributable artifacts are **ad-hoc signed but not Developer ID signed and not
notarized**. No Apple Developer identity or certificate is used.

- **Ad-hoc signing** (`codesign --sign -`, i.e. `identity: '-'` in
  electron-builder) is applied to the whole `.app` bundle so every Mach-O
  executable inside carries a valid signature. This is required by macOS on
  Apple Silicon: arm64 executables must be signed, and a bundle whose main
  executable is only linker-signed (with no sealed resources) is misreported by
  Gatekeeper as *damaged* rather than *unidentified developer*. Ad-hoc signing
  produces a consistent, valid signature so the normal Gatekeeper flow
  (`Privacy & Security → Open Anyway`) applies. It is not Apple Developer
  Program signing and provides no identity, no notarization, and no
  revocation-based trust.
- **Not notarized:** the app is not submitted to Apple's notary service.

The bundled `imapsync` runtime binary (`<resources>/runtime/<arch>/bin/imapsync`)
is excluded from the signature seal (`signIgnore`). The official x86_64 binary
cannot be re-signed by `codesign`; it is legitimately unsigned (x86_64 does not
require signing). The self-built arm64 binary is already linker-signed (ad-hoc)
at build time, which is sufficient for it to execute.

Unsigned/ad-hoc-signed apps are subject to Gatekeeper; users must explicitly
allow the app to run, and this must not be worked around by disabling macOS
security mechanisms. Developer ID signing and notarization are a deferred
follow-up task (see `tasks/backlog.md`). See ADR-015.

### Windows code signing and SmartScreen

The Windows NSIS installer and the installed application are **unsigned**: no
Authenticode certificate is applied (ADR-017). Microsoft Defender SmartScreen
is expected to warn about an unsigned installer/app on first run ("unknown
publisher"). This is a known distribution limitation, separate from malware
detection, and must not be bypassed by disabling Defender/SmartScreen or by
instructing users to disable Windows security. The installer does not request
administrator privileges (per-user install, `perMachine: false`).

Proper Authenticode signing is deferred, optional, client-funded release
hardening (mirroring the macOS Developer ID/notarization deferral).

## Packaged runtime

In a packaged build the application resolves and launches only the bundled
architecture-matched runtime — `Contents/Resources/runtime/<arch>` on macOS,
`resources/runtime/<arch>` on Windows; it never falls back to `PATH`,
`IMAPSYNC_EXECUTABLE`, Homebrew, Strawberry Perl, or system Perl. Runtime
validation runs before migration start and reports safe, non-leaking failures.
