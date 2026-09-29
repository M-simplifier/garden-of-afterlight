---
name: haskell-editor-setup
description: "Set up or repair Haskell Design and GHC/HLS support in VS Code or Neovim, for Afterlight or another Haskell game, including projects made with fp-gamedev. Connect the target project's compiler, Cabal components and editor, and verify real code without private dotfiles."
---

# Haskell editor setup

Deliver a working reading and editing environment in the user's chosen editor:
declarations and inferred types, IO/Pure hints, implementation folding, navigation,
source/Undo round trips, design diffs, and HLS completion/diagnostics/formatting.
Installing the extension alone is not completion.

For AI code reading, version 0.6.0 ships the native Haskell executable
`dist/haskell-design` (`.exe` on Windows): `map`, `outline`, and `show`.
Its built syntax reader needs neither Node nor GHC. Building from source needs
GHC 9.6.7, Cabal, a C toolchain, Node 22+, tar and strip. The Windows GHCup build
uses its bundled LLVM strip. An editor installation is not needed just to read.
Follow the distribution's `docs/reader.md` or the copied
[code-reading reference](../fp-gamedev/references/code-reading.md).

## Choose the target project

The project being edited and the repository distributing the viewer may be different.
Inspect the **target** project's build files before choosing a setup route.

- **Afterlight itself:** use the Afterlight procedure below.
- **A new or existing game, including one made with `fp-gamedev`:** read
  [other-projects](references/other-projects.md) and follow that route instead.
  It includes a public, pinned viewer source and a helper shipped inside this skill.
  Copy this entire skill directory, not only `SKILL.md`, when bringing it to a new repo.

Do not run Afterlight's `prepare` / `configure` commands in a different game, impose
its package/module names, or copy its generated host paths. Opening a folder does
not install a VSIX or prepare that project's Haskell dependencies.

## Afterlight: locate and inspect

Find the checkout containing `garden-of-afterlight.cabal` and `editors/setup.mjs`.
Read `editors/README.md` and `editors/setup.md` there; paths in this skill are relative
to that checkout. These files and the bundled `editors/haskell-design/` source are
the complete distribution; no private repository, personal skill, or dotfiles is needed.

Determine the chosen editor from the request or current environment. Inspect OS,
Node/npm, Git, GHC, Cabal, HLS, and the existing editor configuration. Run
`node editors/setup.mjs doctor`. Preserve existing settings and toolchain defaults.
When both editors are requested, verify both. An isolated profile is useful for
diagnosis, but connect the final result to the editor/profile the user will use.

## Establish the toolchain

Use Node.js 22+, GHC 9.6.7, a Cabal supporting this package's cabal-version, and an
HLS distribution that includes a binary for GHC 9.6.7. Neovim needs 0.11+; VS Code
must meet the official Haskell extension's current engine requirement.
Use current official installation instructions linked from `editors/setup.md` for
missing prerequisites. Reuse compatible installations; explicit versioned paths
avoid changing global defaults. A wrapper's own build GHC is not the project's GHC.

Install the requested tools within the user's authorized setup scope. Observe the
host's actual permission boundary. Do not disable workspace trust, run downloaded
project code in unrelated directories, or install tools during every editor startup.

## Build and connect

1. Run `node editors/setup.mjs build`, passing `--ghc` / `--cabal` when needed.
   It builds the native Haskell core, VSIX and Neovim distribution for the current
   OS/CPU from the committed lockfiles. Use a package matching the extension host
   (including WSL/SSH/container), not just the desktop. Neovim still needs Node
   for watching/caching/editor communication; the standalone CLI does not. Read errors; a declaration-only fallback is not a
   completed full setup.
2. Run `prepare`, passing `--ghc`, `--cabal`, or `--hls` when the defaults differ.
   It builds dependencies for Afterlight's native and check components without
   requiring game assets. Do not substitute a tiny fixture for this step.
3. Run `configure --apply` with the same selected toolchain. It generates the GHC
   analyzer config, explicit HLS component mapping, native Cabal flags, and editor
   launch settings. It refuses to overwrite different existing project settings.
   If it reports a conflict, compare the generated proposals with the existing
   files, preserve a local backup, and merge necessary fields. Then use
   `configure --apply --keep-existing` to retain the merged settings and produce
   launch information. This flag does not validate the merged build configuration.
4. For Neovim, use the bundled standalone profile first. Integrate its small
   `afterlight_editor` module into the existing config if that is the user's chosen
   experience. If HLS is already configured, avoid a second client; pass `hls=false`
   and adapt the existing HLS's command, environment, root and mappings.
5. For VS Code, install the built VSIX and `haskell.haskell`. Open the generated
   `afterlight.code-workspace`; respect workspace trust for this checkout. Verify
   that the selected HLS is actually used, rather than a silently downloaded
   incompatible compiler/server. Preserve settings in other workspaces.

Generated absolute paths, reports and caches stay local. Do not commit them or
copy them to a different host. Regenerate after changing compiler/Cabal dependencies.
The native cradle excludes the Wasm entry and the bundled tool's test examples.

## Verify the full path

Read `editors/verification.md` before reporting a support claim. Run `verify` and
then exercise the actual requested editor. For Neovim run the supplied
`editors/verify-neovim.lua` through the bundled profile, followed by a check through
the user's final profile if it differs. For VS Code use the documented extension
host tests and actual workspace checks. Inspect results; a zero install exit code
is insufficient.

Require actual Afterlight evidence: `advance`'s type, `World` definition and return
navigation, GHC-confirmed Pure on `Change.hs`, IO on `Audio.hs`, source/Undo round
trips, completion, references, formatting, a temporary unsaved type error and its
removal, and HLS loading `Render.hs` and `GardenCheck.hs`. Tests must not leave edits
in game sources. Distinguish automation/API checks from visual/manual checks.

If a layer fails, resolve the smallest actual cause and rerun affected checks.
Keep the outcome intact; do not call a partially configured viewer the full experience.
If external installation or platform support blocks progress, complete independent
parts and state the specific missing layer and evidence.

## Boundaries and handoff

- The analyzer supports GHC 9.6.x. `Pure` is an IO-usage hint, not proof of purity.
  CPP/TH and unsupported compiler features stay unknown; HLS can still help edit.
- The Afterlight native setup is verified on Windows. The shared viewer is portable;
  other OS host/dependency setup must be checked on that OS before claiming success.
- External-library definition navigation depends on HLS providing source locations.
- Keep Windows cross-module rename disabled: tested HLS versions omitted edits.
  Local rename is available. Never present an incomplete rename as success.

Finish with the exact launch action, the few useful keys, what passed in the chosen
editor, and any remaining limitation. Do not make the user reconstruct your tool log.
Only add durable configuration and distribution source to version control.
