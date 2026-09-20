import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { canvasInput, errorText } from "../src/input.js";

const postJs = readFileSync(new URL('../refresh-memory.js', import.meta.url), 'utf8');
const keyCallbacks = { keydown: 'onKeydown', keyup: 'onKeyup', keypress: 'onKeyPress' };
function installGlfwHooks(Module, GLFW) {
  runInNewContext(postJs, { Module, GLFW, updateMemoryViews() {} });
}

class Surface {
  listeners = new Map();
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  emit(type, properties = {}) {
    const event = { target: this, isTrusted: false, defaultPrevented: false, ...properties,
      preventDefault() { this.defaultPrevented = true; },
      stopImmediatePropagation() { this.stopped = true; } };
    return this.dispatch(type, event);
  }
  dispatch(type, event) {
    for (const fn of this.listeners.get(type) ?? []) { fn(event); if (event.stopped) break; }
    return event;
  }
}
function fixture(options = {}) {
  const document = new Surface(), canvas = new Surface(), keyboardTarget = new Surface();
  const warnings = [], delivered = [];
  let requests = 0, releases = 0, recenters = 0;
  canvas.focus = () => { document.activeElement = canvas; };
  canvas.requestPointerLock = () => { requests++; return Promise.resolve(); };
  document.exitPointerLock = () => { releases++; document.pointerLockElement = null; };
  const input = canvasInput({ canvas, document, keyboardTarget,
    recenter: () => recenters++, warn: message => warnings.push(message), ...options });
  const Module = {}, GLFW = {};
  for (const [type, name] of Object.entries(keyCallbacks)) {
    GLFW[name] = event => delivered.push([type, event.code]);
  }
  installGlfwHooks(Module, GLFW);
  Module.acceptKey = input.acceptKey;
  for (const [type, name] of Object.entries(keyCallbacks)) {
    keyboardTarget.addEventListener(type, GLFW[name], true);
  }
  return { document, canvas, keyboardTarget, input, warnings, delivered,
    counts: () => ({ requests, releases, recenters }) };
}

// Model window capture before the HTML target phase. A window listener that
// stops propagation prevents the button handler even without preventDefault.
function key(f, type, properties = {}) {
  const target = properties.target ?? f.document.activeElement ?? f.keyboardTarget;
  const event = f.keyboardTarget.emit(type, { ...properties, target });
  if (!event.stopped && target !== f.keyboardTarget) target.dispatch?.(type, event);
  return event;
}

function capture(f) {
  f.input.engage({ isTrusted: true });
  f.document.pointerLockElement = f.canvas;
  f.document.emit('pointerlockchange');
}

// Pointer Events suppress compatibility mousedown/up when primary pointerdown
// is canceled. The next click is a separate sequence with a fresh default.
function primaryClick(surface) {
  const properties = { isTrusted: true, isPrimary: true, pointerType: 'mouse', button: 0 };
  const down = surface.emit('pointerdown', { ...properties, buttons: 1 });
  if (!down.defaultPrevented) surface.emit('mousedown', { ...properties, buttons: 1 });
  surface.emit('pointerup', { ...properties, buttons: 0 });
  if (!down.defaultPrevented) surface.emit('mouseup', { ...properties, buttons: 0 });
  return down;
}

test("frame calls describe cursor demand; only trusted clicks request capture", () => {
  const f = fixture();
  const forbidden = () => assert.fail("Emscripten must not request pointer lock inside the frame");
  f.input.invoke("_DisableCursor_", forbidden, []);
  f.input.invoke("_DisableCursor_", forbidden, []);
  f.canvas.emit("pointerdown");
  assert.deepEqual(f.counts(), { requests: 0, releases: 0, recenters: 0 });
  f.canvas.emit("pointerdown", { isTrusted: true });
  f.canvas.emit("pointerdown", { isTrusted: true });
  assert.equal(f.counts().requests, 1, "one request remains pending");
  f.input.invoke("_EnableCursor_", () => f.document.exitPointerLock(), []);
  assert.equal(f.input.snapshot().wanted, false);
  assert.equal(f.counts().releases, 1);
});

