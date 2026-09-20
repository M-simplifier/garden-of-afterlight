import { WASI, File, OpenFile, ConsoleStdout, PreopenDirectory } from "@bjorn3/browser_wasi_shim";
import { immediatePoll, raylibImports, refreshRaylibMemory } from "./bridge.js";
import { attachPersistence, gameEnvironment, loadAssets } from "./files.js";
import { canvasInput, errorText } from "./input.js";
import { photoDownload, screenshotBridge } from "./photos.js";
import { compileModule, downloads } from './loading.js';
import { drawingSize } from './viewport.js';

const MIB = 1024 * 1024;
const RAYLIB_LIMIT = 128 * MIB;
const memory = new WebAssembly.Memory({ initial: 160 * MIB / 65536, maximum: 1024 * MIB / 65536 });
const canvas = document.querySelector("canvas");
const game = document.querySelector('#game');
const status = document.querySelector("#status");
const progress = document.querySelector('#progress');
const detail = document.querySelector('#detail');
const enter = document.querySelector('#enter');
const fullscreenButton = document.querySelector('#fullscreen');
const captureMessage = document.querySelector('#capture-message');
const downloadPhoto = photoDownload(document.querySelector("#photo-download"));
const stats = { frames: 0, ffiCalls: 0, totalFrameMs: 0, maxFrameMs: 0, lastFrameMs: 0, errors: [] };
const logs = [];
const importantLogs = [];
const importantByMessage = new Map();
const focusEvents = [];
let instance, raylib, state, frameId, bootId, input, running = false;
let requestedActivity, firstPlay = true, stopped = false;
let resizePending = false, bootCanceled = false;
const boot = { began: performance.now(), phase: 'download', network: null, stages: {},
  modulesReadyMs: null, beginMs: null, readyMs: null, firstInputMs: null, maxStepMs: 0 };
