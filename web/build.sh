#!/usr/bin/env bash
set -euo pipefail

web=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd -- "$web/.." && pwd)
cache=${AFTERLIGHT_WEB_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/afterlight-web}
output="$repo/.build/afterlight-web"
assets=
jobs=${JOBS:-4}
usage() {
  printf 'Usage: bash web/build.sh --assets DIRECTORY [--output DIRECTORY] [--cache DIRECTORY] [--jobs N]\n'
}
while (($#)); do
  case "$1" in
    --assets|--output|--cache|--jobs)
      (($# >= 2)) || { usage >&2; exit 2; }
      case "$1" in
        --assets) assets=$2 ;; --output) output=$2 ;;
        --cache) cache=$2 ;; --jobs) jobs=$2 ;;
      esac
      shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done
[[ -n "$assets" && -d "$assets" ]] || { printf 'Pass the native runtime assets directory with --assets.\n' >&2; exit 2; }
[[ "$jobs" =~ ^[1-9][0-9]*$ ]] || { printf 'Invalid job count.\n' >&2; exit 2; }
for tool in python3 curl tar patch sha256sum wasm32-wasi-ghc wasm32-wasi-ghc-pkg wasm32-wasi-clang; do
  command -v "$tool" >/dev/null || { printf 'Missing %s; use the pinned web/ Nix shell.\n' "$tool" >&2; exit 1; }
done
python3 -c 'import sys; sys.version_info >= (3, 10) or sys.exit("Python 3.10+ is required for fontTools.")'
cabal=${CABAL:-cabal}
ghc_version=$(wasm32-wasi-ghc --numeric-version)
cabal_version=$("$cabal" --numeric-version)
[[ "$ghc_version" == 9.14.1.20260330 && "$cabal_version" == 3.16.1.0 ]] || {
  printf 'Expected GHC-Wasm 9.14.1.20260330 / Cabal 3.16.1.0; got %s / %s.\n' "$ghc_version" "$cabal_version" >&2
  exit 1
}
mkdir -p -- "$cache" "$output"
cache=$(cd -- "$cache" && pwd)
output=$(cd -- "$output" && pwd)
assets=$(cd -- "$assets" && pwd)

download() {
  local url=$1 file=$2 expected=$3
  if [[ ! -f "$file" ]]; then
    curl --fail --location --retry 3 "$url" --output "$file.download"
    printf '%s  %s\n' "$expected" "$file.download" | sha256sum --check --status
    mv -- "$file.download" "$file"
  fi
  printf '%s  %s\n' "$expected" "$file" | sha256sum --check --status
}

# Reuse an activated matching SDK, otherwise install the pinned one in cache.
if ! command -v emcc >/dev/null || ! emcc --version | head -n 1 | grep -q ' 3\.1\.45 '; then
  sdk_rev=c59d6e841da55c2c21af32004c4c173cbd1c0f10
  sdk="$cache/emsdk-$sdk_rev"
  archive="$cache/emsdk-$sdk_rev.tar.gz"
  download "https://codeload.github.com/emscripten-core/emsdk/tar.gz/$sdk_rev" "$archive" \
    ce1e21dc9447d77591f12f78bf82158bc8ef40de646150d6808d5a79555889ff
  if [[ ! -f "$sdk/emsdk" ]]; then
    mkdir -p -- "$sdk"
    tar -xzf "$archive" --strip-components=1 -C "$sdk"
  fi
  if [[ ! -f "$sdk/.afterlight-3.1.45" ]]; then
    "$sdk/emsdk" install 3.1.45
    "$sdk/emsdk" activate 3.1.45
    touch "$sdk/.afterlight-3.1.45"
  fi
  # emsdk_env.sh is provided by the verified SDK and selects its Node/Python.
  source "$sdk/emsdk_env.sh" >/dev/null 2>&1