test("pointer-lock rejection is consumed, reported, and permits a later click retry", async () => {
  const f = fixture();
  let calls = 0;
  const denied = new DOMException("No transient activation", "NotAllowedError");
  Object.defineProperty(denied, "stack", { value: undefined });
  f.canvas.requestPointerLock = () => {
    calls++;
    if (calls === 1) return Promise.reject(denied);
    f.document.pointerLockElement = f.canvas;
    f.document.emit("pointerlockchange");
    return Promise.resolve();
  };
  f.input.gesture({ isTrusted: true }, () => f.input.invoke("_DisableCursor_", () => {}, []));
  await Promise.resolve();
  assert.equal(f.input.snapshot().pending, false);
  assert.equal(f.input.snapshot().failures, 1);
  assert.match(f.warnings[0], /No transient activation/);
  f.document.emit('pointerlockerror');
  assert.equal(f.input.snapshot().lastFailure.name, 'NotAllowedError');
  f.canvas.emit("pointerdown", { isTrusted: true });
  await Promise.resolve();
  assert.equal(f.input.snapshot().locked, true);
  f.document.pointerLockElement = null; // Browser's Escape gesture.
  f.document.emit("pointerlockchange");
  assert.equal(calls, 2, "unlock must not automatically reacquire the mouse");
});

test("void-returning pointer-lock API settles through error and change events", () => {
  const f = fixture();
  f.canvas.requestPointerLock = () => undefined;
  f.input.gesture({ isTrusted: true }, () => f.input.invoke("_DisableCursor_", () => {}, []));
  assert.equal(f.input.snapshot().pending, true);
  f.document.emit("pointerlockerror");
  assert.equal(f.input.snapshot().pending, false);
  assert.equal(f.input.snapshot().failures, 1);
  f.canvas.emit("pointerdown", { isTrusted: true });
  f.input.invoke("_EnableCursor_", () => {}, []);
  f.document.pointerLockElement = f.canvas; // Late completion after cancellation.
  f.document.emit("pointerlockchange");
  assert.equal(f.counts().releases, 1);
});

test("game shortcuts suppress browser defaults while captured canvas owns focus", async () => {
  const f = fixture();
  let fullscreenRequests = 0;
  f.canvas.requestFullscreen = () => {
    fullscreenRequests++;
    return Promise.reject(new DOMException("Fullscreen unavailable", "NotAllowedError"));
  };
  assert.equal(f.keyboardTarget.emit("keydown", { code: "F5" }).defaultPrevented, false);
  assert.equal(f.delivered.length, 0, "GLFW's window listener must not receive an unfocused key");
  capture(f);
  for (const code of ["F3", "F5", "F6", "F11", "F12", "Tab", "Space", "ArrowDown"]) {
    assert.equal(f.keyboardTarget.emit("keydown", { code, isTrusted: true }).defaultPrevented, true);
  }
  assert.equal(f.delivered.length, 8, "each focused gameplay key still reaches the game's listener");
  assert.equal(fullscreenRequests, 1);
  f.input.invoke("_ToggleBorderlessWindowed_", () => assert.fail("native fullscreen is browser-owned"), []);
  await Promise.resolve();
  assert.match(f.warnings[0], /Fullscreen unavailable/);
  assert.equal(f.keyboardTarget.emit("keydown", { code: "F9" }).defaultPrevented, false);
  f.document.activeElement = {};
  assert.equal(f.keyboardTarget.emit("keyup", { code: "F5" }).defaultPrevented, false);
});

