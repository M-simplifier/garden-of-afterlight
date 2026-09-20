import { WASI, File, OpenFile, ConsoleStdout, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { immediatePoll, raylibImports, refreshRaylibMemory } from "./bridge.js";
import { attachPersistence, gameEnvironment, loadAssets } from "./files.js";
import { canvasInput, errorText } from "./input.js";
import { photoDownload, screenshotBridge } from "./photos.js";

const MIB = 1024 * 1024;
const RAYLIB_LIMIT = 128 * MIB;
const memory = new WebAssembly.Memory({ initial: 160 * MIB / 65536, maximum: 1024 * MIB / 65536 });
const canvas = document.querySelector("canvas");
const status = document.querySelector("#status");
const start = document.querySelector("#start");
const pointerHint = document.querySelector("#pointer-hint");
const downloadPhoto = photoDownload(document.querySelector("#photo-download"));
const stats = { frames: 0, ffiCalls: 0, totalFrameMs: 0, maxFrameMs: 0, lastFrameMs: 0, errors: [] };
const logs = [];
const importantLogs = [];
const importantByMessage = new Map();
const focusEvents = [];
let instance, raylib, state, frameId, input, running = false;
const inspection = { stats, logs, importantLogs, focusEvents, memory, layout: undefined, ready: false,
  get running() { return running; },
  get raylibBreak() { return raylib?._web_raylib_program_break?.(); } };
// Readable even when initialization fails. This exposes diagnostics, not a
// way to replace game state or inject synthetic gameplay.
window.afterlightWeb = inspection;
const diagnosticsNode = new URLSearchParams(location.search).get("diagnostics") === "1"
  ? document.createElement("script") : null;
function focusState() {
  let windowFocused = null;
  let windowFocusError = null;
  try { windowFocused = raylib?._IsWindowFocused_?.() ?? null; }
  catch (error) { windowFocusError = String(error); }
  return {
    documentHasFocus: document.hasFocus(), visibilityState: document.visibilityState,
    activeElementId: document.activeElement?.id ?? null,
    activeElementTag: document.activeElement?.tagName ?? null,
    raylibWindowFocused: windowFocused, windowFocusError,
    pointerLockElementId: document.pointerLockElement?.id ?? null,
    canvasHasPointerLock: document.pointerLockElement === canvas,
    canvasWidth: canvas.width, canvasHeight: canvas.height,
    canvasClientWidth: canvas.clientWidth, canvasClientHeight: canvas.clientHeight,
  };
}
function publishDiagnostics() {
  if (!diagnosticsNode) return;
  diagnosticsNode.textContent = JSON.stringify({
    ready: inspection.ready, running, memoryBytes: memory.buffer.byteLength,
    raylibBreak: inspection.raylibBreak, layout: inspection.layout,
    environment: inspection.environment, assets: inspection.assets,
    persistence: inspection.persistence, photo: inspection.photo,
    focus: focusState(), focusEvents, input: input?.snapshot(),
    stats: { ...stats, averageFrameMs: stats.frames ? stats.totalFrameMs / stats.frames : 0,
      errors: stats.errors.slice(-5).map(message => String(message).slice(0, 6000)) },
    logs: logs.slice(-20).map(entry => ({ ...entry, message: String(entry.message).slice(0, 3000) })),
    importantLogs: importantLogs.map(entry => ({ ...entry, message: entry.message.slice(0, 3000) })),
  });
}
if (diagnosticsNode) {
  diagnosticsNode.type = "application/json";
  diagnosticsNode.id = "web-diagnostics";
  document.body.append(diagnosticsNode);
  setInterval(publishDiagnostics, 1000);
  publishDiagnostics();
}

function record(source, message, warning = false) {
  message = String(message);
  const timeMs = performance.now();
  logs.push({ source, message, timeMs });
  if (logs.length > 200) logs.shift();
  if (warning || /shader|warning|error|audio|failed|Loaded checkpoint|checkpoint saved|Could not save|Photo saved/i.test(message)) {
    const key = `${source}\n${message}`;
    const prior = importantByMessage.get(key);
    if (prior) { prior.count++; prior.lastTimeMs = timeMs; }
    else {
      const entry = { source, message, firstTimeMs: timeMs, lastTimeMs: timeMs, count: 1 };
      importantByMessage.set(key, entry);
      importantLogs.push(entry);
      // Keep early shader/audio initialization evidence even after later warnings.
      if (importantLogs.length > 128) {
        const [removed] = importantLogs.splice(96, 1);
        importantByMessage.delete(`${removed.source}\n${removed.message}`);
      }
    }
  }
  (warning ? console.warn : console.log)(`[${source}] ${message}`);
}

function fail(error) {
  running = false;
  if (frameId !== undefined) cancelAnimationFrame(frameId);
  const message = errorText(error);
  stats.errors.push(message);
  status.textContent = `Unable to run: ${message}`;
  status.dataset.error = "true";
  console.error(error);
  publishDiagnostics();
}

function checkPartition() {
  const exports = instance.exports;
  const address = (name) => {
    const value = exports[name];
    if (!(value instanceof WebAssembly.Global)) throw new Error(`Missing layout export ${name}`);
    return value.value;
  };
  const layout = {
    raylibLimit: raylib._web_raylib_limit(),
    raylibHeapBase: raylib._web_raylib_heap_base(),
    raylibBreak: raylib._web_raylib_program_break(),
    raylibStackEnd: raylib._web_raylib_stack_end(),
    raylibStackBase: raylib._web_raylib_stack_base(),
    haskellGlobalBase: address("__global_base"),
    haskellDataEnd: address("__data_end"),
    haskellStackPointer: address("__stack_pointer"),
    haskellHeapBase: address("__heap_base"),
    memoryBytes: memory.buffer.byteLength,
  };
  if (!(layout.raylibLimit === RAYLIB_LIMIT
      && layout.raylibStackEnd >= 0
      && layout.raylibStackEnd < layout.raylibStackBase
      && layout.raylibStackBase <= layout.raylibHeapBase
      && layout.raylibHeapBase <= layout.raylibBreak
      && layout.raylibBreak < RAYLIB_LIMIT
      && layout.haskellGlobalBase >= RAYLIB_LIMIT
      && layout.haskellDataEnd > layout.haskellGlobalBase
      && layout.haskellStackPointer >= layout.haskellDataEnd
      && layout.haskellHeapBase >= layout.haskellStackPointer
      && layout.haskellHeapBase < layout.memoryBytes)) {
    throw new Error(`Overlapping or invalid WASM memory layout: ${JSON.stringify(layout)}`);
  }
  return layout;
}

function frame() {
  if (!running) return;
  try {
    if (instance.exports.shouldClose(state)) {
      instance.exports.teardown(state);
      state = undefined;
      running = false;
      status.textContent = "Stopped. Reload the page to restart.";
      return;
    }
    const began = performance.now();
    state = instance.exports.mainLoop(state);
    // Browser callbacks can run before the next FFI; return with current views
    // even if GHC grew memory after the last raylib call of this frame.
    refreshRaylibMemory(memory, raylib);
    stats.lastFrameMs = performance.now() - began;
    stats.frames++;
    stats.totalFrameMs += stats.lastFrameMs;
    stats.maxFrameMs = Math.max(stats.maxFrameMs, stats.lastFrameMs);
    if (raylib._web_raylib_program_break() > RAYLIB_LIMIT) throw new Error("Raylib crossed the memory boundary");
    // Exactly one owner schedules frames. mainLoop must return to the browser.
    frameId = requestAnimationFrame(frame);
  } catch (error) { fail(error); }
}

async function load() {
  status.textContent = "Loading the Haskell and raylib modules…";
  const preopen = new PreopenDirectory(".", new Map());
  const environment = gameEnvironment(new URLSearchParams(location.search));
  const wasi = new WASI(["afterlight"], environment, [
    new OpenFile(new File([])),
    ConsoleStdout.lineBuffered(message => record("Haskell", message)),
    ConsoleStdout.lineBuffered(message => record("Haskell stderr", message, true)),
    preopen,
  ], { debug: false });
  inspection.environment = environment;
  inspection.persistence = attachPersistence(wasi, memory, preopen.dir, {
    report: message => record("storage", message, true),
  });
  const { default: Raylib } = await import("./raylib.mjs");
  raylib = await Raylib({
    canvas, wasmMemory: memory, noInitialRun: true,
    locateFile: path => new URL(path, location.href).href,
    print: message => record("raylib", message),
    printErr: message => record("raylib stderr", message, true),
    onAbort: reason => fail(new Error(`raylib abort: ${reason}`)),
  });
  if (typeof raylib.refreshMemoryViews !== "function") throw new Error("Link refresh-memory.js with emcc --post-js");
  inspection.assets = await loadAssets(raylib.FS, preopen.dir);
  const screenshots = screenshotBridge({ memory, raylibFS: raylib.FS, root: preopen.dir,
    captured: (path, bytes) => {
      downloadPhoto(path, bytes);
      inspection.photo = { path, bytes: bytes.byteLength };
      publishDiagnostics();
    },
    warn: message => record("photo", message, true),
  });
  const response = await fetch("./haskell.wasm");
  if (!response.ok) throw new Error(`haskell.wasm: HTTP ${response.status}`);
  const result = await WebAssembly.instantiate(await response.arrayBuffer(), {
    wasi_snapshot_preview1: { ...wasi.wasiImport, poll_oneoff: immediatePoll(memory) },
    env: raylibImports(memory, raylib, {
      countCall: () => { stats.ffiCalls++; },
      freeHaskell: pointer => instance.exports.free(pointer),
      raylibLimit: RAYLIB_LIMIT,
      invoke: (name, fn, args) => name === "_TakeScreenshot_"
        ? screenshots(name, fn, args) : input.invoke(name, fn, args),
    }),
  });
  instance = result.instance;
  const layout = checkPartition();
  if (typeof instance.exports.free !== "function") throw new Error("Export Haskell's libc free for allocator dispatch");
  wasi.initialize({ exports: { ...instance.exports, memory } });
  instance.exports.hs_init(0, 0);
  refreshRaylibMemory(memory, raylib);
  inspection.layout = layout;
  inspection.ready = true;
  publishDiagnostics();
  status.textContent = "Ready. Start to enable keyboard and audio.";
  start.disabled = false;
  start.addEventListener("click", event => {
    if (running || state !== undefined) return;
    try {
      canvas.focus();
      // Keep startup (and its audio initialization) inside the actual click.
      state = input.gesture(event, () => instance.exports.startup());
      refreshRaylibMemory(memory, raylib);
      running = true;
      start.hidden = true;
      canvas.focus({ preventScroll: true });
      status.textContent = "Running";
      publishDiagnostics();
      frameId = requestAnimationFrame(frame);
    } catch (error) { fail(error); }
  });
  if (new URLSearchParams(location.search).has("autostart")) start.click();
}

canvas.addEventListener("webglcontextlost", event => {
  event.preventDefault();
  fail(new Error("WebGL context lost. Reload to reacquire resources."));
});
input = canvasInput({ canvas, document, keyboardTarget: window,
  enabled: () => inspection.ready,
  recenter: () => raylib._SetMousePosition_(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
  warn: message => record("browser input", message, true),
  changed: () => {
    const mode = input?.snapshot();
    if (pointerHint) pointerHint.hidden = !running || !mode?.wanted || mode.locked || mode.pending;
    publishDiagnostics();
  },
});
inspection.input = input;
for (const [target, type] of [[window, "focus"], [window, "blur"],
  [canvas, "focus"], [canvas, "blur"], [document, "visibilitychange"],
  [document, "pointerlockchange"], [document, "pointerlockerror"]]) {
  target.addEventListener(type, () => {
    focusEvents.push({ event: type, target: target === canvas ? "canvas" : target === window ? "window" : "document",
      timeMs: performance.now(), ...focusState() });
    if (focusEvents.length > 16) focusEvents.shift();
    publishDiagnostics();
  });
}
window.addEventListener("unhandledrejection", event => fail(event.reason));
load().catch(fail);
