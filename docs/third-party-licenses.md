# Third-party runtime components

This document lists the third-party components bundled with the packaged
`imapsync` runtime, their versions, sources, and licenses. The table is based on
upstream documentation and the Homebrew `imapsync` formula's bundled contents.

The x86_64 runtime embeds components from the official
`imapsync_bin_Darwin_x86_64` binary (imapsync 2.314, Perl ~5.34). The arm64
runtime is a self-built PAR::Packer binary (ADR-013) embedding the current
upstream `imapsync` script (2.324 at build time), the current Homebrew `perl`
(5.42 at build time), and OpenSSL 3; exact versions are recorded in the runtime
manifest.

## Components

| Component | x86_64 version | arm64 version | Source | License |
| --------- | -------------- | ------------- | ------ | ------- |
| imapsync | 2.314 (binary) | 2.324 (script, recorded at build) | https://imapsync.lamiral.info/ | NLPL (No Limit Public License) |
| Perl | ~5.34 (embedded) | 5.42 (embedded) | https://www.perl.org/ | Artistic-1.0 or GPL-1.0-or-later (dual) |
| OpenSSL | embedded | 3.x (embedded) | https://www.openssl.org/ | OpenSSL License + Apache-SSLeay |
| Mail::IMAPClient | bundled | bundled | https://metacpan.org/pod/Mail::IMAPClient | Artistic-1.0 or GPL-1.0-or-later |
| IO::Socket::SSL | bundled | bundled | https://metacpan.org/pod/IO::Socket::SSL | Artistic-1.0 or GPL-1.0-or-later |
| Net::SSLeay | bundled | bundled | https://metacpan.org/pod/Net::SSLeay | Artistic-2.0 or BSD |
| Authen::NTLM | bundled | bundled | https://metacpan.org/pod/Authen::NTLM | Artistic-1.0 or GPL-1.0-or-later |
| Unicode::String | bundled | bundled | https://metacpan.org/pod/Unicode::String | Artistic-1.0 or GPL-1.0-or-later |
| Sys::MemInfo | bundled | bundled | https://metacpan.org/pod/Sys::MemInfo | Artistic-1.0 or GPL-1.0-or-later |
| Data::Uniqid | bundled | bundled | https://metacpan.org/pod/Data::Uniqid | Artistic-1.0 or GPL-1.0-or-later |
| JSON::WebToken | bundled | bundled | https://metacpan.org/pod/JSON::WebToken | Artistic-1.0 or GPL-1.0-or-later |
| File::Tail | bundled | bundled | https://metacpan.org/pod/File::Tail | Artistic-1.0 or GPL-1.0-or-later |
| IO::Tee | bundled | bundled | https://metacpan.org/pod/IO::Tee | Artistic-1.0 or GPL-1.0-or-later |
| Readonly | bundled | bundled | https://metacpan.org/pod/Readonly | Artistic-1.0 or GPL-1.0-or-later |

## Notes and blockers

- The components listed above are embedded in the official self-contained
  `imapsync_bin_Darwin_x86_64` binary (PAR::Packer), so the module set/versions
  are those bundled by the upstream binary for `imapsync` 2.314.
- **License texts are shipped** with the runtime under
  `runtime/darwin-x64/licenses/` (NLPL, Perl Artistic, Perl GPL-1.0, OpenSSL).
- **`imapsync` distribution model:** the license is permissive (NLPL), but the
  author distributes `imapsync` commercially. Redistribution of the binary in a
  distributable application should still be reviewed with the author/upstream
  before a public release; the license itself imposes no restriction.
- **OpenSSL redistribution** is permitted under the OpenSSL and Apache-SSLeay
  licenses; both license texts are included.

Do not treat this table as legal advice; it is a component inventory for the
build/packaging step.