test('HTML control keys retain their default action without entering GLFW input', () => {
  const f = fixture();
  capture(f);
  const button = new Surface();
  f.document.activeElement = button;
  const received = [];
  for (const type of Object.keys(keyCallbacks)) {
    button.addEventListener(type, event => received.push([type, event.code]));
  }
  for (const code of ['Enter', 'Space', 'F5']) {
    for (const type of Object.keys(keyCallbacks)) {
      const event = key(f, type, { code, target: button, isTrusted: true });
      assert.equal(event.defaultPrevented, false, `${type} ${code}: preserve the DOM default`);
    }
  }
  assert.deepEqual(received, ['Enter', 'Space', 'F5'].flatMap(code =>
    Object.keys(keyCallbacks).map(type => [type, code])), 'HTML target handlers receive every key');
  assert.deepEqual(f.delivered, [], 'HTML Enter must not become Haskell save-and-exit');
});

test('keys before capture succeeds do not enter the game input queue', () => {
  const f = fixture();
  f.canvas.requestPointerLock = () => undefined;
  f.canvas.focus();
  for (const pending of [false, true]) {
    if (pending) f.input.engage({ isTrusted: true });
    assert.equal(f.input.snapshot().pending, pending);
    assert.equal(f.input.snapshot().active, false);
    for (const type of Object.keys(keyCallbacks)) {
      const event = key(f, type, { code: 'Enter', target: f.canvas, isTrusted: true });
      assert.equal(event.defaultPrevented, false, 'engagement keeps the browser default action');
      assert.equal(event.stopped, undefined, 'the HTML target can still receive engagement keys');
    }
  }
  assert.deepEqual(f.delivered, [], 'focus and a pending permission request are not gameplay activation');
});

test('an enabled pause menu receives its keys until a resume request is pending', () => {
  const f = fixture({ menuEnabled: () => true });
  capture(f);
  f.input.pause();
  f.document.emit('pointerlockchange');
  for (const code of ['Enter', 'F5']) {
    for (const type of ['keydown', 'keyup']) {
      const event = f.keyboardTarget.emit(type, { code, isTrusted: true });
      assert.equal(event.defaultPrevented, code === 'F5', 'saving must not reload the browser');
    }
  }
  assert.deepEqual(f.delivered, [['keydown', 'Enter'], ['keyup', 'Enter'], ['keydown', 'F5'], ['keyup', 'F5']]);
  for (const type of Object.keys(keyCallbacks)) {
    const event = key(f, type, { code: 'Tab', isTrusted: true });
    assert.equal(event.defaultPrevented, false, 'paused Tab can move focus to HTML controls');
    assert.equal(event.stopped, undefined);
  }
  assert.equal(f.delivered.length, 4, 'paused Tab must not change the in-game shelf');
  f.canvas.requestPointerLock = () => undefined;
  f.input.engage({ isTrusted: true });
  assert.equal(f.input.snapshot().pending, true);
  for (const type of Object.keys(keyCallbacks)) {
    const event = key(f, type, { code: 'Enter', isTrusted: true });
    assert.equal(event.defaultPrevented, false);
  }
  assert.equal(f.delivered.length, 4, 'a resume gesture must not also save and close the game');
});

test('a disabled host leaves DOM key events alone and delivers none to GLFW', () => {
  let enabled = true;
  const f = fixture({ enabled: () => enabled });
  capture(f);
  enabled = false;
  const received = [];
  for (const type of Object.keys(keyCallbacks)) {
    f.canvas.addEventListener(type, event => received.push([type, event.code]));
    const event = key(f, type, { code: 'Space', isTrusted: true });
    assert.equal(event.defaultPrevented, false);
  }
  assert.equal(received.length, 3);
  assert.deepEqual(f.delivered, []);
});

test('post-js wraps each original GLFW callback without changing its receiver or arguments', () => {
  const calls = [], Module = {}, GLFW = {}, receiver = {};
  for (const name of Object.values(keyCallbacks)) {
    GLFW[name] = function(...args) { calls.push({ name, receiver: this, args }); return name; };
  }
  installGlfwHooks(Module, GLFW);
  // Capture the installed callbacks as glfwInit does. The host supplies its
  // policy later; wrappers must read it at event time, not installation time.
  const callbacks = Object.values(keyCallbacks).map(name => [name, GLFW[name]]);
  Module.acceptKey = () => false;
  for (const [, callback] of callbacks) callback.call(receiver, { code: 'Enter' });
  assert.deepEqual(calls, []);
  Module.acceptKey = () => true;
  for (const [name, callback] of callbacks) {
    const event = { code: 'KeyW' };
    assert.equal(callback.call(receiver, event, 42), name);
    assert.deepEqual(calls.at(-1), { name, receiver, args: [event, 42] });
  }
  assert.equal(calls.length, 3);
});

