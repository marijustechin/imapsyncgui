# TASK-011 — Windows x64 application and self-contained imapsync runtime

## Goal

Extend imapSyncGUI to Windows and produce a real downloadable Windows x64 `.exe` installer that works on a normal Windows machine without requiring the user to install:

- Node.js;
- pnpm;
- Perl;
- imapsync;
- Git;
- WSL;
- Cygwin;
- MSYS2;
- Chocolatey;
- Scoop;
- or any developer tooling.

The Windows application must preserve the existing security model and user workflow of the macOS application.

Initial Windows scope is:

```text
Windows x86_64 only
```

Windows ARM64 is out of scope for this task.

---

# Context

The macOS application currently has:

- Electron + React + TypeScript;
- secure context-isolated renderer;
- narrow typed IPC;
- real IMAP connection testing;
- TLS and STARTTLS support;
- migration start / streaming / cancellation / results;
- lifecycle race protection;
- credential sanitization;
- explicit `imapsync --nolog`;
- controlled temporary working directory;
- self-contained x86_64 and arm64 macOS runtimes;
- architecture-specific release packaging.

TASK-010 remains incomplete because physical macOS E2E testing is still pending.

Windows support is a new platform target and must not invalidate or weaken the existing macOS implementation.

---

# Task tracking

Before starting implementation:

1. preserve the full current TASK-010 specification;
2. record TASK-010 as:

```text
Paused — awaiting manual physical macOS E2E
```

3. do not mark TASK-010 Complete;
4. make TASK-011 the single active task in `tasks/current.md`;
5. preserve TASK-010 so it can be restored after TASK-011.

After TASK-011 completes, restore TASK-010 as the active pending manual task unless another explicitly approved task replaces it.

---

# Supported Windows target

Target:

```text
Windows 10/11 x86_64
```

The primary release artifact must be a normal `.exe` installer.

Preferred packaging:

```text
NSIS installer via electron-builder
```

A portable build or ZIP may optionally be produced for diagnostics, but it is not a substitute for the installer.

Expected release artifact naming should be architecture-explicit, for example:

```text
imapSyncGUI-0.1.0-windows-x64-setup.exe
```

Exact naming may follow existing versioning conventions.

---

# Part 1 — Audit cross-platform assumptions

Before changing code, inspect the current implementation for macOS-specific assumptions.

Review at minimum:

- filesystem paths;
- path separators;
- executable resolution;
- temporary directories;
- process working directory;
- process spawning;
- packaged resource paths;
- Electron packaging configuration;
- application lifecycle;
- shell assumptions;
- file permissions;
- runtime validation;
- architecture naming;
- smoke-test tooling;
- scripts invoking macOS-only commands.

Identify which parts are:

```text
application runtime logic
```

versus:

```text
macOS packaging / verification logic
```

Do not duplicate generic application logic unnecessarily.

Prefer platform-specific adapters/helpers only where the operating systems genuinely differ.

---

# Part 2 — Research Windows imapsync distribution

Determine the safest maintainable way to ship a self-contained `imapsync` runtime for Windows x64.

Research current upstream imapsync distribution options.

Prefer, in order:

1. official upstream standalone Windows x64 executable;
2. reproducibly built self-contained upstream-compatible executable;
3. another evidence-backed bundled runtime strategy requiring no end-user dependencies.

Do not silently download arbitrary third-party binaries.

For any external runtime artifact record:

- upstream source;
- version;
- architecture;
- release URL/source;
- SHA-256;
- license;
- dependency model.

Do not assume the macOS PAR::Packer strategy automatically applies unchanged to Windows.

Research and decide based on evidence.

Document the decision as an ADR.

---

# Part 3 — Runtime architecture model

Extend runtime architecture handling to support Windows x64.

Conceptually the runtime matrix should support:

```text
darwin-x64
darwin-arm64
win32-x64
```

Do not rename existing macOS runtime directories unless necessary.

Packaged Windows runtime should live under an architecture-specific application resource location equivalent to:

