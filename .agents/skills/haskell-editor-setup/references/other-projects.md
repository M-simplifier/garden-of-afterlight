# Connect another Haskell game

The endpoint is the user's actual game opened in their chosen editor. Preserve its
package names, layout, build system, flags, toolchain and existing settings. A viewer
installation is shared by an editor profile; project dependencies and GHC/HLS wiring
must be checked for each game. In WSL, SSH or a container, install and configure in
the extension host that runs the Haskell tools, not only on the desktop host.

## Obtain the viewer

Reuse an available Afterlight checkout containing `editors/haskell-design/`, or the
user's existing Haskell Design installation. If this skill was copied alone, its
public distribution is `https://github.com/M-simplifier/garden-of-afterlight.git`.
The tested viewer is 0.4.2 at commit `cef99befd267f58e9bef224218f76800a976df71`.
For a reproducible setup, clone it into an ignored local tools directory, check out
that revision, and run **only `node editors/setup.mjs build`** from that checkout.
The distribution's `prepare`, `configure`, standalone Neovim profile and `verify`
are Afterlight-specific. Do not use them to configure the target game.

Keep the MIT license and third-party notices with a copied distribution. A private
dotfiles repository is never needed. Node.js 22+ builds the packages. The outputs
are `editors/haskell-design/artifacts/haskell-design.vsix` and its Neovim archive.
Haskell Design is distributed as a VSIX, not a Marketplace extension: an extension
recommendation cannot install it. Install the VSIX into the intended profile and
install the official `haskell.haskell` extension for VS Code.

## Select compatible tools

Read the target's Cabal/Stack files, CI and build instructions. Reuse its selected
GHC and an HLS binary built for that GHC. The viewer's semantic analyzer supports
GHC **9.6.x**; 9.6.7 is a tested choice for a new project that needs the full viewer.
Do not downgrade an existing project to satisfy the analyzer. On other GHC versions,
keep declaration browsing and HLS editing available and report that inferred types
and GHC-confirmed IO/Pure are not supported by this analyzer. A compiler migration
is a separate project decision. The wrapper's build version is not the project's GHC.