test("ordinary program failures propagate and every error representation is text", () => {
  const { input } = fixture();
  const fault = new Error("invalid game state");
  assert.throws(() => input.invoke("_DrawMesh_", () => { throw fault; }, []), error => error === fault);
  assert.equal(errorText({ stack: undefined, message: "device lost" }), "device lost");
  assert.equal(errorText(undefined), "undefined");
});

test('engagement requests capture before audio, and starts only after capture succeeds', () => {
  const order = [], transitions = [];
  let activation = true;
  const f = fixture({ now: () => 60000, activation: () => ({ isActive: activation }),
    resumeAudio: () => { order.push('audio'); activation = false; }, activity: value => transitions.push(value) });
  f.canvas.requestPointerLock = () => { assert.equal(activation, true); order.push('capture'); };
  f.input.engage({ isTrusted: true });
  assert.deepEqual(order, ['capture', 'audio']);
  assert.deepEqual(transitions, []);
  assert.equal(f.input.snapshot().lastRequest.gestureDelayMs, 0);
  f.document.pointerLockElement = f.canvas;
  f.document.emit('pointerlockchange');
  assert.deepEqual(transitions, [true]);
  assert.equal(f.counts().recenters, 1);
  const escape = f.keyboardTarget.emit('keydown', { code: 'Escape', isTrusted: true });
  assert.equal(escape.stopped, true);
  assert.equal(escape.defaultPrevented, false, 'browser Escape remains available');
  f.document.emit('pointerlockchange');
  f.keyboardTarget.emit('blur');
  assert.deepEqual(transitions, [true, false], 'several release signals are one pause, never a toggle');
});

test('a resume pointerdown cannot become a mining mousedown after instant capture', () => {
  const f = fixture();
  let mines = 0;
  f.canvas.requestPointerLock = () => {
    f.document.pointerLockElement = f.canvas;
    f.document.emit('pointerlockchange');
  };
  f.canvas.addEventListener('mousedown', () => mines++);
  f.canvas.emit('pointerdown', { isTrusted: true });
  f.canvas.emit('mousedown', { isTrusted: true });
  assert.equal(mines, 0);
  f.canvas.emit('pointerdown', { isTrusted: true });
  f.canvas.emit('mousedown', { isTrusted: true });
  assert.equal(mines, 1, 'a later gameplay click reaches raylib');
});

test('canceling a resume pointerdown does not swallow the next gameplay click', () => {
  const f = fixture();
  capture(f);
  f.input.pause();
  f.document.emit('pointerlockchange');
  f.canvas.requestPointerLock = () => undefined;
  let mines = 0;
  f.canvas.addEventListener('mousedown', () => mines++);
  assert.equal(primaryClick(f.canvas).defaultPrevented, true);
  assert.equal(mines, 0, 'the browser emits no compatibility mousedown for the canceled pointerdown');
  f.document.pointerLockElement = f.canvas;
  f.document.emit('pointerlockchange');
  assert.equal(primaryClick(f.canvas).defaultPrevented, false);
  assert.equal(mines, 1, 'the first gameplay click after successful capture reaches raylib');
});

test('a failed synchronous request is attempted once and retains its error class', () => {
  const f = fixture();
  let calls = 0;
  f.canvas.requestPointerLock = () => { calls++; throw new DOMException('Denied', 'SecurityError'); };
  f.input.engage({ isTrusted: true });
  assert.equal(calls, 1);
  assert.equal(f.input.snapshot().lastFailure.name, 'SecurityError');
});
