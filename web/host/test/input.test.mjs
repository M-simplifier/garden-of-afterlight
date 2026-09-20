import test from "node:test";
import assert from "node:assert/strict";
import { canvasInput, errorText } from "../src/input.js";

class Surface {
  listeners = new Map();
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  emit(type, properties = {}) {
    const event = { isTrusted: false, defaultPrevented: false, ...properties,
      preventDefault() { this.defaultPrevented = true; } };
    for (const fn of this.listeners.get(type) ?? []) fn(event);
    return event;
  }
}
function fixture() {
  const document = new Surface(), canvas = new Surface(), keyboardTarget = new Surface();
  const warnings = [];
  let requests = 0, releases = 0, recenters = 0;
  canvas.focus = () => { document.activeElement = canvas; };
  canvas.requestPointerLock = () => { requests++; return Promise.resolve(); };
  document.exitPointerLock = () => { releases++; document.pointerLockElement = null; };
  const input = canvasInput({ canvas, document, keyboardTarget,
    recenter: () => recenters++, warn: message => warnings.push(message) });
  return { document, canvas, keyboardTarget, input, warnings,
    counts: () => ({ requests, releases, recenters }) };
}

test("frame calls describe cursor demand; only trusted clicks request capture", () => {
  const f = fixture();
  const forbidden = () => assert.fail("Emscripten must not request pointer lock inside the frame");
  f.input.invoke("_DisableCursor_", forbidden, []);
  f.input.invoke("_DisableCursor_", forbidden, []);
  f.canvas.emit("click");
  assert.deepEqual(f.counts(), { requests: 0, releases: 0, recenters: 1 });
  f.canvas.emit("click", { isTrusted: true });
  f.canvas.emit("click", { isTrusted: true });
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
  f.canvas.emit("click", { isTrusted: true });
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
  f.canvas.emit("click", { isTrusted: true });
  f.input.invoke("_EnableCursor_", () => {}, []);
  f.document.pointerLockElement = f.canvas; // Late completion after cancellation.
  f.document.emit("pointerlockchange");
  assert.equal(f.counts().releases, 1);
});

test("game shortcuts suppress browser defaults only while canvas owns focus", async () => {
  const f = fixture();
  let delivered = 0, fullscreenRequests = 0;
  f.keyboardTarget.addEventListener("keydown", () => delivered++);
  f.canvas.requestFullscreen = () => {
    fullscreenRequests++;
    return Promise.reject(new DOMException("Fullscreen unavailable", "NotAllowedError"));
  };
  assert.equal(f.keyboardTarget.emit("keydown", { code: "F5" }).defaultPrevented, false);
  f.canvas.focus();
  for (const code of ["F3", "F5", "F6", "F11", "F12", "Tab", "Space", "ArrowDown"]) {
    assert.equal(f.keyboardTarget.emit("keydown", { code, isTrusted: true }).defaultPrevented, true);
  }
  assert.equal(delivered, 9, "the original key still reaches the game's listener");
  assert.equal(fullscreenRequests, 1);
  f.input.invoke("_ToggleBorderlessWindowed_", () => assert.fail("native fullscreen is browser-owned"), []);
  await Promise.resolve();
  assert.match(f.warnings[0], /Fullscreen unavailable/);
  assert.equal(f.keyboardTarget.emit("keydown", { code: "F9" }).defaultPrevented, false);
  f.document.activeElement = {};
  assert.equal(f.keyboardTarget.emit("keyup", { code: "F5" }).defaultPrevented, false);
});

test("ordinary program failures propagate and every error representation is text", () => {
  const { input } = fixture();
  const fault = new Error("invalid game state");
  assert.throws(() => input.invoke("_DrawMesh_", () => { throw fault; }, []), error => error === fault);
  assert.equal(errorText({ stack: undefined, message: "device lost" }), "device lost");
  assert.equal(errorText(undefined), "undefined");
});
