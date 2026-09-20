import { Directory, File, wasi as errno } from "@bjorn3/browser_wasi_shim";

const decoder = new TextDecoder();
const SAVE_FOLDER = ".runtime/garden";
const SAVE_NAME = /^save-v2\.txt(?:\.previous|\.rejected(?:\.\d+)?)?$/;
const STORE_KEY = "afterlight:saves:v1";

function parts(path) {
  if (typeof path !== "string" || path.startsWith("/") || /[\\\0:]/.test(path)) return null;
  const result = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (result.pop() === undefined) return null; }
    else result.push(part);
  }
  return result;
}

export function directory(root, path, create = false) {
  const segments = parts(path);
  if (!segments) return null;
  let current = root;
  for (const name of segments) {
    let next = current.contents.get(name);
    if (!next && create) {
      next = new Directory(new Map());
      current.contents.set(name, next);
    }
    if (!(next instanceof Directory)) return null;
    current = next;
  }
  return current;
}

export function putFile(root, path, bytes, readonly = false) {
  const segments = parts(path);
  if (!segments?.length) throw new Error(`Invalid file path: ${path}`);
  const name = segments.pop();
  const parent = directory(root, segments.join("/"), true);
  if (!parent) throw new Error(`Not a directory: ${path}`);
  parent.contents.set(name, new File(bytes, { readonly }));
}

function locationOf(root, path) {
  const segments = parts(path);
  if (!segments?.length) return null;
  const name = segments.pop();
  const parent = directory(root, segments.join("/"));
  return parent ? { parent, name, inode: parent.contents.get(name) } : null;
}

function findDirectory(root, wanted, prefix = "") {
  if (root === wanted) return prefix;
  for (const [name, child] of root.contents) {
    if (child instanceof Directory) {
      const found = findDirectory(child, wanted, prefix ? `${prefix}/${name}` : name);
      if (found !== null) return found;
    }
  }
  return null;
}