fi
for tool in node npm emcc; do command -v "$tool" >/dev/null; done
emcc_version=$(emcc --version | head -n 1)
[[ "$emcc_version" == *' 3.1.45 '* ]] || { printf 'Expected Emscripten 3.1.45.\n' >&2; exit 1; }

# The pure-Python wheel needs no install, pip, native extensions or extra deps.
fonttools="$cache/fonttools-4.61.1-py3-none-any.whl"
download https://files.pythonhosted.org/packages/c7/4e/ce75a57ff3aebf6fc1f4e9d508b8e5810618a33d900ad6c19eb30b290b97/fonttools-4.61.1-py3-none-any.whl \
  "$fonttools" 17d2bf5d541add43822bcf0c43d7d847b160c9bb01d15d5007d84e2217aaa371

hackage_sha=09aec4df1f8974a90366bd78612839549e387643b20826a519bb4f1e831591aa
archive="$cache/h-raylib-5.6.0.0.tar.gz"
download https://hackage.haskell.org/package/h-raylib-5.6.0.0/h-raylib-5.6.0.0.tar.gz "$archive" "$hackage_sha"
patch_sha=$(sha256sum "$web/patches/h-raylib-web.patch" | cut -d ' ' -f 1)
vendor="$cache/h-raylib-$patch_sha"
if [[ ! -f "$vendor/.afterlight-patched" ]]; then
  # A unique extraction directory prevents an interrupted patch from becoming
  # the next build's input. No user checkout is patched or deleted.
  staging=$(mktemp -d "$cache/h-raylib-extract.XXXXXX")
  tar -xzf "$archive" --strip-components=1 -C "$staging"
  patch --batch --fuzz=0 -d "$staging" -p1 < "$web/patches/h-raylib-web.patch"
  touch "$staging/.afterlight-patched"
  [[ ! -e "$vendor" ]] || { printf 'Incomplete vendor cache: %s\n' "$vendor" >&2; exit 1; }
  mv -- "$staging" "$vendor"
fi

# Cabal owns Haskell dependency tracking. Dist/store identity additionally
# includes the compiler and template, so changing toolchains cannot reuse it.
build_key=$(printf '%s\n' "$ghc_version" "$cabal_version" "$vendor" "$(sha256sum "$web/cabal.project.template" "$web/wasm-link")" | sha256sum | cut -d ' ' -f 1)
build="$cache/haskell-$build_key"
mkdir -p -- "$build"
python3 - "$web/cabal.project.template" "$build/cabal.project" "$repo" "$vendor" "$cache/cabal-store" <<'PY'
import json, pathlib, sys
template, target, repo, vendor, store = sys.argv[1:]
text = pathlib.Path(template).read_text()
for name, value in [('@REPO@', repo), ('@H_RAYLIB@', vendor), ('@STORE@', store)]:
    text = text.replace(name, json.dumps(value))
path = pathlib.Path(target)
if not path.exists() or path.read_text() != text:
    path.write_text(text)
PY
# A program name on PATH also handles repository paths containing spaces.
export PATH="$web:$PATH"
"$cabal" build exe:afterlight-browser --project-file="$build/cabal.project" \
  --with-compiler="$(command -v wasm32-wasi-ghc)" --with-hc-pkg="$(command -v wasm32-wasi-ghc-pkg)" \
  --builddir="$build/dist" -j"$jobs" --ghc-options=-pgmlwasm-link
artifact=$(python3 - "$build/dist/cache/plan.json" <<'PY'
import json, sys
plan = json.load(open(sys.argv[1]))
bins = [p['bin-file'] for p in plan['install-plan']
        if p.get('component-name') == 'exe:afterlight-browser'
        and p.get('pkg-name') == 'garden-of-afterlight']
if len(bins) != 1:
    raise SystemExit('Expected exactly one browser reactor in Cabal plan.json')
print(bins[0])
PY
)
cp -- "$artifact" "$output/haskell.wasm"

