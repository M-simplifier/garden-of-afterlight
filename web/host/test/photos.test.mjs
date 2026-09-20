import test from "node:test";
import assert from "node:assert/strict";
import { Directory } from "@bjorn3/browser_wasi_shim";
import { directory } from "../src/files.js";
import { photoDownload, screenshotBridge } from "../src/photos.js";

test("screenshot becomes a WASI file before Haskell resumes; missing output stays a failure", () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const root = new Directory(new Map()), files = new Map(), folders = [];
  const captured = [], warnings = [];
  const raylibFS = {
    mkdirTree: path => folders.push(path),
    analyzePath: path => ({ exists: files.has(path) }),
    readFile: path => files.get(path),
  };
  const bridge = screenshotBridge({ memory, root, raylibFS,
    captured: (...args) => captured.push(args), warn: message => warnings.push(message) });
  const path = "Screenshots/Garden-test.png";
  new Uint8Array(memory.buffer, 32).set(new TextEncoder().encode(`${path}\0`));
  bridge("_TakeScreenshot_", () => {}, [32]);
  assert.equal(root.contents.has("Screenshots"), false);
  assert.equal(captured.length, 0);
  assert.match(warnings[0], /Photo export failed/);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]);
  bridge("_TakeScreenshot_", () => files.set(path, png), [32]);
  assert.deepEqual(directory(root, "Screenshots").contents.get("Garden-test.png").data, png);
  assert.deepEqual(captured, [[path, png]]);
  assert.deepEqual(folders, ["Screenshots", "Screenshots"]);
});

test("latest photo download uses the exported bytes and releases the previous Blob URL", async () => {
  const link = { hidden: true }, blobs = [], revoked = [];
  const publish = photoDownload(link, {
    createObjectURL: blob => { blobs.push(blob); return `blob:photo-${blobs.length}`; },
    revokeObjectURL: url => revoked.push(url),
  });
  publish("Screenshots/first.png", new Uint8Array([1, 2, 3]));
  publish("Screenshots/second.png", new Uint8Array([4, 5, 6]));
  assert.equal(link.hidden, false);
  assert.equal(link.href, "blob:photo-2");
  assert.equal(link.download, "second.png");
  assert.deepEqual(revoked, ["blob:photo-1"]);
  assert.deepEqual(new Uint8Array(await blobs[1].arrayBuffer()), new Uint8Array([4, 5, 6]));
  assert.equal(blobs[1].type, "image/png");
});
