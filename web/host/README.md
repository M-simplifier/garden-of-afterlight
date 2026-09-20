# Minimal h-raylib browser host

The host used by Afterlight's fixed, tested browser build. The boundary is
Haskell WASI reactor + Emscripten raylib, with ordinary imported linear memory.
No worker or SharedArrayBuffer is required. Both native halves retain their own
allocator; explicit address ranges keep them apart.

The binding protocol comes from
[h-raylib-web-template](https://github.com/Anut-py/h-raylib-web-template/tree/51dcf1079434591bff0ee91575caeb6c441bb77e).
This host is a small rewrite. It fixes the template's 64-bit scalar indexing,
keeps one frame scheduler, and uses current WASI console descriptors. Browser
WASI remains a subset: synchronous blocking sleeps and sockets are not supplied
here. The small poll adapter handles console readiness
and already-expired clocks using the WASI Preview1 ABI.

## Build contract

Use the [parent build instructions](../README.md). Exact compiler versions,
linker arguments and exports live in `../build.sh` and the repository's Cabal
file. The build uses Emscripten **3.1.45**, WebGL 2 and matching h-raylib wrappers,
without pthreads. `memory-guard.c` must be linked into the Emscripten module.

The growth declaration permits importing the common memory whose maximum is
1 GiB. The C guard makes Emscripten's allocator fail at 128 MiB regardless of
the actual common-memory size. Only GHC grows the memory. Verify that the linker
selected this implementation of both `emscripten_get_heap_size` and
`emscripten_resize_heap` in its map. Never remove the guard just because a larger
`MAXIMUM_MEMORY` appears to fix a crash.

`refresh-memory.js` exposes Emscripten's internal view updater through a
documented build hook; 3.1.45 does not accept `updateMemoryViews` in
`EXPORTED_RUNTIME_METHODS`. Its `HEAPU8` is already exposed on the module.
The bridge refreshes those views before every FFI call and after startup/each
frame returns, so browser input callbacks also see any GHC memory growth.

The Haskell reactor imports ordinary memory with global base 128 MiB.
Remove `--shared-memory` and **remove any `--stack-first`** injected by the GHC
driver: global-base alone does not move a stack placed first. Inspect the actual
link command/map. Host startup asserts that raylib data/stack/break are below
128 MiB and Haskell data/stack are above it. Both modules must export the exact
functions used by this host; missing exports are a build error.

The `free` export is the WASI libc function, not a Haskell callback. h-raylib's
`Freeable` visits both raylib-owned and Haskell-marshalled child arrays, so the
bridge dispatches frees by the same address boundary. This avoids handing one
allocator a pointer from the other.

`mainLoop` must return after one frame. Set raylib target FPS to **0** so browser
requestAnimationFrame owns pacing; do not use Asyncify to suspend through the
Haskell C-export call stack. Keep simulation fixed-step in Haskell as usual.

```sh
npm ci
npm run check
npm run build
```

These commands check and bundle the host in this directory; `../build.sh`
assembles the complete site with both WASM modules and assets.
Open the site: its HTML loading screen appears immediately and preparation
starts automatically. World creation, common resources, chunk uploads and the
preview are separate runtime stages. `startup` returns the loading handle;
`mainLoop` advances a stage until `isReady`. `loadingStage/Done/Total` expose
actual progress. `scheduler.yield()` returns control between batches without
the nested-timer floor; older browsers fall back to a timer. Both Wasm modules
compile alongside asset transfer, retaining the original fetch Response for
the browser's compiled-code cache.

Once the scene appears, click to engage mouse/audio, and inspect
`window.afterlightWeb` for frame/FFI counts, CPU frame duration, layout, and
current memory bytes. `boot` separates download/compile, preparation stages,
ready and first input. Metrics count
execution of the actual exported frame, not GPU completion or visual quality.

Browser mouse capture is an explicit host boundary: `DisableCursor` records
the game's desired mode, and a fresh entry/canvas click requests Pointer
Lock before resuming audio. Only confirmed capture starts play; the click's
transient activation must not be spent on synchronous startup. A denial keeps
the scene ready and a later click can retry. Escape never
automatically reacquires the mouse. The browser's pointer-lock event still
updates raylib's actual cursor state. Capture loss, blur and hidden documents
pause once; the next frame applies `setActive` and clears held inputs/clock.
This queues the Haskell transition outside FFI calls, avoiding reentrancy.
HTML-control keystrokes never enter GLFW's global listener, and the engagement
click never doubles as mining. Other runtime failures remain fatal, with a
retry screen that keeps saved checkpoints.
The pinned post-js adapter filters GLFW's callbacks themselves so native HTML
key handlers and button activation remain intact.

CSS fills the viewport. `drawingSize` keeps its aspect ratio within a 1280×720
pixel budget independently of device pixel ratio. Resize changes the actual
raylib buffer; `preview` redraws a ready scene without advancing the world.
The GLFW resize adapter preserves C window/framebuffer notifications while
removing its implicit fullscreen changes and screen-sized canvas override.
Fullscreen and CSS belong to the host; changing render resolution must not
change either of them.
F11 (or the menu button) requests fullscreen inside the original event. Game shortcut
defaults (including Tab, F3, F5, F6 and F12) are suppressed only while the canvas
owns gameplay; paused Tab can reach the HTML controls. Other menu keys remain
available on the canvas. See [experience decisions](../EXPERIENCE.md) for sources
and the difference between document focus and native-window focus in automation.

## Assets and checkpoint storage

Provide `public/assets-manifest.json` as `[{"path":"assets/fonts/glyphs.txt","bytes":123},
...]` and serve each named file at that path. One fetch per file installs the
same bytes into both Emscripten FS and the WASI `.` directory, because raylib
loads shaders/fonts/audio while Haskell also reads glyphs and checks file
existence. Fetches run four at a time. A missing manifest (404) means an
asset-free small sample; a missing listed asset is an initialization failure.
Do not also preload the same asset set with emcc.

WASI checkpoint paths `.runtime/garden/save-v2.txt`, `.previous`, and
`.rejected[.N]` persist together under localStorage key `afterlight:saves:v1`.
The `.next` staging file is transient. On commit rename, a single setItem stores
the snapshot; quota/security failure returns WASI ENOSPC/EACCES and rolls back
the rename so the previous checkpoint remains readable. Backup copies persist
on write-fd close/sync, and a failed close restores the durable copy. Malformed
storage containers are retained and block overwriting until recovered. The
Haskell checkpoint decoder still validates the actual game data.

This storage is scoped to the browser origin, has the browser's quota, and
does not provide coordination between simultaneous tabs. It is not a general
persistent filesystem. Assets, screenshots and metrics do not enter the save
container. `window.afterlightWeb.persistence` reports restored file count,
successful writes, and the last storage error; `logs` includes WASI stderr.

Diagnostic query parameters are allowlisted: `width` (960–4096), `height`
(600–2160), `frames` (1–60000), `tour=story|islands`,
`scene=day|night|dusk|sky|high|kin|return`, `paused=0|1`, `hud=0|1`.
Default size follows the viewport within the pixel budget; the default state
is paused until capture succeeds. Save paths and arbitrary environment variables cannot
be supplied through the URL. These parameters configure the existing Haskell
runtime; they do not replace its rules or write an initial game state.
`diagnostics=1` also publishes a compact snapshot once per second (and on
failure) into the non-executing `script#web-diagnostics[type=application/json]`
DOM element for browser tools with read-only DOM access. It contains no save
contents and adds no visible technical interface.

`TakeScreenshot` creates its parent folder in Emscripten FS, calls the actual
raylib PNG exporter, and synchronously copies the generated bytes into WASI.
The existing Haskell existence/size checks and photo message then run normally.
A download link exposes the latest PNG; replacing it revokes the old Blob URL.
Photos and their Haskell sidecar files last for the current page session only
and do not enter browser checkpoint storage.

Implementation sources checked 2026-09-20:
- [GHC WASM megablock allocation](https://github.com/ghc/ghc/blob/ghc-9.6/rts/wasm/OSMem.c)
- [Emscripten 3.1.45 sbrk](https://github.com/emscripten-core/emscripten/blob/3.1.45/system/lib/libc/sbrk.c)
- [LLVM memory layout](https://github.com/llvm/llvm-project/blob/llvmorg-16.0.6/lld/wasm/Writer.cpp)
- [browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim)
