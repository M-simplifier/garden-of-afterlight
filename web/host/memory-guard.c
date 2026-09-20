#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <unistd.h>
#include <emscripten.h>
#include <emscripten/stack.h>

#ifndef WEB_RAYLIB_LIMIT
#define WEB_RAYLIB_LIMIT (128u * 1024u * 1024u)
#endif

extern unsigned char __heap_base;

/* GHC grows the common memory above our arena. Its bytes are not free C heap.
 * Override both Emscripten sbrk hooks, not only the JS memory-growth policy. */
size_t emscripten_get_heap_size(void) { return WEB_RAYLIB_LIMIT; }
bool emscripten_resize_heap(size_t requested) {
    return requested <= WEB_RAYLIB_LIMIT;
}

EMSCRIPTEN_KEEPALIVE uintptr_t web_raylib_limit(void) {
    return WEB_RAYLIB_LIMIT;
}
EMSCRIPTEN_KEEPALIVE uintptr_t web_raylib_heap_base(void) {
    return (uintptr_t)&__heap_base;
}
EMSCRIPTEN_KEEPALIVE uintptr_t web_raylib_program_break(void) {
    return (uintptr_t)sbrk(0);
}
EMSCRIPTEN_KEEPALIVE uintptr_t web_raylib_stack_end(void) {
    return emscripten_stack_get_end();
}
EMSCRIPTEN_KEEPALIVE uintptr_t web_raylib_stack_base(void) {
    return emscripten_stack_get_base();
}
