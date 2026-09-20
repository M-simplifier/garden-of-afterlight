import test from 'node:test';
import assert from 'node:assert/strict';
import { compileModule, downloads } from '../src/loading.js';
import { drawingSize } from '../src/viewport.js';

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

test('large viewports keep aspect ratio within pixel rounding and respect the render budget', () => {
  for (const [width, height] of [[3840, 2160], [1969, 1272], [1400, 900], [800, 600]]) {
    const result = drawingSize(width, height);
    assert.ok(result.width * result.height <= 1280 * 720);
    assert.ok(Math.abs(result.width / result.height - width / height) < 0.004);
  }
});
