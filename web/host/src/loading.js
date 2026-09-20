// Fetch progress counts decoded body bytes. Content-Length may describe a
// compressed transfer, so use manifest sizes or an unencoded response only.
export function downloads(changed = () => {}, fetchFile = fetch) {
  const entries = new Map();
  const snapshot = () => {
    const files = [...entries.values()];
    return { files: files.length, completed: files.filter(f => f.done).length,
      loaded: files.reduce((n, f) => n + f.loaded, 0),
      total: files.every(f => f.total > 0) ? files.reduce((n, f) => n + f.total, 0) : null };
  };
  const expect = (path, total) => {
    const entry = entries.get(path) ?? { loaded: 0, done: false, total: 0 };
    if (Number.isSafeInteger(total) && total > 0) entry.total = total;
    entries.set(path, entry);
    changed(snapshot());
  };
  async function trackedFetch(path, options) {
    expect(path, 0);
    const entry = entries.get(path);
    const response = await fetchFile(path, options);
    if (!response.ok) return response;
    if (!entry.total && !response.headers.get('content-encoding')) {
      entry.total = Number(response.headers.get('content-length')) || 0;
    }
    if (!response.body) { entry.done = true; changed(snapshot()); return response; }
    // Keep the fetched Wasm Response (and the browser's compiled-code cache
    // metadata). A synthetic Response around a stream loses that metadata.
    const wasm = response.headers.get('content-type')?.trim().toLowerCase() === 'application/wasm';
    const reader = (wasm ? response.clone() : response).body.getReader();
    const record = ({ done, value }) => {
      if (done) { entry.done = true; entry.total = entry.loaded; }
      else entry.loaded += value.byteLength;
      changed(snapshot());
      return { done, value };
    };
    if (wasm) {
      // The original body still reports fetch/compile errors to its consumer.
      (async () => { while (!record(await reader.read()).done) {} })().catch(() => {});
      return response;
    }
    const body = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = record(await reader.read());
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) { controller.error(error); }
      },
      cancel: reason => reader.cancel(reason),
    });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  return { fetch: trackedFetch, expect, snapshot };
}

export async function compileModule(response) {
  const result = await response;
  if (!result.ok) throw new Error(`Game module: HTTP ${result.status}`);
  if (typeof WebAssembly.compileStreaming === 'function'
      && result.headers.get('content-type')?.trim().toLowerCase() === 'application/wasm') {
    return WebAssembly.compileStreaming(result);
  }
  // A misconfigured static host can still run, but should fix its WASM MIME.
  return WebAssembly.compile(await result.arrayBuffer());
}