```text
resources/runtime/win32-x64/
```

or another clearly documented deterministic path.

Packaged mode must never fall back to:

- PATH;
- locally installed imapsync;
- Strawberry Perl;
- system Perl;
- WSL;
- developer environment variables.

Development mode may retain narrowly controlled developer overrides if already supported, but packaged behavior must be deterministic.

---

# Part 4 — Windows runtime provenance manifest

Extend the existing runtime manifest/provenance model for Windows.

Record at minimum:

- platform;
- architecture;
- imapsync version;
- runtime artifact filename;
- artifact SHA-256;
- upstream/source information;
- build method if self-built;
- relevant embedded runtime version if applicable.

Runtime validation must reject:

- missing runtime;
- wrong platform;
- wrong architecture;
- malformed manifest;
- unexpected executable type.

Do not simply print architecture information.

Assert it.

---

# Part 5 — Windows executable validation

Use Windows-appropriate tooling in native Windows CI.

Verify the bundled executable is a Windows x64 PE executable.

Use reliable native/available tooling such as PowerShell/.NET/Visual Studio tooling or another evidence-backed method.

Do not use filename extension alone as architecture proof.

The verification must establish:

```text
PE executable
x86_64 / AMD64
```

---

# Part 6 — Process launching

Preserve the core security invariant:

```text
no shell
```

Continue using direct process spawning.

Conceptually:

```ts
spawn(executable, args, options);
```

Do not use:

```text
cmd.exe
powershell.exe
shell: true
```

to launch imapsync.

Passwords must remain outside argv.

Preserve the existing credential environment-variable model unless Windows runtime evidence proves it incompatible.

If changes are necessary, document the security tradeoff before implementation.

---

# Part 7 — Windows environment sanitization

Review the existing sanitized runtime environment for cross-platform correctness.

Continue removing environment values that could influence bundled runtime behavior unexpectedly.

Add Windows-specific sanitization only where justified.

Do not pass the entire uncontrolled development environment if a deterministic minimal environment is feasible.

Preserve required Windows variables needed for normal executable operation.

Do not break:

- system temp resolution;
- TLS;
- DNS;
- networking;
- Windows system DLL resolution.

Add tests for the final environment policy.

---

# Part 8 — Temporary/log behavior

Preserve TASK-009D log protections.

Windows runtime must:

- use `--nolog`;
- use an application-controlled temp/work path;
- not write `LOG_imapsync` into the app directory;
- not write `W` into the app directory;
- not write logs into the user's current working directory;
- never derive temp/log paths from renderer input.

Use an appropriate OS temporary directory.

Do not write inside:

```text
Program Files
```

or the installed application resources.

Cleanup app-owned temporary data where safe.

Failure to clean temporary files must not crash the application.

---

# Part 9 — Connection testing

The existing Node-based IMAP connection testing should remain platform-independent.

Verify on Windows:

- implicit TLS;
- STARTTLS;
- authentication failures;
- timeout handling;
- DNS failures.

Do not introduce a second Windows-specific IMAP implementation unless technically required.

STARTTLS must retain the corrected sequence:

```text
greeting
→ STARTTLS
→ tagged OK
→ TLS upgrade
→ CAPABILITY
→ LOGIN
```

Credentials must never be sent before TLS completion in STARTTLS mode.

---

# Part 10 — Renderer behavior

Keep the same application workflow.

Do not create a separate Windows UI.

Required behavior remains:

- source server form;
- destination server form;
- connection tests;
- start migration;
- streamed output;
- cancel;
- success/failure/cancelled terminal state;
- repeat migration flow.

Only make platform-specific UI changes where actually necessary.

---

# Part 11 — Windows packaging

Extend `electron-builder` configuration to produce Windows x64 packaging.

Preferred target:

```text
NSIS
```

Build:

```text
Windows x64 only
```

Do not add ARM64 or 32-bit builds.

The packaged application must include the Windows runtime outside ASAR if required by executable execution.

Ensure the runtime executable is not compressed/stored in a way that prevents launching.

