# TASK-014 — Fix macOS arm64 SSL runtime portability and align migration UX with Windows

## Goal

Resolve the real-world macOS Apple Silicon migration failure discovered during
clean-machine testing and bring the macOS migration feedback/UX in line with
the recently improved Windows behavior.

This is a release-blocking task.

Do not apply a workaround that requires the end user to install Homebrew,
OpenSSL, Perl, imapsync, Rosetta, or developer tooling.

---

## Real-world evidence

Testing was performed on Eimantas's Mac.

### Case A — succeeded

Mailbox:

eimantas@textradeuk.co.uk

The migration completed successfully.

### Case B — failed

Source:

info@alfasis.lt@dracena.serveriai.lt

Destination:

info@alfasis.lt@space-hosting-node-001.bacloud.online

The application launched normally and the connection tests succeeded, but the
actual migration failed with exit code 2.

Observed runtime failure:

    Can't load .../Net/SSLeay/SSLeay.bundle for module Net::SSLeay

and:

    Library not loaded:
    /opt/homebrew/opt/openssl@3/lib/libssl.3.dylib

The failing component is extracted by PAR::Packer into a temporary `par-...`
directory.

This means the current arm64 packaged runtime is not fully relocatable for all
real migration code paths.

Important:

The successful textradeuk migration proves that the packaged application and
arm64 runtime are not universally broken.

Investigate why one real migration succeeds while another enters an SSL/TLS
code path that exposes the Homebrew OpenSSL dependency.

Do not assume the two migrations exercised the same runtime/module path.

---

# Part 1 — Reproduce and understand the difference

## Required investigation

Determine why:

- `eimantas@textradeuk.co.uk` migration succeeds;
- `info@alfasis.lt` migration fails while loading `Net::SSLeay`.

Inspect, without exposing credentials:

- source security mode;
- destination security mode;
- ports;
- whether implicit TLS / STARTTLS / plaintext differ;
- which imapsync Perl modules are loaded in each scenario;
- whether Net::SSLeay is loaded lazily only on the failing path;
- whether one server causes SSL/TLS negotiation behavior not exercised by the
  successful migration.

Do not infer the answer from server names alone.

Use controlled tests or fixtures where possible.

Do not commit or log real mailbox passwords.

## Expected outcome

Document exactly why the existing automated/native smoke tests allowed the
faulty runtime to pass.

Most likely verification gap to confirm or reject:

- the main PAR executable was inspected;
- but native modules embedded/extracted by PAR were not fully inspected;
- and the smoke/self-test did not exercise the SSL-dependent path that loads
  `Net::SSLeay::SSLeay.bundle`.

Do not state this as fact until verified.

---

# Part 2 — Fix the arm64 runtime

## Requirement

The macOS arm64 packaged runtime must work without any runtime dependency on:

- `/opt/homebrew`;
- `/usr/local/Cellar`;
- `/opt/local`;
- Homebrew OpenSSL;
- system Perl;
- developer CPAN paths;
- developer-machine build directories;
- Rosetta;
- user-installed runtime dependencies.

## Specifically fix

The runtime currently contains or extracts:

`Net::SSLeay::SSLeay.bundle`

which references:

`/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib`

Resolve this properly.

Acceptable strategies include:

1. build/link Net::SSLeay against bundled relocatable OpenSSL;
2. bundle required libssl/libcrypto and rewrite Mach-O references using
   `@loader_path` / `@rpath`;
3. produce a PAR::Packer artifact in which SSL dependencies are genuinely
   self-contained;
4. another reproducible solution that satisfies the same portability proof.

Do not solve this by:

- installing Homebrew on the target Mac;
- adding `/opt/homebrew` to PATH;
- depending on the CI runner's Homebrew installation;
- falling back to system Perl/OpenSSL;
- using Rosetta;
- suppressing the error.

---

# Part 3 — Strengthen native artifact validation

Current validation is insufficient if it only inspects the top-level
`imapsync` executable.

Add validation for native components embedded inside the PAR artifact.

## Validation must inspect

At minimum:

- `Net::SSLeay::SSLeay.bundle`;
- all Mach-O `.bundle` files;
- all bundled/extracted `.dylib` files;
- other native Perl modules included by PAR.

Where technically appropriate, extract/unpack the PAR artifact during CI and
inspect its native contents.

For every native component, check:

- architecture is `arm64`;
- `otool -L` dependencies;
- no build-machine-only library references;
- no Homebrew runtime references.

CI must fail if any runtime dependency contains paths such as:

    /opt/homebrew
    /usr/local/Cellar
    /opt/local
    /Users/
    runner build/cache paths

unless a path is explicitly documented as a normal macOS system dependency.

Do not rely only on:

    otool -L imapsync

---

# Part 4 — Strengthen runtime self-test

The arm64 smoke/self-test must exercise the SSL stack actually required by real
mailbox migration.

It must prove offline, where possible:

- `Net::SSLeay` loads;
- `IO::Socket::SSL` loads;
- OpenSSL library resolution succeeds;
- the runtime does not fall back to Homebrew/system dependencies;
- the process executes natively as arm64.

The test environment must deliberately remove developer conveniences.

At minimum:

- restricted PATH;
- cleared Perl-related environment variables;
- no runtime reliance on Homebrew paths;
- no Rosetta/x64 fallback.

