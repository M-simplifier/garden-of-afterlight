// Passed to emcc --post-js. Keep Emscripten's own closure-held HEAP views in
// sync when the other WASM instance (GHC) grows the common linear memory.
Module["refreshMemoryViews"] = updateMemoryViews;
// Emscripten 3.1.45's GLFW installs all three key listeners on window capture.
// Wrap before glfwInit captures these function references. Filtering only GLFW
// preserves target events and native keyboard activation on HTML controls.
['onKeydown', 'onKeyup', 'onKeyPress'].forEach(function(name) {
  var original = GLFW[name];
  GLFW[name] = function(event) {
    if (Module['acceptKey'] && !Module['acceptKey'](event)) return;
    return original.apply(this, arguments);
  };
});
// Pinned to Emscripten 3.1.45's single-window GLFW bridge. Its setWindowSize
// implicitly enters/exits fullscreen, and onCanvasResize replaces the requested
// size with screen dimensions while fullscreen. The host owns fullscreen, CSS,
// and the render budget; keep backing dimensions and C resize callbacks aligned.
(function() {
  function resize(win, width, height) {
    var canvas = Module['canvas'];
    var active = GLFW.active === win;
    var changed = win.width !== width || win.height !== height
      || (active && (canvas.width !== width || canvas.height !== height));
    win.width = width;
    win.height = height;
    if (active) {
      canvas.widthNative = width;
      canvas.heightNative = height;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
    }
    return changed;
  }
  function notify(win, framebufferChanged) {
    if (win.windowSizeFunc) getWasmTableEntry(win.windowSizeFunc)(win.id, win.width, win.height);
    if (framebufferChanged && GLFW.active === win && win.framebufferSizeFunc) {
      getWasmTableEntry(win.framebufferSizeFunc)(win.id, win.width, win.height);
    }
  }
  GLFW.setWindowSize = function(winid, width, height) {
    var win = GLFW.WindowFromId(winid);
    if (!win) return;
    notify(win, resize(win, width, height));
  };
  GLFW.onCanvasResize = function(width, height) {
    var win = GLFW.active;
    if (win && resize(win, width, height)) notify(win, true);
  };
})();
// Input reset and audio unlock use the pinned GLFW/miniaudio implementation.
Module['clearInput'] = function() {
  GLFW.onBlur();
  if (!GLFW.active) return;
  var buttons = GLFW.active.buttons;
  GLFW.active.buttons = 0;
  for (var button = 0; button < 8; button++) {
    if ((buttons & (1 << button)) && GLFW.active.mouseButtonFunc) {
      getWasmTableEntry(GLFW.active.mouseButtonFunc)(GLFW.active.id, button, 0, 0);
    }
  }
};
Module['resumeAudio'] = function() { window.miniaudio?.unlock(); };
Module['audioState'] = function() {
  return (window.miniaudio?.devices ?? []).filter(Boolean).map(device => device.webaudio?.state);
};
