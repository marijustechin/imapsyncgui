# Third-party runtime components

This document lists the third-party components intended to be bundled with the
packaged `imapsync` runtime, their versions, sources, and licenses. The table is
based on upstream documentation and the Homebrew `imapsync` formula's bundled
contents as observed on the development machine.

## Components

| Component | Version | Source | License | Redistribution |
| --------- | ------- | ------ | ------- | -------------- |
| imapsync | 2.314 | https://imapsync.lamiral.info/ | NLPL (No Limit Public License) | Permissive ("no limits to do anything"), but distributed commercially by the author |
| Perl | 5.34.x | https://www.perl.org/ | Artistic-1.0 or GPL-1.0-or-later (dual) | Permissive/copyleft dual; must ship license text |
| Mail::IMAPClient | bundled | https://metacpan.org/pod/Mail::IMAPClient | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| IO::Socket::SSL | bundled | https://metacpan.org/pod/IO::Socket::SSL | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| Net::SSLeay | bundled | https://metacpan.org/pod/Net::SSLeay | Artistic-2.0 or BSD | Permissive |
| Authen::NTLM | bundled | https://metacpan.org/pod/Authen::NTLM | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| Unicode::String | bundled | https://metacpan.org/pod/Unicode::String | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| Sys::MemInfo | bundled | https://metacpan.org/pod/Sys::MemInfo | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| Data::Uniqid | bundled | https://metacpan.org/pod/Data::Uniqid | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| JSON::WebToken | bundled | https://metacpan.org/pod/JSON::WebToken | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| File::Tail | bundled | https://metacpan.org/pod/File::Tail | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| IO::Tee | bundled | https://metacpan.org/pod/IO::Tee | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| Readonly | bundled | https://metacpan.org/pod/Readonly | Artistic-1.0 or GPL-1.0-or-later | Permissive/copyleft dual |
| OpenSSL | bundled | https://www.openssl.org/ | OpenSSL License + Apache-SSLeay | Permissive; must ship license text |

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
