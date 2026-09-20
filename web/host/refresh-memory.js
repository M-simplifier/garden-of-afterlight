// Passed to emcc --post-js. Keep Emscripten's own closure-held HEAP views in
// sync when the other WASM instance (GHC) grows the common linear memory.
Module["refreshMemoryViews"] = updateMemoryViews;