export async function loadAssets(raylibFS, root, fetchFile = fetch, expect = () => {}) {
  const response = await fetchFile("./assets-manifest.json");
  if (response.status === 404) return { count: 0, bytes: 0, missingManifest: true };
  if (!response.ok) throw new Error(`Asset manifest: HTTP ${response.status}`);
  const manifest = await response.json();
  if (!Array.isArray(manifest)) throw new Error("Asset manifest must be an array");
  const seen = new Set();
  for (const entry of manifest) {
    const path = entry?.path;
    if (typeof path !== "string" || !path.startsWith("assets/")
        || path.split("/").some(part => !part || part === "." || part === "..")
        || /[\\\0:?#]/.test(path) || seen.has(path)) {
      throw new Error(`Invalid or duplicate asset path: ${path}`);
    }
    seen.add(path);
    expect(path, entry.bytes);
  }
  if (manifest.length && !raylibFS) throw new Error("Export FS from Emscripten for asset loading");
  let cursor = 0;
  let bytes = 0;
  await Promise.all(Array.from({ length: Math.min(4, manifest.length) }, async () => {
    while (cursor < manifest.length) {
      const { path } = manifest[cursor++];
      const asset = await fetchFile(path);
      if (!asset.ok) throw new Error(`Asset ${path}: HTTP ${asset.status}`);
      const data = new Uint8Array(await asset.arrayBuffer());
      const fs = await raylibFS;
      fs.mkdirTree(`/${path.slice(0, path.lastIndexOf("/"))}`);
      fs.writeFile(`/${path}`, data);
      putFile(root, path, data, true);
      bytes += data.byteLength;
    }
  }));
  return { count: manifest.length, bytes, missingManifest: false };
}

function toBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}
function fromBase64(text) {
  const binary = atob(text);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
function persistent(path) {
  return path?.startsWith(`${SAVE_FOLDER}/`) && SAVE_NAME.test(path.slice(SAVE_FOLDER.length + 1));
}

export function attachPersistence(wasiHost, memory, root, {
  storage = () => localStorage, report = () => {},
} = {}) {
  const diagnostics = { restoredFiles: 0, writes: 0, lastError: null };
  const opened = new Map();
  const dirty = new Set();
  let durable = {};
  let invalidStore = false;
  directory(root, SAVE_FOLDER, true);
  const failure = error => {
    const code = error?.name === "QuotaExceededError" ? errno.ERRNO_NOSPC
      : error?.name === "SecurityError" ? errno.ERRNO_ACCES : errno.ERRNO_IO;
    diagnostics.lastError = { name: error?.name, message: String(error?.message ?? error), errno: code };
    report(`Save persistence failed: ${diagnostics.lastError.message}`);
    return code;
  };
  try {
    const stored = storage().getItem(STORE_KEY);
    if (stored !== null) {
      let parsed;
      try {
        parsed = JSON.parse(stored);
        if (parsed.version !== 1 || !parsed.files || typeof parsed.files !== "object" || Array.isArray(parsed.files)) {
          throw new Error("Unrecognized browser save container");
        }
        const restored = Object.entries(parsed.files).map(([path, data]) => {
          if (!persistent(path) || typeof data !== "string") throw new Error("Invalid browser save entry");
          return [path, fromBase64(data)];
        });
        for (const [path, data] of restored) putFile(root, path, data);
        durable = parsed.files;
        diagnostics.restoredFiles = restored.length;
      } catch (error) {
        invalidStore = true; // Preserve unrecognized bytes instead of overwriting them on the next save.
        throw error;
      }
    }
  } catch (error) { failure(error); }

  const snapshot = () => {
    const files = {};
    for (const [name, inode] of directory(root, SAVE_FOLDER).contents) {
      if (SAVE_NAME.test(name) && inode instanceof File) files[`${SAVE_FOLDER}/${name}`] = toBase64(inode.data);
    }
    return files;
  };
  const commit = () => {
    try {
      if (invalidStore) throw new Error("Existing browser save container needs recovery before overwriting");
      const files = snapshot();
      storage().setItem(STORE_KEY, JSON.stringify({ version: 1, files }));
      durable = files;
      diagnostics.writes++;
      diagnostics.lastError = null;
      return errno.ERRNO_SUCCESS;
    } catch (error) { return failure(error); }
  };
  const restoreFile = path => {
    if (durable[path] !== undefined) putFile(root, path, fromBase64(durable[path]));
    else { const at = locationOf(root, path); at?.parent.contents.delete(at.name); }
  };
  const resolve = (fd, pointer, length) => {
    const relative = parts(decoder.decode(new Uint8Array(memory.buffer, pointer, length)));
    const prefix = findDirectory(root, wasiHost.fds[fd]?.dir);
    return relative && prefix !== null ? [prefix, ...relative].filter(Boolean).join("/") : null;
  };
  const original = { ...wasiHost.wasiImport };
  wasiHost.wasiImport.path_open = (...args) => {
    const result = original.path_open(...args);
    if (result === 0) {
      const fd = new DataView(memory.buffer).getUint32(args[8], true);
      const path = resolve(args[0], args[2], args[3]);
      opened.set(fd, path);
      if (persistent(path) && (args[4] & (errno.OFLAGS_CREAT | errno.OFLAGS_TRUNC))) dirty.add(fd);
    }
    return result;
  };
  for (const method of ["fd_write", "fd_pwrite", "fd_filestat_set_size", "fd_allocate"]) {
    wasiHost.wasiImport[method] = (...args) => {
      const result = original[method](...args);
      if (result === 0 && persistent(opened.get(args[0]))) dirty.add(args[0]);
      return result;
    };
  }
  const sync = fd => {
    if (!dirty.has(fd)) return 0;
    const result = commit();
    if (result !== 0) restoreFile(opened.get(fd));
    dirty.delete(fd);
    return result;
  };
  for (const method of ["fd_sync", "fd_datasync", "fd_close"]) {
    wasiHost.wasiImport[method] = fd => {
      const result = original[method](fd);
      const saved = result === 0 ? sync(fd) : result;
      if (method === "fd_close") { opened.delete(fd); dirty.delete(fd); }
      return saved;
    };
  }
  wasiHost.wasiImport.path_rename = (...args) => {
    const source = resolve(args[0], args[1], args[2]);
    const target = resolve(args[3], args[4], args[5]);
    const before = [locationOf(root, source), locationOf(root, target)].filter(Boolean);
    const result = original.path_rename(...args);
    if (result !== 0 || !(persistent(source) || persistent(target))) return result;
    const saved = commit();
    if (saved !== 0) {
      for (const at of before) {
        if (at.inode) at.parent.contents.set(at.name, at.inode);
        else at.parent.contents.delete(at.name);
      }
    }
    return saved;
  };
  wasiHost.wasiImport.path_unlink_file = (...args) => {
    const path = resolve(args[0], args[1], args[2]);
    const at = locationOf(root, path);
    const result = original.path_unlink_file(...args);
    if (result !== 0 || !persistent(path)) return result;
    const saved = commit();
    if (saved !== 0 && at?.inode) at.parent.contents.set(at.name, at.inode);
    return saved;
  };
  return diagnostics;
}

export function gameEnvironment(query, size = { width: 1280, height: 720 }) {
  const result = new Map([["GARDEN_WIDTH", String(size.width)], ["GARDEN_HEIGHT", String(size.height)], ["GARDEN_PAUSED", "1"]]);
  for (const [key, env, min, max] of [["width", "GARDEN_WIDTH", 960, 4096],
    ["height", "GARDEN_HEIGHT", 600, 2160], ["frames", "GARDEN_FRAMES", 1, 60000]]) {
    const value = query.get(key);
    if (value !== null && /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max) result.set(env, value);
  }
  for (const [key, env, values] of [["tour", "GARDEN_TOUR", ["story", "islands"]],
    ["scene", "GARDEN_SCENE", ["day", "night", "dusk", "sky", "high", "kin", "return"]],
    ["paused", "GARDEN_PAUSED", ["0", "1"]], ["hud", "GARDEN_HUD", ["0", "1"]]]) {
    const value = query.get(key);
    if (values.includes(value)) result.set(env, value);
  }
  return Array.from(result, ([key, value]) => `${key}=${value}`);
}
