#include <stdint.h>

/* h-raylib's Web FFI calls the browser, which owns the raylib Wasm module. */
void browser_log(void *, uint32_t) __attribute__((import_module("env"), import_name("log")));
void jslog(void *text, uint32_t length) { browser_log(text, length); }
void browser_free(void *) __attribute__((import_module("env"), import_name("free")));
void jsfree(void *pointer) { browser_free(pointer); }
void *browser_raylib(char *, uint32_t, void **, uint32_t *, uint8_t *, uint32_t, uint32_t, uint8_t)
  __attribute__((import_module("env"), import_name("callRaylibFunction")));
void *callRaylibFunction(char *name, uint32_t length, void **args, uint32_t *sizes,
                       uint8_t *types, uint32_t count, uint32_t result_size, uint8_t result_type) {
  return browser_raylib(name, length, args, sizes, types, count, result_size, result_type);
}