Use [GHCup](https://www.haskell.org/ghcup/install/) and the
[HLS installation documentation](https://haskell-language-server.readthedocs.io/en/stable/installation.html)
for missing tools. Full support also needs the game's native build dependencies;
raylib/FFI libraries and generated modules do not disappear because the task is editing.

## A conventional Cabal package

The helper `../scripts/configure-cabal.mjs` (relative to this reference) handles a
single local Cabal package with ordinary libraries, executables and tests sharing
compatible language options. It reads a real **built** Cabal plan. It does not parse
arbitrary Cabal conditionals or replace Cabal, HLS or the project's build procedure.

1. Build the target's actual components with the selected GHC, intended flags and
   tests enabled when needed. For a simple package:
   `cabal build all --enable-tests --with-compiler=<absolute-ghc-path>`.
   Use the game's own build command if it needs extra flags or generated sources.
2. Write `editor-project.json` from the target's `.cabal` file and resolved build.
   The following is an example; substitute the actual package, directories,
   components, language extensions and flags:

   ```json
   {
     "version": 1,
     "package": "my-game",
     "cabalFile": "my-game.cabal",
     "ghcOptions": ["-XGHC2021"],
     "components": [
       { "path": "logic", "component": "lib", "sourceDirs": ["logic"] },
       { "path": "desktop", "component": "exe:my-game", "sourceDirs": ["desktop"] },
       { "path": "checks", "component": "test:laws", "sourceDirs": ["checks"] }
     ]
   }
   ```

   Optional `flags`, e.g. `["native", "-web"]`, must match the built plan. Each
   component may have additional `ghcOptions`. Include every local library used by
   the selected components. Map each source path to the component that edits it;
   more specific file paths can disambiguate shared folders. Source directories,
   default extensions and generated include paths must agree with the real build.
3. From the target root, run:

   ```sh
   node .agents/skills/haskell-editor-setup/scripts/configure-cabal.mjs --ghc <absolute-ghc-path> --hls <absolute-hls-path>
   ```

   `--project`, `--recipe`, `--cabal` and `--builddir` are available when paths differ.
   The defaults are the current directory, `editor-project.json`, PATH Cabal and
   `dist-newstyle`. Proposals appear in `.runtime/haskell-editor/generated/`.
   Inspect them, then rerun with `--apply` within the authorized setup scope.

   The helper creates `.haskell-design.json`, `hie.yaml`, `cabal.project.local`,
   `.vscode/settings.json` and `.vscode/extensions.json`. It uses the plan's exact
   dependency IDs. Same-package libraries are read as live source modules, so an
   edit is not hidden behind an old compiled library. No global defaults are changed.
4. Existing different files cause refusal **before any target settings are written**.
   Back up and merge the proposals, preserving JSONC comments, unrelated settings,
   existing editor associations, Cabal options and flags. Use `--apply --keep-existing`
   only after the merge; it preserves existing files but cannot validate their meaning.
5. Add host-specific outputs to the target's ignore rules: `.runtime/`,
   `.haskell-design.json`, `cabal.project.local`, `.vscode/settings.json`, build output
   and any local viewer-source checkout. Keep the portable recipe, skill and user-facing
   setup instructions in Git. An existing tracked settings file needs a deliberate
   split between portable settings and local paths; do not commit machine PATH values.
6. Open **the target folder itself** with VS Code (`code .`), using the profile where
   the VSIX and official Haskell extension were installed. Grant workspace trust only
   for a project the user trusts. Wait for HLS to load, then perform the checks below.

For Neovim, install the built viewer directory/archive into the chosen profile's
runtime path and use its documented `require('haskell-design').setup(...)`. Reuse
the user's HLS client, or configure one with the target's root, selected HLS command
and GHC/Cabal PATH. Do not copy the `afterlight_editor` integration module. Its root
and component exclusions belong to Afterlight. Avoid attaching two HLS clients.

## When the helper does not fit

Multi-package Cabal workspaces, Stack, custom preprocessors, incompatible per-module
language settings and separate Wasm compilers need project-specific wiring. Keep
the working HLS cradle; use [HLS project configuration](https://haskell-language-server.readthedocs.io/en/stable/configuration.html#configuring-your-project-build).
Adapt `.haskell-design.json` using the distribution's
`editors/haskell-design/src/projectConfig.ts` schema and `editors/haskell-design/README.md`.
Its `components` select the longest matching path; an unmapped file or
`unsupportedReason` prevents GHC verification. Source-level IO hints can still appear,
but failed analysis must never become confirmed Pure. Exclude vendored
tools, generated trees and unsupported targets from `audit`, while retaining the
game's actual native library, host and tests. Preserve separate native/Wasm builds.

After GHC, dependencies, flags, language options or component layout changes, rebuild
and regenerate/merge the wiring. `cabal.project.local` settings must agree with the
plan; the helper does not prove that a manually retained configuration is correct.

## Verify the target, not the installation

In the requested editor/profile, check the game's own:

- `.hs` opening in the design view; data definitions, explicit and inferred signatures.
- Pure rule module and IO host with GHC-confirmed status; imported local libraries.
- HLS hover, definition and return navigation, references, completion and formatting.
- Library, executable and test components loading without type errors.
- A temporary unsaved type error being diagnosed, switching design/source, Undo, and
  the diagnostic clearing. Leave source files unchanged after the check.

Change a local library in a temporary verification copy to ensure dependent analysis
uses current source rather than a stale built interface. Distinguish HLS completion
from GHC inference in the design view. CPP/TH may work in HLS while this analyzer
remains unknown. Pure is an IO-usage hint, not a proof. On Windows, keep HLS
cross-module rename disabled until complete edits have been verified for that version.

Report the actual editor, compiler, checked components and remaining unsupported
layers. Provide the folder to open and the next setup action for a fresh machine.
