export const errorText = error => String(error?.stack || error?.message || error);

const gameKeys = new Set(["F2", "F3", "F5", "F6", "F11", "F12", "Tab", "Space",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

// Browser privileges belong to a real user event, not to the subsequent game
// frame. Raylib still receives the original keyboard and pointer events.
export function canvasInput({ canvas, document, keyboardTarget, recenter = () => {},
  enabled = () => true, warn = () => {}, changed = () => {} }) {
  let wanted = false, inGesture = false, pending = null, latest = null;
  let attempts = 0, failures = 0, lastFailure = null;
  const locked = () => document.pointerLockElement === canvas;
  const focused = () => document.activeElement === canvas;

  const reject = (attempt, error) => {
    if (!attempt) return;
    if (pending === attempt) pending = null;
    lastFailure = errorText(error);
    if (!attempt.failed) {
      attempt.failed = true;
      failures++;
      warn(`Mouse capture was declined; click the game to retry. ${lastFailure}`);
    }
    changed();
  };
  const request = () => {
    if (!inGesture || !wanted || locked() || pending || !enabled()) return;
    const attempt = { number: ++attempts, failed: false };
    latest = pending = attempt;
    try {
      if (typeof canvas.requestPointerLock !== "function") {
        throw new Error("This browser does not support mouse capture");
      }
      const result = canvas.requestPointerLock();
      // Older browsers return void; their change/error events settle the request.
      result?.then(() => {
        if (pending === attempt) pending = null;
        if (!wanted && locked()) document.exitPointerLock();
        changed();
      }, error => reject(attempt, error));
    } catch (error) { reject(attempt, error); }
    changed();
  };
  const gesture = (event, action = () => {}) => {
    const previous = inGesture;
    inGesture = event.isTrusted === true;
    try { const value = action(); request(); return value; }
    finally { inGesture = previous; }
  };
  const fullscreen = () => {
    try {
      const result = document.fullscreenElement === canvas
        ? document.exitFullscreen() : canvas.requestFullscreen();
      result?.catch(error => warn(`Fullscreen was declined. ${errorText(error)}`));
    } catch (error) { warn(`Fullscreen was declined. ${errorText(error)}`); }
  };

  canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));
  canvas.addEventListener("click", event => gesture(event));
  document.addEventListener("pointerlockchange", () => {
    pending = null;
    if (locked()) {
      lastFailure = null;
      if (!wanted) document.exitPointerLock();
    }
    // Escape may release the mouse. Never reacquire it from this event.
    changed();
  });
  document.addEventListener("pointerlockerror", () => {
    reject(pending ?? latest, new Error("The browser rejected the pointer-lock request"));
  });
  for (const type of ["keydown", "keyup"]) {
    keyboardTarget.addEventListener(type, event => {
      if (!focused() || !enabled()) return;
      const code = event.code || event.key;
      if (gameKeys.has(code)) event.preventDefault();
      if (type === "keydown" && code === "F11" && !event.repeat && event.isTrusted) fullscreen();
    }, { capture: true });
  }
  return {
    gesture,
    snapshot: () => ({ wanted, locked: locked(), pending: pending !== null, attempts, failures, lastFailure }),
    invoke(name, fn, args) {
      if (name === "_DisableCursor_") {
        if (!wanted) { wanted = true; recenter(); }
        request();
        changed();
        return;
      }
      if (name === "_EnableCursor_") { wanted = false; changed(); }
      // The same F11 event already requested browser fullscreen while trusted.
      if (name === "_ToggleBorderlessWindowed_") return;
      return fn(...args);
    },
  };
}
