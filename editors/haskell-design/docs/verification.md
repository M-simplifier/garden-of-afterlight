# Verification and provenance

Haskell Design 0.4.2 is distributed with Garden of Afterlight. It is derived
from the author's portable-dotfiles Haskell Design 0.4.1 source, including
the subsequent Neovim navigation and hover fixes. The private repository is
not a build dependency. This public copy has its own source, lockfile, tests,
compiler helper and MIT license.

The 0.4.2 changes include Windows UTF-8 diagnostics, normalized dirty-buffer
paths, portable test runners, and the public editor setup integration.
No personal configuration, credentials, private paths or caches are shipped.

The source-level tests use synthetic projects. The public distribution also
includes separate tests against Afterlight and real HLS sessions. See the
[verification record and reproduction instructions](https://github.com/M-simplifier/garden-of-afterlight/blob/main/editors/verification.md)
for the actual host, success criteria and skipped platform-specific checks.

Do not infer Windows/Linux coverage from historic macOS results, or full HLS
editing support from parser-only tests. GHC analysis, custom editor behavior,
and HLS/project integration have separate checks.