---

# Part 12 — Installer UX

Use a conventional Windows installer.

The installer should:

- install the application into an appropriate user/system application location;
- create Start Menu integration where standard;
- provide normal uninstall support;
- launch without requiring a terminal.

Do not add complex installer customization.

A default professional electron-builder NSIS experience is sufficient.

Do not request administrator privileges unless actually necessary.

Prefer per-user installation if it avoids unnecessary elevation and is technically appropriate.

Document the final choice.

---

# Part 13 — Windows code signing status

No paid Windows code-signing certificate is assumed available.

Therefore the first Windows E2E release may be unsigned.

Document explicitly:

- installer/application is unsigned;
- Microsoft Defender SmartScreen may warn;
- this is a known distribution limitation;
- it is separate from malware detection;
- proper Authenticode/code-signing can be added later as optional/client-funded release hardening.

Do not:

- bypass SmartScreen programmatically;
- disable Defender;
- instruct users to disable Windows security;
- falsely describe unsigned artifacts as trusted/signed.

If electron-builder applies any internal/default signing behavior, document exactly what it does.

---

# Part 14 — Windows CI

Add native Windows GitHub Actions verification.

Use an appropriate Windows x64 runner.

The CI must prove:

```text
Node process.arch = x64
Node process.platform = win32
```

Then execute:

1. dependency installation;
2. `pnpm verify`;
3. Windows runtime acquisition/build;
4. runtime manifest validation;
5. runtime architecture validation;
6. runtime self-test;
7. Electron Windows x64 packaging;
8. packaged application smoke test;
9. installer existence/structure verification;
10. artifact upload.

Do not claim Windows support based on cross-compilation from macOS alone.

Native Windows execution evidence is required.

---

# Part 15 — Runtime self-test

Create or extend runtime self-test tooling to support:

```text
win32-x64
```

The self-test must execute the actual packaged Windows imapsync runtime.

It must prove at minimum that:

- executable starts;
- expected imapsync version is reported;
- architecture/platform matches manifest;
- bundled runtime does not depend on separately installed imapsync;
- runtime works under sanitized environment;
- no developer PATH dependency is required.

Where practical, perform an offline imapsync test mode equivalent to existing macOS self-testing.

Do not require real mailbox credentials in CI.

---

# Part 16 — Packaged app smoke test

Test the actual packaged Windows application layout.

The smoke test must resolve runtime from the installed/packaged resources location, not from the repository runtime directory.

Prove the packaged app can invoke its bundled runtime.

Do not let PATH fallback make the smoke test pass.

---

# Part 17 — Installer verification

After producing the installer, verify the actual `.exe` artifact.

Record:

- filename;
- application version;
- platform;
- architecture;
- git commit;
- imapsync version;
- SHA-256.

Where practical in CI:

- install silently or normally into a disposable location;
- verify installed files;
- run packaged smoke against installed app;
- uninstall cleanly.

Do not rely solely on electron-builder reporting success.

---

# Part 18 — Real Windows E2E test preparation

Create:

```text
docs/e2e-windows.md
```

Model it after the macOS E2E document, but use Windows-specific behavior.

Include fields:

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

Do not claim physical Windows E2E completion during this task unless it actually occurs.

---

# Part 19 — Real mailbox E2E criteria

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

TASK-011 may prepare this workflow without fabricating the human test.

---

# Part 20 — GitHub pre-release

After native Windows CI and packaged verification pass, publish a new GitHub pre-release.

Do not silently replace existing macOS releases.

Use a new immutable release tag, for example:

```text
v0.1.0-e2e.3
```

or another clearly versioned pre-release.

Prefer one release containing all currently useful test artifacts:

```text
macOS Intel DMG
macOS Apple Silicon DMG
Windows x64 setup EXE
SHA256SUMS.txt
```

If preserving the previously proven macOS assets in the same new release creates provenance ambiguity, publishing a Windows-specific test pre-release is acceptable.

Document the decision.

---

# Part 21 — Public artifact re-download verification

