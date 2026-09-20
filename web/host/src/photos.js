import { putFile } from "./files.js";

const decoder = new TextDecoder();
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

export function screenshotBridge({ memory, raylibFS, root, captured, warn = () => {} }) {
  return (name, fn, args) => {
    if (name !== "_TakeScreenshot_") return fn(...args);
    const pointer = args[0];
    if (!Number.isInteger(pointer) || pointer < 0 || pointer >= memory.buffer.byteLength) {
      throw new Error("Invalid screenshot filename pointer");
    }
    const bytes = new Uint8Array(memory.buffer, pointer, Math.min(4096, memory.buffer.byteLength - pointer));
    const end = bytes.indexOf(0);
    if (end < 0) throw new Error("Unterminated screenshot filename");
    const path = decoder.decode(bytes.subarray(0, end));
    if (!path || path.startsWith("/") || /[\\:]/.test(path) || path.split("/").includes("..")) {
      throw new Error(`Screenshot path must be relative to the game: ${path}`);
    }
    const slash = path.lastIndexOf("/");
    if (slash > 0) raylibFS.mkdirTree(path.slice(0, slash));
    const result = fn(...args);
    // ExportImage reports normal file errors through raylib logging. Leaving
    // WASI without a photo lets the game's existing doesFileExist check report
    // failure; a missing output must not become a successful download.
    if (!raylibFS.analyzePath(path).exists) {
      warn(`Photo export failed: ${path}`);
      return result;
    }
    const data = raylibFS.readFile(path);
    if (data.byteLength <= 8 || !pngSignature.every((value, index) => data[index] === value)) {
      warn(`Photo export did not produce a PNG: ${path}`);
      return result;
    }
    // This completes synchronously before Haskell's file-existence/size check.
    putFile(root, path, data);
    captured(path, data);
    return result;
  };
}

export function photoDownload(link, urls = URL) {
  let currentURL;
  return (path, bytes) => {
    const nextURL = urls.createObjectURL(new Blob([bytes], { type: "image/png" }));
    const previousURL = currentURL;
    currentURL = nextURL;
    link.href = nextURL;
    link.download = path.slice(path.lastIndexOf("/") + 1);
    link.hidden = false;
    if (previousURL) urls.revokeObjectURL(previousURL);
  };
}
