import test from "node:test";
import assert from "node:assert/strict";
import { WASI, PreopenDirectory, wasi } from "@bjorn3/browser_wasi_shim";
import { attachPersistence, directory, gameEnvironment, loadAssets } from "../src/files.js";

const SAVE = ".runtime/garden/save-v2.txt";
const KEY = "afterlight:saves:v1";
const utf8 = new TextEncoder();
const text = new TextDecoder();

function fixture(store = new Map()) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const rootFd = new PreopenDirectory(".", new Map());
  const host = new WASI([], [], [undefined, undefined, undefined, rootFd], { debug: false });
  host.initialize({ exports: { memory } });
  const backing = { failure: null,
    getItem: key => store.get(key) ?? null,
    setItem(key, value) { if (this.failure) throw this.failure; store.set(key, value); } };
  const diagnostics = attachPersistence(host, memory, rootFd.dir, { storage: () => backing });
  function path(value, pointer) {
    const bytes = utf8.encode(value);
    new Uint8Array(memory.buffer, pointer, bytes.length).set(bytes);
    return bytes.length;
  }
  function writeFile(name, contents) {
    const size = path(name, 0);
    assert.equal(host.wasiImport.path_open(3, 0, 0, size, wasi.OFLAGS_CREAT | wasi.OFLAGS_TRUNC,
      BigInt(wasi.RIGHTS_FD_WRITE), 0n, 0, 4096), 0);
    const view = new DataView(memory.buffer);
    const fd = view.getUint32(4096, true);
    const data = utf8.encode(contents);
    new Uint8Array(memory.buffer, 8192, data.length).set(data);
    view.setUint32(4096, 8192, true);
    view.setUint32(4100, data.length, true);
    assert.equal(host.wasiImport.fd_write(fd, 4096, 1, 4112), 0);
    return host.wasiImport.fd_close(fd);
  }
  return { memory, root: rootFd.dir, diagnostics, backing, store, writeFile,
    rename(from, to) { const a = path(from, 0), b = path(to, 1024); return host.wasiImport.path_rename(3, 0, a, 3, 1024, b); },
    read(name) { const segments = name.split("/"); const last = segments.pop();
      const file = directory(rootFd.dir, segments.join("/"))?.contents.get(last);
      return file ? text.decode(file.data) : null; },
  };
}

test("one fetched asset is installed at the same path in raylib and WASI", async () => {
  const run = fixture();
  const installed = new Map();
  const bytes = utf8.encode("庭の文字");
  const assets = await loadAssets({ mkdirTree() {}, writeFile(path, data) { installed.set(path, data); } },
    run.root, async path => path.includes("manifest")
      ? { ok: true, json: async () => [{ path: "assets/fonts/glyphs.txt" }] }
      : { ok: true, arrayBuffer: async () => bytes.buffer });
  assert.equal(assets.count, 1);
  assert.deepEqual(installed.get("/assets/fonts/glyphs.txt"), bytes);
  assert.equal(run.read("assets/fonts/glyphs.txt"), "庭の文字");
});

test("missing manifest permits a small sample; missing listed asset fails", async () => {
  const run = fixture();
  assert.equal((await loadAssets(null, run.root, async () => ({ status: 404 }))).missingManifest, true);
  await assert.rejects(() => loadAssets({}, run.root, async path => path.includes("manifest")
    ? { ok: true, json: async () => [{ path: "assets/missing.png" }] }
    : { ok: false, status: 404 }), /Asset assets\/missing.png/);
});

test("temp rename atomically persists the checkpoint and a new host restores it", () => {
  const run = fixture();
  assert.equal(run.writeFile(`${SAVE}.next`, "Checkpoint 4 庭"), 0);
  assert.equal(run.store.has(KEY), false);
  assert.equal(run.rename(`${SAVE}.next`, SAVE), 0);
  assert.equal(run.read(`${SAVE}.next`), null);
  assert.equal(run.diagnostics.writes, 1);
  const reloaded = fixture(run.store);
  assert.equal(reloaded.read(SAVE), "Checkpoint 4 庭");
  assert.equal(reloaded.diagnostics.restoredFiles, 1);
});

test("quota failure returns ENOSPC, restores the old checkpoint and retains temp", () => {
  const run = fixture();
  assert.equal(run.writeFile(`${SAVE}.next`, "old"), 0);
  assert.equal(run.rename(`${SAVE}.next`, SAVE), 0);
  const oldStored = run.store.get(KEY);
  assert.equal(run.writeFile(`${SAVE}.next`, "new"), 0);
  run.backing.failure = new DOMException("Storage is full", "QuotaExceededError");
  assert.equal(run.rename(`${SAVE}.next`, SAVE), wasi.ERRNO_NOSPC);
  assert.equal(run.read(SAVE), "old");
  assert.equal(run.read(`${SAVE}.next`), "new");
  assert.equal(run.store.get(KEY), oldStored);
  assert.equal(run.diagnostics.lastError.errno, wasi.ERRNO_NOSPC);
});

test("previous and rejected copies persist on close, while diagnostic files do not", () => {
  const run = fixture();
  assert.equal(run.writeFile(`${SAVE}.previous`, "previous"), 0);
  assert.equal(run.writeFile(`${SAVE}.rejected.2`, "rejected"), 0);
  assert.equal(run.writeFile(".runtime/garden/metrics.csv", "not persistent"), 0);
  const restored = fixture(run.store);
  assert.equal(restored.read(`${SAVE}.previous`), "previous");
  assert.equal(restored.read(`${SAVE}.rejected.2`), "rejected");
  assert.equal(restored.read(".runtime/garden/metrics.csv"), null);
  assert.equal(restored.diagnostics.restoredFiles, 2);
});

test("a failed copy close reports EACCES and restores the durable backup", () => {
  const run = fixture();
  assert.equal(run.writeFile(`${SAVE}.previous`, "safe backup"), 0);
  run.backing.failure = new DOMException("Storage denied", "SecurityError");
  assert.equal(run.writeFile(`${SAVE}.previous`, "uncommitted backup"), wasi.ERRNO_ACCES);
  assert.equal(run.read(`${SAVE}.previous`), "safe backup");
});

test("corrupt browser storage is retained, not silently overwritten", () => {
  const store = new Map([[KEY, "not-json"]]);
  const run = fixture(store);
  assert.equal(run.writeFile(`${SAVE}.next`, "new"), 0);
  assert.equal(run.rename(`${SAVE}.next`, SAVE), wasi.ERRNO_IO);
  assert.equal(store.get(KEY), "not-json");
  assert.equal(run.read(SAVE), null);
});

test("browser diagnostics set only the explicit game environment allowlist", () => {
  const env = gameEnvironment(new URLSearchParams("width=1920&height=1080&frames=300&tour=islands&scene=night&paused=1&hud=0&GARDEN_SAVE_PATH=elsewhere&path=/tmp"));
  assert.deepEqual(env.sort(), ["GARDEN_WIDTH=1920", "GARDEN_HEIGHT=1080", "GARDEN_FRAMES=300",
    "GARDEN_TOUR=islands", "GARDEN_SCENE=night", "GARDEN_PAUSED=1", "GARDEN_HUD=0"].sort());
  assert.deepEqual(gameEnvironment(new URLSearchParams("width=1&height=no&frames=-3&tour=unknown")),
    ["GARDEN_WIDTH=1280", "GARDEN_HEIGHT=720", "GARDEN_PAUSED=1"]);
});