After publishing, download the Windows installer back from the normal GitHub Releases page/API.

Verify the exact public artifact:

- SHA-256 matches;
- valid PE executable;
- x64 architecture;
- installer can execute in native Windows CI/test environment.

Do not validate only the pre-upload local artifact.

---

# Part 22 — Documentation

Update as appropriate:

- `README.md`;
- `docs/architecture.md`;
- `docs/security.md`;
- `docs/runtime.md`;
- `docs/testing.md`;
- `docs/decisions.md`;
- `docs/progress.md`;
- `docs/third-party-licenses.md`;
- `docs/e2e-windows.md`;
- runtime/release documentation.

Update the product/platform documentation so it no longer implies macOS-only support once Windows packaging is actually proven.

Do not claim Windows clean-machine verification unless physical/manual evidence exists.

---

# Security regression requirements

Windows support must preserve all existing protections:

- `contextIsolation: true`;
- `nodeIntegration: false`;
- sandboxed renderer where supported by current architecture;
- narrow preload API;
- explicit IPC channels;
- runtime validation;
- shell-free process execution;
- passwords absent from argv;
- credential redaction;
- bounded streamed output;
- controlled temp directory;
- persistent imapsync logs disabled;
- TLS certificate validation;
- no renderer-controlled filesystem paths;
- no generic IPC bridge.

Do not weaken the macOS security model to make Windows easier.

---

# macOS regression protection

TASK-011 must not regress:

```text
darwin-x64
darwin-arm64
```

At minimum:

```bash
pnpm verify
```

must remain green.

If shared runtime or packaging logic materially changes, rerun the strongest relevant macOS verification.

If arm64 shared runtime invocation is affected, rerun native arm64 CI.

Do not unnecessarily rebuild proven macOS runtimes when Windows-only code is isolated.

---

# Tests

Add deterministic tests for at least:

- Windows platform/architecture mapping;
- runtime path resolution;
- packaged resolution with `win32-x64`;
- manifest validation;
- executable naming;
- runtime environment handling;
- temp/cwd behavior;
- Windows argument generation;
- credential exclusion from argv;
- no shell execution;
- installer artifact naming;
- platform-specific packaging configuration.

Do not add meaningless tests solely to increase test count.

---

# Verification

Run:

```bash
pnpm verify
```

Current baseline is:

```text
192 tests
```

All existing tests must remain green.

Require successful native Windows CI before declaring TASK-011 complete.

---

# Acceptance criteria

TASK-011 is complete only when:

- current codebase runs through `pnpm verify`;
- Windows x64 runtime strategy is researched and documented;
- runtime provenance is recorded;
- bundled Windows runtime is self-contained for the end user;
- packaged mode never depends on PATH-installed imapsync/Perl;
- runtime is verified as Windows x64;
- runtime self-test passes natively on Windows;
- existing secure spawn model is preserved;
- passwords remain outside argv;
- log/temp protections remain intact;
- Windows x64 Electron app builds successfully;
- a Windows x64 NSIS `.exe` installer is produced;
- installer contains the correct packaged application/runtime;
- native Windows GitHub Actions CI passes;
- packaged/installed runtime smoke test passes;
- final installer SHA-256 is recorded;
- installer is published to a GitHub pre-release;
- exact public installer is re-downloaded and verified;
- `docs/e2e-windows.md` exists;
- unsigned/SmartScreen limitation is documented honestly;
- macOS behavior is not regressed;
- no Windows ARM64 or 32-bit scope creep is introduced;
- TASK-010 remains incomplete and preserved for physical macOS E2E.

---

# Completion lifecycle

When TASK-011 is complete:

1. archive the full specification as:

```text
tasks/done/TASK-011.md
```

2. update `docs/progress.md`;
3. update backlog with only concrete remaining Windows limitations;
4. restore TASK-010 as active if it is still awaiting manual macOS E2E;
5. do not automatically start Windows physical E2E;
6. do not mark Windows as clean-machine verified without real human/native evidence.

## Status

In progress.
