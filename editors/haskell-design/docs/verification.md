# Verification and provenance

Haskell Design 0.6.0 is distributed with Garden of Afterlight. It is derived
from the author's portable-dotfiles Haskell Design 0.4.1 source, including
the subsequent Neovim navigation and hover fixes. The private repository is
not a build dependency. This public copy has its own source, lockfile, tests,
compiler helper and MIT license.

Version 0.6.0 moves declaration extraction and the standalone reader CLI into
a shared Haskell core, using the same Haskell grammar through native Tree-sitter.
Editor UI, watching and caching remain in the TypeScript/Lua adapters. Packages
now contain a native executable and are specific to the extension host's OS/CPU.
See the [architecture and measured comparison](native.md).

The public 0.4.2 release previously added Windows UTF-8 diagnostics, normalized
dirty-buffer paths, portable test runners, and the editor setup integration.
No personal configuration, credentials, private paths or caches are shipped.

The source-level tests use synthetic projects. The public distribution also
includes separate tests against Afterlight and real HLS sessions. See the
[verification record and reproduction instructions](https://github.com/M-simplifier/garden-of-afterlight/blob/main/editors/verification.md)
for the actual host, success criteria and skipped platform-specific checks.

The 0.6.0 native distribution was verified on Windows x64. Do not infer coverage
on other operating systems from historic parser results, or full HLS editing
support from parser-only tests. GHC analysis, custom editor behavior, and
HLS/project integration have separate checks.
