export const errorText = error => String(error?.stack || error?.message || error);

const gameKeys = new Set(['F2', 'F3', 'F5', 'F6', 'F11', 'F12', 'Tab', 'Space',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

// Preparation precedes engagement. A trusted event cannot preserve activation
// through a long synchronous startup; request capture before doing other work.
export function canvasInput({ canvas, document, keyboardTarget, fullscreenTarget = canvas,
  recenter = () => {}, enabled = () => true, menuEnabled = () => false, resumeAudio = () => {},
  activity = () => {}, warn = () => {}, changed = () => {},
  activation = () => typeof navigator === 'undefined' ? null : navigator.userActivation,
  now = () => performance.now() }) {
  let wanted = false, inGesture = false, gestureAt = 0, pending = null, latest = null, consumeMouseDown = false;
  let attempts = 0, failures = 0, lastFailure = null, lastRequest = null, active = false;
  const locked = () => document.pointerLockElement === canvas;
  const focused = () => document.activeElement === canvas;
  const acceptKey = event => focused() && enabled()
    && (active || (menuEnabled() && !pending && (event.code || event.key) !== 'Tab'));
  const setActive = value => { if (active !== value) { active = value; activity(value); } };
  const notify = () => { setActive(wanted && locked()); changed(); };
  const reject = (attempt, error) => {
    if (!attempt) return;
    if (attempt.failed && error?.name === 'Error') return; // Do not erase the Promise's DOMException with a generic event.
    if (pending === attempt) pending = null;
    lastFailure = { name: error?.name ?? 'Error', message: error?.message ?? String(error) };
    if (!attempt.failed) { attempt.failed = true; failures++; }
    warn(`Mouse capture failed (${lastFailure.name}): ${lastFailure.message}`);
    notify();
  };
  const request = () => {
    if (!inGesture || !wanted || locked() || pending || !enabled()) return;
    const attempt = { number: ++attempts, failed: false };
    latest = pending = attempt;
    const userActivation = activation();
    lastRequest = { timeMs: now(), gestureDelayMs: now() - gestureAt,
      activation: userActivation?.isActive ?? null,
      hasBeenActive: userActivation?.hasBeenActive ?? null,
      focused: document.hasFocus?.() ?? null, visibility: document.visibilityState ?? null,
      connected: canvas.isConnected ?? null };
    try {
      if (typeof canvas.requestPointerLock !== 'function') throw new Error('Mouse capture is unavailable');
      const result = canvas.requestPointerLock();
      result?.then(() => {
        if (pending === attempt) pending = null;
        if (!wanted && locked()) document.exitPointerLock();
        notify();
      }, error => reject(attempt, error));
    } catch (error) { reject(attempt, error); }
    notify();
  };
  const gesture = (event, action = () => {}) => {
    const previous = inGesture;
    inGesture = event.isTrusted === true;
    gestureAt = now();
    const before = attempts;
    try { const value = action(); if (attempts === before) request(); return value; }
    finally { inGesture = previous; }
  };
  const engage = event => {
    if (!enabled() || !event.isTrusted || locked()) return;
    canvas.focus({ preventScroll: true });
    gesture(event, () => {
      wanted = true;
      request();
      try { resumeAudio()?.catch(error => warn(`Audio could not resume: ${errorText(error)}`, 'audio')); }
      catch (error) { warn(`Audio could not resume: ${errorText(error)}`, 'audio'); }
    });
  };
  const pause = () => {
    wanted = false;
    if (locked()) document.exitPointerLock();
    notify();
  };
  const fullscreen = () => {
    try {
      const result = document.fullscreenElement === fullscreenTarget
        ? document.exitFullscreen() : fullscreenTarget.requestFullscreen();
      result?.catch(error => warn(`Fullscreen was declined: ${errorText(error)}`, 'fullscreen'));
    } catch (error) { warn(`Fullscreen was declined: ${errorText(error)}`, 'fullscreen'); }
  };

  canvas.addEventListener('pointerdown', event => {
    canvas.focus({ preventScroll: true });
    consumeMouseDown = !active;
    if (!active) {
      event.stopImmediatePropagation?.(); event.preventDefault(); engage(event);
    }
  }, { capture: true });
  // Emscripten listens to mousedown. Resuming must not also mine terrain.
  canvas.addEventListener('mousedown', event => {
    if (consumeMouseDown || !active || pending) { event.stopImmediatePropagation?.(); event.preventDefault(); }
    consumeMouseDown = false;
  }, { capture: true });
  document.addEventListener('pointerlockchange', () => {
    pending = null;
    if (locked()) {
      lastFailure = null;
      if (!wanted) document.exitPointerLock();
      else recenter();
    } else { wanted = false; }
    notify();
  });
  document.addEventListener('pointerlockerror', () =>
    reject(pending ?? latest, new Error('The browser rejected the pointer-lock request')));
  keyboardTarget.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pause(); });
  for (const type of ['keydown', 'keyup']) {
    keyboardTarget.addEventListener(type, event => {
      // Gate GLFW's own callbacks separately. Stopping window capture here
      // would also prevent HTML controls from receiving their target events.
      if (!acceptKey(event)) return;
      const code = event.code || event.key;
      if (code === 'Escape') {
        event.stopImmediatePropagation?.();
        if (type === 'keydown') pause();
        return; // Preserve browser Escape; do not toggle Haskell's menu twice.
      }
      if (gameKeys.has(code)) event.preventDefault();
      if (type === 'keydown' && code === 'F11' && !event.repeat && event.isTrusted) fullscreen();
    }, { capture: true });
  }
  return {
    gesture, engage, pause, fullscreen, acceptKey,
    snapshot: () => ({ wanted, locked: locked(), active, pending: pending !== null,
      attempts, failures, lastFailure, lastRequest }),
    invoke(name, fn, args) {
      if (name === '_DisableCursor_') { wanted = true; request(); notify(); return; }
      if (name === '_EnableCursor_') { wanted = false; notify(); }
      if (name === '_ToggleBorderlessWindowed_') return;
      return fn(...args);
    },
  };
}
