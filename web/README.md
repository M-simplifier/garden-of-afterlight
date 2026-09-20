# Browser build

This builds the existing Haskell game and raylib renderer into one directory
of static browser files. The tested build host is **x86-64 Linux or WSL2**.
The runtime assets are supplied separately, as with the native public source.

## Build

With [Nix](https://nixos.org/download/) and its `nix-command` / `flakes`
features enabled, run from the repository root:

```sh
nix develop path:./web --command bash web/build.sh --assets /path/to/native/assets
python3 -m http.server 8000 --bind 127.0.0.1 --directory .build/afterlight-web
```

Open `http://127.0.0.1:8000`. Serving over HTTP is required; opening `index.html`
with `file://` does not provide the fetch behavior used by the host.
Copy the **whole output directory** to a static host when distributing it.
The files work without a game server or cross-origin isolation headers.

The first build downloads the pinned compiler dependencies, Emscripten SDK,
h-raylib source and npm dependencies. Later builds reuse their external cache.
Generated files and runtime assets are not added to the source repository.

```sh
bash web/build.sh --assets /path/to/native/assets \
  --output /path/to/site --cache /path/to/build-cache --jobs 4
```

The same script also works from an existing toolchain environment. Put
`wasm32-wasi-ghc`, `wasm32-wasi-ghc-pkg`, `wasm32-wasi-clang`, Python 3, curl,
tar, patch, Node and npm on `PATH`; set `CABAL` when choosing a Cabal executable.
An activated Emscripten 3.1.45 is reused. Otherwise the script installs it in
the build cache. It checks the GHC, Cabal and Emscripten versions before building.

The default cache is `$XDG_CACHE_HOME/afterlight-web`, or
`$HOME/.cache/afterlight-web`. `AFTERLIGHT_WEB_CACHE` also overrides it.
Builds using one cache should run sequentially. For simultaneous builds, use
separate cache and output directories.

## Fixed inputs

| Input | Verified version / source |
| --- | --- |
| GHC-Wasm | `9.14.1.20260330`, official `ghc-wasm-meta` revision `60098a5076557e327b326a1a3ba3b5fb4fec1e49` |
| GHC bindist | Release `20260401T092957`; its archive hash is fixed by the meta-flake |
| Cabal | `3.16.1.0`, official Linux archive with SHA256 in `flake.nix` |
| Emscripten | `3.1.45`; SDK manager revision and archive SHA256 in `build.sh` |
| h-raylib | `5.6.0.0`, Hackage archive SHA256 in `build.sh` |
| Haskell packages | Compiler boot packages plus version constraints and index date in `cabal.project.template` |
| Browser packages | `host/package-lock.json` |

`patches/h-raylib-web.patch` is applied to the verified archive in the cache.
It corrects the wasm32 layouts of raylib structures and the bundled web focus
callback. The native layout values remain unchanged. `checks/abi.c` asks the
actual Emscripten compiler to verify 20 structures and 94 field offsets.

The compiler supports Template Haskell. Selecting its installed `time`, `unix`
and `directory` avoids linking additional boot-library versions into the TH
interpreter. `wasm-link` removes GHC's `--stack-first`, preserving the separate
Haskell and raylib memory arenas selected by this host.

C objects are cached by C source/header content, Emscripten identity and build
script content. Cabal tracks Haskell dependencies in a compiler-specific build
directory. The browser reactor path comes from Cabal's `plan.json`: using
`cabal list-bin` with an accidentally native `ghc-pkg` can misidentify this
cross build. `build-info.json` in the output records the selected tool versions
and h-raylib archive/patch hashes.

## Validation scope

On 2026-09-20, the public `build.sh` completed using the existing compiler/SDK
environment and a new output directory, rebuilding h-raylib from its verified
Hackage archive and this repository's patch. The generated site included both
WASM modules, the bundled JavaScript host and 21 prepared assets. Reproduce
that path after activating the versions above:

```sh
bash web/build.sh --assets /path/to/native/assets --output ../afterlight-web-local
python3 web/checks/build.py --archive /path/to/h-raylib-5.6.0.0.tar.gz
```

The checks passed five linker-argument cases, clean-archive patch application
and all 134 C ABI assertions. Nix resolved the pinned compiler source to the
same store artifact used by the successful build, and evaluated the locked
development shell. Installing that shell and the SDK from an entirely empty
machine/cache has not been tested. Runtime behavior is checked separately
against the generated site; these build checks alone do not prove playability.

The actual garden rendered in the Codex in-app browser and Chrome. In the
in-app browser, DOM keyboard/mouse input moved the player and mined terrain;
the edited mesh appeared, F5 saved, and reloading restored the moved player.
Photo mode generated a 1.27 MB PNG and exposed its download link. Startup,
focus pause/resume and orderly shutdown were also exercised. The rebuilt
output was separately served and its 3D scene rendered successfully.

The automation environment rejected Pointer Lock; graceful refusal and retry
were checked, but successful mouse capture, fullscreen, audible output and
the final downloaded file were not verified. No Safari, Firefox or mobile
compatibility claim is made. The 21 assets total 36.4 MB before compression;
the two WASM modules total 7.4 MB. These are this game's inputs, not a minimum
size for the stack.

For a different game, replace the package/executable names, `BrowserMain.hs`
connection, asset list, save paths and game-specific input settings. Keep the
ABI patch, linker, memory guard and FFI bridge together. The shared low-level
host contracts and focused JavaScript tests are documented in [host/README.md](host/README.md).