# Hash every C source/header, compiler identity, and build flags (this script).
# Timestamp-only caches miss changed headers and previous compiler options.
c_key=$(python3 - "$vendor" "$web/build.sh" "$emcc_version" <<'PY'
import hashlib, pathlib, sys
root = pathlib.Path(sys.argv[1]); digest = hashlib.sha256()
digest.update(sys.argv[3].encode()); digest.update(pathlib.Path(sys.argv[2]).read_bytes())
for folder in ('raylib/src', 'raygui/src', 'lib'):
    for path in sorted((root / folder).rglob('*')):
        if path.is_file():
            digest.update(path.relative_to(root).as_posix().encode())
            digest.update(path.read_bytes())
print(digest.hexdigest())
PY
)
c_build="$cache/raylib-$c_key"
mkdir -p -- "$c_build"
c_flags=(-O2 -DPLATFORM_WEB -DGRAPHICS_API_OPENGL_ES3 -I"$vendor/raylib/src" -I"$vendor/raygui/src" -I"$vendor/lib")
emcc -std=c11 -fsyntax-only -I"$vendor/raylib/src" "$web/checks/abi.c"
objects=()
for source in raylib/src/{rcore,rshapes,rtextures,rtext,rmodels,raudio}.c lib/{rl_bindings,rl_internal,rlgl_bindings}.c; do
  object="$c_build/$(basename "${source%.c}").o"
  if [[ ! -f "$object" ]]; then
    emcc "${c_flags[@]}" -c "$vendor/$source" -o "$object.next"
    mv -- "$object.next" "$object"
  fi
  objects+=("$object")
done
emcc "${objects[@]}" "$web/host/memory-guard.c" -O2 \
  -sUSE_GLFW=3 -sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 \
  -sIMPORTED_MEMORY=1 -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=167772160 \
  -sMAXIMUM_MEMORY=1073741824 -sSTACK_SIZE=5242880 -sABORTING_MALLOC=0 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createRaylib -sENVIRONMENT=web \
  -sEXPORTED_FUNCTIONS=_malloc,_free -sEXPORTED_RUNTIME_METHODS=FS \
  --post-js "$web/host/refresh-memory.js" -o "$output/raylib.mjs"

npm_key=$(printf '%s\n' "$(node --version)" "$(npm --version)" "$(sha256sum "$web/host/package.json" "$web/host/package-lock.json")" | sha256sum | cut -d ' ' -f 1)
npm_cache="$cache/npm-$npm_key"
if [[ ! -f "$npm_cache/.afterlight-installed" ]]; then
  mkdir -p -- "$npm_cache"
  cp -- "$web/host/package.json" "$web/host/package-lock.json" "$npm_cache/"
  npm ci --prefix "$npm_cache" --no-audit --no-fund
  touch "$npm_cache/.afterlight-installed"
fi
NODE_PATH="$npm_cache/node_modules" "$npm_cache/node_modules/.bin/esbuild" \
  "$web/host/src/host.js" --bundle --format=esm --platform=browser \
  --external:./raylib.mjs --outfile="$output/host.js"
cp -- "$web/host/public/index.html" "$output/index.html"
python3 - "$output/build-info.json" "$ghc_version" "$cabal_version" "$emcc_version" "$hackage_sha" "$patch_sha" <<'PY'
import json, pathlib, sys
path, ghc, cabal, emcc, archive, patch = sys.argv[1:]
pathlib.Path(path).write_text(json.dumps(dict(ghc=ghc, cabal=cabal, emscripten=emcc,
    h_raylib_archive_sha256=archive, h_raylib_patch_sha256=patch, fonttools='4.61.1'), indent=2) + '\n')
PY
python3 "$web/prepare-assets.py" "$assets" "$output" --fonttools-wheel "$fonttools"
printf '\nBrowser files: %s\nServe locally: python3 "%s/serve.py" --directory "%s"\n' "$output" "$web" "$output"
