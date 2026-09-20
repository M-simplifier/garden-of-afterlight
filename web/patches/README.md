# Upstream patch

`h-raylib-web.patch` modifies h-raylib 5.6.0.0's wasm32 structure layout and
its bundled raylib web focus callback. It is a local modification, not an
upstream h-raylib or raylib release.

The Haskell binding is by Anut and contributors, under Apache-2.0;
see [the retained license](LICENSE-h-raylib.txt) and
[the exact source package](https://hackage.haskell.org/package/h-raylib-5.6.0.0).

The raylib change retains the following notice from `rcore_web.c`:

Copyright (c) 2013-2026 Ramon Santamaria (@raysan5) and contributors

This software is provided "as-is", without any express or implied warranty. In no event
will the authors be held liable for any damages arising from the use of this software.

Permission is granted to anyone to use this software for any purpose, including commercial
applications, and to alter it and redistribute it freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not claim that you
   wrote the original software. If you use this software in a product, an acknowledgment
   in the product documentation would be appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be misrepresented
   as being the original software.
3. This notice may not be removed or altered from any source distribution.
