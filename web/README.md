# Browser build

This builds the existing Haskell game and raylib renderer into one directory
of static browser files. The tested build host is **x86-64 Linux or WSL2**.
The runtime assets are supplied separately, as with the native public source.

## Build

With [Nix](https://nixos.org/download/) and its `nix-command` / `flakes`
features enabled, run from the repository root:

```sh
nix develop path:./web --command bash web/build.sh --assets /path/to/native/assets
python3 web/serve.py --directory .build/afterlight-web
```

Open `http://127.0.0.1:8000`. Serving over HTTP is required; opening `index.html`
with `file://` does not provide the fetch behavior used by the host.
Copy the **whole output directory** to a static host when distributing it.
The files work without a game server or cross-origin isolation headers.

The first build downloads the pinned compiler dependencies, Emscripten SDK,
h-raylib source, npm dependencies and a 1.15 MB fontTools wheel. Later builds
reuse their external cache.
Generated files and runtime assets are not added to the source repository.

```sh
bash web/build.sh --assets /path/to/native/assets \
  --output /path/to/site --cache /path/to/build-cache --jobs 4
```

The same script also works from an existing toolchain environment. Put
`wasm32-wasi-ghc`, `wasm32-wasi-ghc-pkg`, `wasm32-wasi-clang`, Python 3.10+, curl,
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
| Font subsetter | [fontTools 4.61.1](https://pypi.org/project/fonttools/4.61.1/), pure-Python wheel with SHA256 in `build.sh` (MIT) |

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

## Assets and HTTP delivery

`prepare-assets.py` subsets the supplied Noto Sans CJK JP OpenType font while
retaining its glyph outlines, hints, layout features and name/license metadata.
It keeps ASCII, the source `fonts/glyphs.txt` and every printable character in
`src/**/*.hs`, covering `uiCorpus`, notices, place names, menus and photo labels.
The generated `glyphs.txt` contains that same union, so raylib loads the complete
set. Put text that comes from outside those literal sources (including Unicode
escape sequences) into the supplied `glyphs.txt`. Missing font characters fail
the build instead of silently producing blank text. The [fontTools subsetter](https://fonttools.readthedocs.io/en/latest/subset/index.html)
runs directly from the verified cached wheel; no pip install or native extension
is required. The original assets stay intact and the font's OFL license is copied
to the output. Audio stays as the original WAV bytes.

The build also generates deterministic `.gz` sidecars. `serve.py` actually sends
them when the browser accepts gzip, with the original content type (including
`application/wasm`), `Content-Encoding: gzip` and `Vary: Accept-Encoding`.
It respects `q=0`, uses an ETag per representation, and returns `304` when the
cached representation is current. `Cache-Control: no-cache` allows storage but
requires revalidation: these stable filenames must not be served as immutable.
Asset manifest `bytes` always means **decoded** bytes, matching fetch results;
HTTP `Content-Length` can be smaller under compression.

For another static host, enable its gzip/Brotli delivery or configure it to serve
the `.gz` files with the same encoding and MIME headers. Merely uploading sidecars
does not enable compression. Plain `python3 -m http.server` still works, but serves
the original files without this transfer reduction.

The 2026-09-20 asset check reduced the font from 16,467,736 to 202,212 bytes for
374 characters. All requested outlines, horizontal/vertical metrics and name
records matched the source, and repeated subsets were byte-identical. The bundled
raylib `stb_truetype` also produced identical pixels and offsets at font size 48. This
reduces the 21 runtime assets from 36.4 MB to 20.1 MB before HTTP compression.
The final measured site payload falls from the old 44.2 MB to 28.7 MB
uncompressed, or 18.0 MB using gzip. These are byte counts, not a
startup-time guarantee; world construction and graphics initialization still
need separate timing in the browser.
The [experience report](EXPERIENCE.md) records the source-backed decisions,
startup stages, cold/warm observations and remaining validation boundaries.

```sh
python3 web/checks/assets.py --site /path/to/site --assets /path/to/native/assets \
  --fonttools-wheel /path/to/build-cache/fonttools-4.61.1-py3-none-any.whl
```

The checks compare the actual font and generated manifest/sidecars, then exercise
HTTP GET/HEAD, gzip refusal, variant ETags, 304 revalidation and rebuild handling
against a local server.

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

Before the loading/capture redesign, the actual garden rendered in the Codex
in-app browser and Chrome. In the in-app browser, DOM keyboard/mouse input moved the player and mined terrain;
the edited mesh appeared, F5 saved, and reloading restored the moved player.
Photo mode generated a 1.27 MB PNG and exposed its download link. Startup,
focus pause/resume and orderly shutdown were also exercised. The rebuilt
output was separately served and its 3D scene rendered successfully.

The final host adds automatic staged preparation, viewport sizing, capture-
confirmed engagement, and explicit pause transitions. Its 37 JavaScript tests,
six asset/HTTP checks, full-scene startup in both browsers, ready-scene resize,
fullscreen entry/exit in the in-app browser, and missing-script retry display passed. A fresh-origin in-app run reached its
first visible content at 0.10 seconds and its scene at 14.23 seconds; same-tab
reload reached the scene at 11.83 seconds. See the report for conditions.

Automation still rejected Pointer Lock with WrongDocumentError despite fresh
activation (UnknownError inside in-app fullscreen). Refusal/retry and Chrome's
AudioContext reaching running were checked; successful capture, audible output and the final downloaded file
remain unverified. The new capture-gated manual gameplay path is not certified
by the earlier host's input results. No Safari, Firefox or mobile
compatibility claim is made. The payload measurements above are this game's
inputs, not a minimum size for the stack.

For a different game, replace the package/executable names, `BrowserMain.hs`
connection, asset list, save paths and game-specific input settings. Keep the
ABI patch, linker, memory guard and FFI bridge together. The shared low-level
host contracts and focused JavaScript tests are documented in [host/README.md](host/README.md).