If an offline module-loading test is sufficient to exercise this dependency,
prefer it over using real mailbox credentials.

---

# Part 5 — Real migration regression coverage

Add a deterministic regression test representing the distinction discovered
in production testing.

We need coverage for migration configurations that exercise:

- plain/connection path already known to work;
- TLS-dependent path that loads Net::SSLeay;
- STARTTLS path where applicable.

Do not require real external mailbox credentials in `pnpm verify`.

Native CI may use only credential-free runtime tests unless explicit safe test
accounts already exist in project infrastructure.

---

# Part 6 — macOS migration UX improvements

Align macOS migration feedback with the recent Windows UX improvements.

The current failed-migration screen is not acceptable for an end user because
the dominant UI exposes a large Perl/module loader stack trace.

The product already distinguishes success / failure / cancellation and keeps
diagnostic output available separately. Preserve that model.

## Running migration view

Make the migration screen clearly show:

- source mailbox;
- destination mailbox;
- current migration state;
- useful user-facing progress/feedback;
- cancel action;
- diagnostic details separately.

Preserve incremental output ordering and the existing bounded output behavior.

Do not infer authoritative completion from log text.

Runtime lifecycle remains authoritative.

## Failure view

The primary failure message must be concise and user-facing.

For a runtime dependency failure similar to the observed case, use an
application-level message conceptually like:

    Migration could not start correctly because the bundled migration runtime
    failed to load a required component.

or a better concise equivalent.

Do not show as the primary error:

- Perl stack traces;
- absolute filesystem paths;
- `/opt/homebrew/...`;
- PAR cache paths;
- environment values;
- raw loader diagnostics.

The existing sanitized diagnostic output may remain available in a clearly
secondary section such as:

    Technical details

Prefer a collapsed/secondary diagnostic presentation if that matches the
recent Windows implementation.

Do not remove useful diagnostics entirely.

## Exit-code handling

Do not present only:

    Migration exited with code 2.

Exit code may appear in technical details, but the main message must map to a
stable application-level category.

Introduce/refine typed categories only where the runtime can classify them
reliably.

At minimum review whether the current contract can distinguish:

- bundled runtime invalid/unusable;
- runtime dependency loading failure;
- migration process failure;
- connection/authentication-related failure;
- cancellation;
- unexpected internal failure.

Do not parse arbitrary free-form imapsync logs to invent unreliable
classifications.

## Success UX

Preserve the improved Windows-style completion feedback:

- clear success heading;
- safe source/destination identity;
- completed state;
- action to start another migration;
- diagnostics/details remain secondary.

Do not claim migrated message counts or bytes unless supplied by a typed,
reliable runtime result.

## Retry / start another migration

After failure or success:

- allow returning to the migration form;
- keep endpoint field values where useful;
- invalidate old successful connection tests;
- require fresh connection tests before a new migration;
- clear previous runtime/result state;
- prevent old output/listeners from contaminating the next migration.

---

# Part 7 — Packaging/release regression protection

Preserve all existing guarantees:

- no shell execution;
- passwords outside argv;
- narrow preload IPC;
- no credential persistence;
- sanitized renderer output;
- controlled imapsync logging/temp paths;
- no PATH fallback in packaged mode;
- no Rosetta;
- architecture-specific macOS builds.

Do not regress x86_64 behavior while fixing arm64.

The x86_64 runtime must remain unchanged unless a shared validation improvement
requires a harmless adjustment.

---

# Verification

Run:

    pnpm verify

Then run the full native arm64 pipeline on the GitHub-hosted Apple Silicon
runner.

Required native evidence:

1. runner confirmed arm64;
2. arm64 runtime rebuilt;
3. embedded PAR native components inspected;
4. Net::SSLeay loads successfully;
5. IO::Socket::SSL loads successfully;
6. no Homebrew runtime library references remain;
7. restricted-environment runtime self-test passes;
8. arm64 Electron package builds;
9. packaged runtime smoke test passes from inside `.app`;
10. application launches;
11. migration UX tests pass;
12. x86_64 deterministic regression tests remain green.

If runtime invocation/build behavior changes materially, rerun the strongest
available x86_64 packaged smoke verification as well.

---

# Release blocker

Do not publish or mark the arm64 release as production-ready until the
Net::SSLeay/OpenSSL portability issue is fixed and native CI proves it.

Do not mark this task complete merely because `pnpm verify` passes.

A green unit-test suite is insufficient.

---

# Documentation

Update as relevant:

- README.md
- docs/runtime.md
- docs/architecture.md
- docs/security.md
- docs/testing.md
- docs/progress.md
- docs/decisions.md if a meaningful new runtime/build decision is made
- tasks/backlog.md

Document honestly:

- the real clean-machine failure;
- why the previous verification missed it;
- the fix;
- how embedded PAR native components are now inspected;
- how SSL loading is now exercised in CI;
- native arm64 verification result.

---

# Completion report

Report explicitly:

- root cause;
- why textradeuk migration succeeded while alfasis migration failed;
- exact runtime fix;
- OpenSSL resolution strategy;
- Net::SSLeay dependency inspection result;
- arm64 native CI run/result;
- packaged smoke result;
- UI changes made;
- `pnpm verify` test count/result;
- x86_64 regression status;
- generated artifacts;
- signing status;
- notarization status;
- commit hash;
- push result.

Do not hide failed checks or remaining limitations.
