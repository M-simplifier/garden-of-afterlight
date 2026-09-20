import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { drawingSize } from '../src/viewport.js';

const postJs = readFileSync(new URL('../refresh-memory.js', import.meta.url), 'utf8');

function fixture() {
  const style = Object.freeze({ width: '100%', height: '100%' });
  const canvas = { style, widthNative: 1280, heightNative: 720 };
  const buffer = { width: 1280, height: 720 }, writes = [], calls = [];
  for (const axis of ['width', 'height']) {
    Object.defineProperty(canvas, axis, {
      get: () => buffer[axis],
      set: value => { writes.push([axis, value]); buffer[axis] = value; },
    });
  }
  const win = { id: 1, width: 1280, height: 720, windowSizeFunc: 10, framebufferSizeFunc: 20 };
  const GLFW = { active: win, WindowFromId: id => id === win.id ? win : null,
    onKeydown() {}, onKeyup() {}, onKeyPress() {} };
  const document = { fullscreen: false, fullscreenElement: null };
  const screen = { width: 2560, height: 1440 };
  const Browser = {
    requestFullscreen: () => assert.fail('a render resize must not request fullscreen'),
    exitFullscreen: () => assert.fail('a render resize must not exit fullscreen'),
    setCanvasSize: () => assert.fail('do not re-enter legacy fullscreen/CSS size inference'),
  };
  runInNewContext(postJs, { Module: { canvas }, GLFW, Browser, document, screen,
    updateMemoryViews() {}, getWasmTableEntry: pointer => (...args) => {
      // raylib's window callback sets its viewport/FBO size. Both sides must
      // already agree before that callback runs.
      assert.equal(canvas.width, args[1]);
      assert.equal(canvas.height, args[2]);
      calls.push([pointer, ...args]);
    } });
  const dimensions = () => [canvas.width, canvas.height, canvas.widthNative, canvas.heightNative, win.width, win.height];
  return { GLFW, win, canvas, document, screen, calls, writes, dimensions, style };
}

test('normal render resize updates backing dimensions before both C callbacks', () => {
  const f = fixture();
  f.GLFW.setWindowSize(1, 960, 600);
  assert.deepEqual(f.dimensions(), [960, 600, 960, 600, 960, 600]);
  assert.deepEqual(f.calls, [[10, 1, 960, 600], [20, 1, 960, 600]]);
  assert.deepEqual(f.writes, [['width', 960], ['height', 600]]);
  assert.equal(f.canvas.style, f.style);
});

test('fullscreen entry and exit retain display density and CSS ownership', () => {
  const f = fixture(), game = { id: 'game' };
  f.document.fullscreen = true;
  f.document.fullscreenElement = game;
  const size = drawingSize(2576, 1408, { pixelRatio: 1.25 });
  f.GLFW.setWindowSize(1, size.width, size.height);
  assert.equal(f.document.fullscreenElement, game);
  assert.equal(f.document.fullscreen, true);
  assert.equal(f.canvas.width, 3220);
  assert.equal(f.canvas.height, 1760);
  assert.deepEqual(f.dimensions(), [size.width, size.height, size.width, size.height, size.width, size.height]);
  assert.deepEqual(f.calls, [[10, 1, size.width, size.height], [20, 1, size.width, size.height]]);
  assert.equal(f.canvas.style, f.style);

  f.document.fullscreen = false;
  f.document.fullscreenElement = null;
  f.GLFW.setWindowSize(1, 1280, 720);
  assert.deepEqual(f.dimensions(), [1280, 720, 1280, 720, 1280, 720]);
  assert.deepEqual(f.calls.slice(2), [[10, 1, 1280, 720], [20, 1, 1280, 720]]);
});

test('matching screen dimensions does not implicitly request fullscreen', () => {
  const f = fixture();
  f.screen.width = 960;
  f.screen.height = 600;
  f.GLFW.setWindowSize(1, 960, 600);
  assert.equal(f.document.fullscreenElement, null);
  assert.deepEqual(f.dimensions(), [960, 600, 960, 600, 960, 600]);
});

test('canvas resize notifications do not promote dimensions to fullscreen screen size', () => {
  const f = fixture();
  f.document.fullscreen = true;
  f.GLFW.onCanvasResize(1200, 768);
  assert.deepEqual(f.dimensions(), [1200, 768, 1200, 768, 1200, 768]);
  assert.deepEqual(f.calls, [[10, 1, 1200, 768], [20, 1, 1200, 768]]);
  f.GLFW.onCanvasResize(1200, 768);
  assert.equal(f.calls.length, 2, 'a duplicate notification does not notify C again');
  assert.equal(f.writes.length, 2, 'unchanged backing dimensions must not reset the canvas');
});

test('an unchanged explicit size preserves the buffer and the window callback contract', () => {
  const f = fixture();
  f.GLFW.setWindowSize(1, 1280, 720);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.calls, [[10, 1, 1280, 720]]);
  f.GLFW.setWindowSize(99, 1, 1);
  assert.deepEqual(f.dimensions(), [1280, 720, 1280, 720, 1280, 720]);
  assert.equal(f.calls.length, 1, 'an unknown GLFW window is ignored');
});
