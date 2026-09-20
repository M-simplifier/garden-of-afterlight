import test from "node:test";
import assert from "node:assert/strict";
import { readScalar, writeScalar, immediatePoll, raylibImports, refreshRaylibMemory } from "../src/bridge.js";

test("ABI transports f64 and signed/unsigned 64-bit values at their byte addresses", () => {
  const view = new DataView(new ArrayBuffer(96));
  view.setFloat64(24, 123456.75, true);
  assert.equal(readScalar(view, 24, 8, 2), 123456.75);
  writeScalar(view, 40, 8, 2, -Math.PI);
  assert.equal(view.getFloat64(40, true), -Math.PI);
  writeScalar(view, 56, 8, 0, -17n);
  assert.equal(readScalar(view, 56, 8, 0), -17n);
  writeScalar(view, 72, 8, 1, 18446744073709551615n);
  assert.equal(readScalar(view, 72, 8, 1), 18446744073709551615n);
});

test("WASI poll uses the Preview1 48-byte input / 32-byte output ABI", () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer);
  view.setBigUint64(0, 987654321n, true);
  view.setUint8(8, 2); // fd_write
  view.setUint32(16, 1, true); // stdout
  view.setBigUint64(48, 11n, true);
  view.setUint8(56, 1); // fd_read
  view.setUint32(64, 0, true); // empty stdin
  assert.equal(immediatePoll(memory)(0, 128, 2, 224), 0);
  assert.equal(view.getUint32(224, true), 2);
  assert.equal(view.getBigUint64(128, true), 987654321n);
  assert.equal(view.getUint8(138), 2);
  assert.equal(view.getUint16(136, true), 0);
  assert.equal(view.getBigUint64(160, true), 11n);
  assert.equal(view.getUint8(170), 1);
  assert.equal(view.getUint16(184, true), 1);
});

test("future WASI sleep is rejected instead of blocking the browser thread", () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer);
  view.setUint32(16, 1, true); // monotonic clock
  view.setBigUint64(24, 50000000n, true); // relative 50ms
  assert.equal(immediatePoll(memory)(0, 128, 1, 224), 58);
  assert.equal(view.getUint32(224, true), 0);
});

test("FFI refreshes detached Emscripten views and frees through the allocation's owner", () => {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 3 });
  const releases = [];
  const raylib = {
    HEAPU8: new Uint8Array(memory.buffer),
    refreshMemoryViews() { this.HEAPU8 = new Uint8Array(memory.buffer); },
    _MemFree_(pointer) { releases.push(["raylib", pointer]); },
    _MemAlloc_() { return 512; },
    _GetTime_() {
      assert.equal(this, undefined); // dispatcher does not depend on method binding
      assert.equal(raylib.HEAPU8.buffer, memory.buffer);
      return 123.456;
    },
  };
  const bridge = raylibImports(memory, raylib, {
    raylibLimit: 65536, freeHaskell: pointer => releases.push(["haskell", pointer]),
  });
  memory.grow(1);
  assert.equal(raylib.HEAPU8.byteLength, 0);
  const name = new TextEncoder().encode("_GetTime_");
  new Uint8Array(memory.buffer, 65536, name.length).set(name);
  const pointer = bridge.callRaylibFunction(65536, name.length, 0, 0, 0, 0, 8, 2);
  assert.equal(new DataView(memory.buffer).getFloat64(pointer, true), 123.456);
  bridge.free(128);
  bridge.free(65540);
  assert.deepEqual(releases, [["raylib", 128], ["haskell", 65540]]);
  // GHC may also allocate after the final FFI, before returning to browser events.
  memory.grow(1);
  refreshRaylibMemory(memory, raylib);
  raylib.HEAPU8[100] = 42;
  assert.equal(new Uint8Array(memory.buffer)[100], 42);
});
