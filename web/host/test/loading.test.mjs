import test from 'node:test';
import assert from 'node:assert/strict';
import { compileModule, downloads } from '../src/loading.js';
import { drawingSize, renderScale } from '../src/viewport.js';

test('decoded progress does not confuse compressed Content-Length with manifest bytes', async () => {
  const values = [];
  const transfer = downloads(value => values.push(value), async () => new Response(new Uint8Array(100),
    { headers: { 'content-encoding': 'gzip', 'content-length': '20' } }));
  transfer.expect('assets/audio.wav', 100);
  await (await transfer.fetch('assets/audio.wav')).arrayBuffer();
  assert.equal(values.at(-1).loaded, 100);
  assert.equal(values.at(-1).total, 100);
  assert.equal(values.at(-1).completed, 1);
  assert.ok(values.every(value => value.loaded <= value.total));
});

test('streaming and MIME fallback compile the same module; HTTP failure stays a failure', async () => {
  const emptyWasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
  for (const type of ['application/wasm', 'application/wasm; charset=utf-8', 'application/octet-stream']) {
    const result = await compileModule(new Response(emptyWasm, { headers: { 'content-type': type } }));
    assert.ok(result instanceof WebAssembly.Module);
  }
  await assert.rejects(compileModule(new Response('', { status: 404 })), /HTTP 404/);
});

test('Wasm compilation receives the original response so browser cache metadata survives', async () => {
  const response = new Response(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]),
    { headers: { 'content-type': 'application/wasm' } });
  const transfer = downloads(() => {}, async () => response);
  const observed = await transfer.fetch('game.wasm');
  assert.equal(observed, response);
  await compileModule(observed);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(transfer.snapshot().loaded, 8);
});

test('default rendering preserves display pixels, including high-DPI displays', () => {
  assert.deepEqual(drawingSize(1920, 1080), { width: 1920, height: 1080 });
  assert.deepEqual(drawingSize(1280, 720, { pixelRatio: 2 }), { width: 2560, height: 1440 });
  assert.deepEqual(drawingSize(1200, 800, { pixelRatio: 1.25 }), { width: 1500, height: 1000 });
});

test('quality is an explicit scale choice and corrupt preferences return to full quality', () => {
  for (const value of [null, '', 'fast', 0, -1, 2]) assert.equal(renderScale(value), 1);
  assert.equal(renderScale('1'), 1);
  assert.equal(renderScale('0.75'), 0.75);
  assert.equal(renderScale('0.5'), 0.5);
});

test('hardware limits preserve aspect ratio without becoming a fixed quality ceiling', () => {
  assert.deepEqual(drawingSize(3840, 2160, { maxDimension: 2048 }), { width: 2048, height: 1152 });
  assert.deepEqual(drawingSize(3840, 2160, { maxDimension: 8192 }), { width: 3840, height: 2160 });
});
