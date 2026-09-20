const utf8 = new TextDecoder();

export function refreshRaylibMemory(memory, raylib) {
  if (raylib.HEAPU8.buffer !== memory.buffer) raylib.refreshMemoryViews();
}

export function readScalar(view, pointer, size, type) {
  const signed = type === 0;
  if (type === 2 && size === 4) return view.getFloat32(pointer, true);
  if (type === 2 && size === 8) return view.getFloat64(pointer, true);
  if (type !== 0 && type !== 1) throw new Error(`Invalid ABI scalar ${type}/${size}`);
  if (size === 1) return signed ? view.getInt8(pointer) : view.getUint8(pointer);
  if (size === 2) return signed ? view.getInt16(pointer, true) : view.getUint16(pointer, true);
  if (size === 4) return signed ? view.getInt32(pointer, true) : view.getUint32(pointer, true);
  if (size === 8) return signed ? view.getBigInt64(pointer, true) : view.getBigUint64(pointer, true);
  throw new Error(`Invalid ABI scalar ${type}/${size}`);
}

export function writeScalar(view, pointer, size, type, value) {
  if (type === 2 && size === 4) return view.setFloat32(pointer, value, true);
  if (type === 2 && size === 8) return view.setFloat64(pointer, value, true);
  if (type !== 0 && type !== 1) throw new Error(`Invalid ABI scalar ${type}/${size}`);
  if (size === 1) return view.setUint8(pointer, value);
  if (size === 2) return view.setUint16(pointer, value, true);
  if (size === 4) return view.setUint32(pointer, value, true);
  if (size === 8) return view.setBigUint64(pointer, BigInt.asUintN(64, value), true);
  throw new Error(`Invalid ABI scalar ${type}/${size}`);
}

export function raylibImports(memory, raylib, {
  countCall = () => {}, freeHaskell, raylibLimit = 128 * 1024 * 1024,
  invoke = (_name, fn, args) => fn(...args),
} = {}) {
  // A GHC memory.grow detaches an unshared buffer; refresh Emscripten's private
  // HEAP views before it handles Haskell pointers, including nested pointers.
  const refresh = () => {
    refreshRaylibMemory(memory, raylib);
    return new DataView(memory.buffer);
  };
  const text = (pointer, length) => utf8.decode(new Uint8Array(memory.buffer, pointer, length));
  return {
    memory,
    log: (pointer, length) => console.log(text(pointer, length)),
    free: (pointer) => {
      refresh();
      // h-raylib's Freeable may visit either a raylib-produced allocation or a
      // child array allocated by Haskell poke/newArray. The address partition
      // supplies allocator provenance without guessing the value's shape.
      if (pointer < raylibLimit) raylib._MemFree_(pointer);
      else if (freeHaskell) freeHaskell(pointer);
      else throw new Error("Missing Haskell libc free export for a high-memory allocation");
    },
    callRaylibFunction(namePointer, nameLength, paramsPointer, sizesPointer,
      typesPointer, count, returnSize, returnType) {
      const view = refresh();
      const name = text(namePointer, nameLength);
      const fn = raylib[name];
      if (typeof fn !== "function") throw new Error(`Missing raylib export: ${name}`);
      const args = Array.from({ length: count }, (_, index) => readScalar(
        view,
        view.getUint32(paramsPointer + index * 4, true),
        view.getUint32(sizesPointer + index * 4, true),
        view.getUint8(typesPointer + index),
      ));
      countCall(name);
      const result = invoke(name, fn, args);
      if (returnSize === 0) return 0;
      const pointer = raylib._MemAlloc_(returnSize);
      if (pointer === 0) throw new Error("Raylib arena exhausted allocating an FFI result");
      writeScalar(refresh(), pointer, returnSize, returnType, result);
      return pointer;
    },
  };
}

// browser_wasi_shim 0.4.2 does not implement stdio readiness and its poll_oneoff
// lacks Preview1's fourth (nevents) parameter. Keep the browser loop nonblocking:
// only console/EOF readiness and already-expired clocks are supported here.
export function immediatePoll(memory) {
  return (input, output, count, numberOfEvents) => {
    const view = new DataView(memory.buffer);
    view.setUint32(numberOfEvents, 0, true);
    if (count === 0) return 28; // EINVAL
    let emitted = 0;
    for (let index = 0; index < count; index++) {
      const sub = input + index * 48;
      const type = view.getUint8(sub + 8);
      let flags = 0;
      if (type === 1 || type === 2) {
        const fd = view.getUint32(sub + 16, true);
        if (!((type === 1 && fd === 0) || (type === 2 && (fd === 1 || fd === 2)))) {
          return 58; // ENOTSUP; do not fake readiness for files or sockets.
        }
        if (fd === 0) flags = 1; // stdin is an empty file: EOF/hangup.
      } else if (type === 0) {
        const clock = view.getUint32(sub + 16, true);
        const timeout = view.getBigUint64(sub + 24, true);
        const absolute = (view.getUint16(sub + 40, true) & 1) !== 0;
        if (clock !== 0 && clock !== 1) return 28;
        const now = clock === 0 ? BigInt(Date.now()) * 1000000n
          : BigInt(Math.round(performance.now() * 1000000));
        if (absolute ? timeout > now : timeout !== 0n) continue;
      } else return 28;
      const event = output + emitted * 32;
      new Uint8Array(memory.buffer, event, 32).fill(0);
      view.setBigUint64(event, view.getBigUint64(sub, true), true);
      view.setUint8(event + 10, type);
      view.setUint16(event + 24, flags, true);
      emitted++;
    }
    if (emitted === 0) return 58; // The host must schedule future work via rAF.
    view.setUint32(numberOfEvents, emitted, true);
    return 0;
  };
}