const inspection = { stats, logs, importantLogs, focusEvents, memory, layout: undefined, ready: false,
  boot,
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
    fullscreenElementId: document.fullscreenElement?.id ?? null,
    canvasWidth: canvas.width, canvasHeight: canvas.height,
    canvasClientWidth: canvas.clientWidth, canvasClientHeight: canvas.clientHeight,
  };
}
function publishDiagnostics() {
  if (!diagnosticsNode) return;
  diagnosticsNode.textContent = JSON.stringify({
    ready: inspection.ready, running, memoryBytes: memory.buffer.byteLength,
    boot, audio: raylib?.audioState?.(),
    paints: performance.getEntriesByType('paint').map(({ name, startTime }) => ({ name, startTime })),
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
  bootCanceled = true;
  if (frameId !== undefined) cancelAnimationFrame(frameId);
  if (bootId !== undefined) clearTimeout(bootId);
  input?.pause();
  const message = errorText(error);
  stats.errors.push(message);
  game.dataset.mode = 'failed';
  status.textContent = '庭を開けませんでした';
  detail.textContent = 'もう一度読み込んでください。保存した庭は残ります。繰り返す場合は下の詳細を確認できます。';
  progress.hidden = true;
  document.querySelector('#retry').hidden = false;
  document.querySelector('#error-details').hidden = false;
  document.querySelector('#error-text').textContent = `${boot.phase}\n${message}`;
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
      stopped = true;
      input.pause();
      game.dataset.mode = 'stopped';
      status.textContent = '庭を記録しました';
      detail.textContent = 'また、ここから。';
      progress.hidden = true;
      document.querySelector('#retry').hidden = false;
      return;
    }
    if (resizePending) {
      resizePending = false;
      const size = drawingSize(game.clientWidth, game.clientHeight);
      if (canvas.width !== size.width || canvas.height !== size.height) {
        raylib._SetWindowSize_(size.width, size.height);
        if (firstPlay) {
          instance.exports.preview(state);
          refreshRaylibMemory(memory, raylib);
        }
      }
    }
    if (firstPlay) { frameId = requestAnimationFrame(frame); return; }
    if (requestedActivity !== undefined) {
      const active = requestedActivity;
      requestedActivity = undefined;
      raylib.clearInput();
      instance.exports.setActive(state, Number(active));
      if (active && boot.firstInputMs === null) boot.firstInputMs = performance.now() - boot.began;
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

const phaseNames = ['', '庭のかたちを結んでいます', '光と音を整えています', '庭に景色を広げています', '最初の景色を映しています'];
function phase(name, message, completed = 0, total = 0) {
  boot.phase = name;
  status.textContent = message;
  if (total > 0) { progress.max = total; progress.value = completed; }
  else progress.removeAttribute('value');
}

function prepare() {
  if (bootCanceled) return;
  try {
    const stage = instance.exports.loadingStage(state);
    const done = instance.exports.loadingDone(state), total = instance.exports.loadingTotal(state);
    phase(`prepare-${stage}`, phaseNames[stage], done, total);
    detail.textContent = stage === 3 ? `${done.toLocaleString()} / ${total.toLocaleString()}` : 'そのまま、少しお待ちください';
    const began = performance.now();
    state = instance.exports.mainLoop(state);
    refreshRaylibMemory(memory, raylib);
    const elapsed = performance.now() - began;
    boot.maxStepMs = Math.max(boot.maxStepMs, elapsed);
    boot.stages[stage] = (boot.stages[stage] ?? 0) + elapsed;
    if (instance.exports.isReady(state)) {
      boot.readyMs = performance.now() - boot.began;
      boot.phase = 'ready';
      inspection.ready = true;
      running = true;
      game.dataset.mode = 'ready';
      canvas.focus({ preventScroll: true });
      publishDiagnostics();
      frameId = requestAnimationFrame(frame);
    } else {
      publishDiagnostics();
      // Each bounded step is a task, so rendering and input can run between it
      // and the next. Wrapping one large synchronous startup in a Promise cannot.
      schedulePreparation();
    }
  } catch (error) { fail(error); }
}

function schedulePreparation() {
  // Nested setTimeout has a 4 ms floor, which adds seconds over many chunks.
  // Yield without that floor where supported, retaining a task-based fallback.
  if (window.scheduler?.yield) window.scheduler.yield().then(prepare).catch(fail);
  else bootId = setTimeout(prepare, 0);
}

async function load() {
  phase('download', '音と光を届けています');
  const preopen = new PreopenDirectory('.', new Map());
  const size = drawingSize(game.clientWidth, game.clientHeight);
  const environment = gameEnvironment(new URLSearchParams(location.search), size);
  const wasi = new WASI(['afterlight'], environment, [
    new OpenFile(new File([])),
    ConsoleStdout.lineBuffered(message => record('Haskell', message)),
    ConsoleStdout.lineBuffered(message => record('Haskell stderr', message, true)), preopen,
  ], { debug: false });
  inspection.environment = environment;
  inspection.persistence = attachPersistence(wasi, memory, preopen.dir, {
    report: message => record('storage', message, true),
  });
  const transfer = downloads(value => {
    boot.network = value;
    if (boot.phase !== 'download') return;
    if (value.total) { progress.max = value.total; progress.value = value.loaded; }
    else progress.removeAttribute('value');
    detail.textContent = `${(value.loaded / 1e6).toFixed(1)} MB${value.total ? ` / ${(value.total / 1e6).toFixed(1)} MB` : ''}`;
  });
  // Fetch and compile both modules alongside asset transfer. Imports are only
  // needed for instantiation, so they must not serialize the download phase.
  const haskellModule = compileModule(transfer.fetch('./haskell.wasm'));
  const raylibModule = compileModule(transfer.fetch('./raylib.wasm'));
  const raylibReady = import('./raylib.mjs').then(({ default: Raylib }) => {
    let rejectInstantiation;
    const instantiationFailure = new Promise((_, reject) => { rejectInstantiation = reject; });
    return Promise.race([instantiationFailure, Raylib({
      canvas, wasmMemory: memory, noInitialRun: true,
      locateFile: path => new URL(path, location.href).href,
      print: message => record('raylib', message),
      printErr: message => record('raylib stderr', message, true),
      onAbort: reason => rejectInstantiation(new Error(`raylib abort: ${reason}`)),
      instantiateWasm(imports, receive) {
        raylibModule.then(async module => receive(await WebAssembly.instantiate(module, imports), module))
          .catch(rejectInstantiation);
        return {};
      },
    })]);
  });
  const assetsReady = loadAssets(raylibReady.then(module => module.FS), preopen.dir, transfer.fetch, transfer.expect);
  const [loadedRaylib, assets, compiledHaskell] = await Promise.all([raylibReady, assetsReady, haskellModule]);
  raylib = loadedRaylib;
  // Gate GLFW's listeners themselves so HTML controls keep normal key events.
  raylib.acceptKey = input.acceptKey;
  inspection.assets = assets;
  if (typeof raylib.refreshMemoryViews !== 'function') throw new Error('Missing host memory hooks');
  phase('initialize', '庭をひらいています');
  detail.textContent = 'もうすぐ、最初の景色へ';
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  const screenshots = screenshotBridge({ memory, raylibFS: raylib.FS, root: preopen.dir,
    captured: (path, bytes) => { downloadPhoto(path, bytes); inspection.photo = { path, bytes: bytes.byteLength }; publishDiagnostics(); },
    warn: message => record('photo', message, true),
  });
  instance = await WebAssembly.instantiate(compiledHaskell, {
    wasi_snapshot_preview1: { ...wasi.wasiImport, poll_oneoff: immediatePoll(memory) },
    env: raylibImports(memory, raylib, {
      countCall: () => { stats.ffiCalls++; },
      freeHaskell: pointer => instance.exports.free(pointer), raylibLimit: RAYLIB_LIMIT,
      invoke: (name, fn, args) => name === '_TakeScreenshot_'
        ? screenshots(name, fn, args) : input.invoke(name, fn, args),
    }),
  });
  inspection.layout = checkPartition();
  if (typeof instance.exports.free !== 'function') throw new Error("Export Haskell's libc free for allocator dispatch");
  wasi.initialize({ exports: { ...instance.exports, memory } });
  instance.exports.hs_init(0, 0);
  refreshRaylibMemory(memory, raylib);
  boot.modulesReadyMs = performance.now() - boot.began;
  const began = performance.now();
  state = instance.exports.startup();
  refreshRaylibMemory(memory, raylib);
  boot.beginMs = performance.now() - began;
  boot.maxStepMs = Math.max(boot.maxStepMs, boot.beginMs);
  schedulePreparation();
}
canvas.addEventListener("webglcontextlost", event => {
  event.preventDefault();
  fail(new Error("WebGL context lost. Reload to reacquire resources."));
});
input = canvasInput({ canvas, document, keyboardTarget: window, fullscreenTarget: game,
  enabled: () => inspection.ready && !stopped && running,
  menuEnabled: () => !firstPlay,
  resumeAudio: () => raylib?.resumeAudio?.(),
  activity: active => {
    requestedActivity = active;
    if (active) firstPlay = false;
  },
  recenter: () => raylib._SetMousePosition_(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
  warn: (message, kind) => {
    record("browser input", message, true);
    if (kind === 'fullscreen') captureMessage.textContent = '全画面への切り替えが許可されませんでした。この画面のまま遊べます。';
    if (kind === 'audio') captureMessage.textContent = '音を開始できませんでした。再開時にもう一度試します。';
  },
  changed: () => {
    const mode = input?.snapshot();
    if (inspection.ready && !stopped && running) {
      game.dataset.mode = mode?.active ? 'playing' : firstPlay ? 'ready' : 'paused';
      enter.textContent = mode?.pending ? '操作を準備しています…' : firstPlay ? 'クリックして庭へ' : 'クリックして再開';
      captureMessage.textContent = mode?.lastFailure
        ? mode.lastFailure.name === 'WrongDocumentError'
          ? 'このタブをブラウザの手前に表示して、もう一度クリックしてください。'
          : 'マウスを捕捉できませんでした。もう一度クリックするか、ブラウザのサイト設定を確認してください。'
        : 'WASDで歩く · マウスで見回す · Escでメニュー';
    }
    publishDiagnostics();
  },
});
enter.addEventListener('click', event => input.engage(event));
fullscreenButton.addEventListener('click', () => input.fullscreen());
document.addEventListener('fullscreenchange', () => {
  const active = document.fullscreenElement === game;
  const label = active ? '全画面を終了' : '全画面に切り替え';
  fullscreenButton.textContent = active ? '⛶ 全画面を終了' : '⛶ 全画面';
  fullscreenButton.setAttribute('aria-label', label);
  fullscreenButton.title = `${label}（F11）`;
  resizePending = true;
});
document.querySelector('#retry').addEventListener('click', () => location.reload());
new ResizeObserver(() => { resizePending = true; }).observe(game);
inspection.input = input;
for (const [target, type] of [[window, "focus"], [window, "blur"],
  [canvas, "focus"], [canvas, "blur"], [document, "visibilitychange"],
  [document, "pointerlockchange"], [document, "pointerlockerror"], [document, "fullscreenchange"]]) {
  target.addEventListener(type, () => {
    focusEvents.push({ event: type, target: target === canvas ? "canvas" : target === window ? "window" : "document",
      timeMs: performance.now(), ...focusState() });
    if (focusEvents.length > 16) focusEvents.shift();
    publishDiagnostics();
  });
}
window.addEventListener("unhandledrejection", event => fail(event.reason));
load().catch(fail);
