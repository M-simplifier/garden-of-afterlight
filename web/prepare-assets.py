"""Prepare only Afterlight's runtime assets; keep the native originals intact."""
import argparse
import gzip
import io
import json
from pathlib import Path
import re
import shutil
import sys


FONTTOOLS_VERSION = "4.61.1"
FONT = "fonts/NotoSansCJKjp-Regular.otf"


def _font_tools():
    try:
        import fontTools
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError as error:
        raise SystemExit(f"fontTools {FONTTOOLS_VERSION} is required; use web/build.sh or --fonttools-wheel") from error

    if fontTools.__version__ != FONTTOOLS_VERSION:
        raise SystemExit(f"Expected fontTools {FONTTOOLS_VERSION}; use web/build.sh")
    return subset, TTFont


def font_codepoints(source: Path, repo: Path) -> list[int]:
    _, TTFont = _font_tools()
    text = (source / "fonts/glyphs.txt").read_text(encoding="utf-8")
    required = set(range(32, 127)) | {ord(char) for char in text if char.isprintable()}
    with TTFont(source / FONT) as font:
        available = set(font.getBestCmap())
    missing = required - available
    if missing:
        raise SystemExit("Font lacks required characters: " + ", ".join(f"U+{cp:04X}" for cp in sorted(missing)))
    # Source text is a conservative candidate set, including comments and names.
    # Keep supported glyphs without making unrelated text a font requirement.
    sources = sorted((repo / "src").rglob("*.hs"))
    if not sources:
        raise SystemExit(f"No Haskell game sources under {repo / 'src'}")
    text = "".join(path.read_text(encoding="utf-8") for path in sources)
    candidates = {ord(char) for char in text if char.isprintable()}
    return sorted(required | (candidates & available))


def subset_font(source: Path, target: Path, codepoints: list[int]) -> None:
    subset, TTFont = _font_tools()
    with TTFont(source, recalcTimestamp=False) as font:
        missing = set(codepoints) - font.getBestCmap().keys()
        if missing:
            raise SystemExit("Font lacks required characters: " + ", ".join(f"U+{cp:04X}" for cp in sorted(missing)))
        options = subset.Options()
        options.hinting = True
        options.layout_features = ["*"]
        options.name_IDs = ["*"]
        options.name_legacy = True
        options.name_languages = ["*"]
        options.notdef_outline = True
        options.harfbuzz_repacker = False  # The pinned pure-Python wheel is sufficient.
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=codepoints)
        subsetter.subset(font)
        font.save(target)
    with TTFont(target) as font:
        if set(codepoints) - font.getBestCmap().keys():
            raise SystemExit("Font subset lost required characters")
    print(f"Font: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes; {len(codepoints)} codepoints")


def compress_site(output: Path, paths: list[str]) -> None:
    raw_size = encoded_size = 0
    for name in paths:
        path = output / name
        if not path.is_file():
            continue  # Also allow standalone asset preparation, before WASM exists.
        data = path.read_bytes()
        buffer = io.BytesIO()
        # No source filename or wall-clock timestamp in the reproducible stream.
        with gzip.GzipFile(fileobj=buffer, mode="wb", filename="", mtime=0, compresslevel=9) as stream:
            stream.write(data)
        encoded = buffer.getvalue()
        sidecar = path.with_name(path.name + ".gz")
        if len(encoded) < len(data):
            temporary = sidecar.with_name(sidecar.name + ".tmp")
            temporary.write_bytes(encoded)
            temporary.replace(sidecar)
        else:
            sidecar.unlink(missing_ok=True)
        raw_size += len(data)
        encoded_size += min(len(data), len(encoded))
    print(f"HTTP payload: {raw_size:,} bytes identity; {encoded_size:,} bytes with gzip (use web/serve.py)")


def prepare(source: Path, output: Path) -> None:
    files = ["shaders/voxel.vs", "shaders/voxel.fs", "shaders/sky.fs", "shaders/post.fs",
             "fonts/glyphs.txt", FONT, "fonts/LICENSE-NotoSansCJK.txt"]
    sounds = ["day", "night", "Mine", "Build", "Jewel", "Offering", "Wound",
              "Jump", "Strike", "Dusk", "Wings", "Return", "Dash"]
    files += [f"garden-audio/{name}.wav" for name in sounds]
    missing = [name for name in files if not (source / name).is_file()]
    if missing:
        raise SystemExit("Missing runtime assets: " + ", ".join(missing))
    codepoints = font_codepoints(source, Path(__file__).resolve().parents[1])
    manifest = []
    for name in files:
        target = output / "assets" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if name.startswith("shaders/"):
            text = (source / name).read_text(encoding="utf-8")
            if not text.startswith("#version 330"):
                raise SystemExit(f"Expected GLSL 330 in {name}")
            text = text.replace("#version 330", "#version 300 es\nprecision highp float;\nprecision highp int;", 1)
            # ES disallows uniform initializers. Garden.Render supplies all
            # three of these values each frame, including their default values.
            text = re.sub(r"(uniform (?:float|vec3) (?:lens|grading|vignette))\s*=\s*[^;]+;", r"\1;", text)
            target.write_text(text, encoding="utf-8", newline="\n")
        elif name == FONT:
            subset_font(source / name, target, codepoints)
        elif name == "fonts/glyphs.txt":
            target.write_text("".join(map(chr, codepoints)) + "\n", encoding="utf-8", newline="\n")
        else:
            shutil.copyfile(source / name, target)
        manifest.append({"path": "assets/" + name, "bytes": target.stat().st_size})
    screen_vertex = output / "assets/shaders/screen.vs"
    shutil.copyfile(Path(__file__).with_name("screen.vs"), screen_vertex)
    manifest.append({"path": "assets/shaders/screen.vs", "bytes": screen_vertex.stat().st_size})
    (output / "assets-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(manifest)} assets, {sum(item['bytes'] for item in manifest):,} bytes")
    compress_site(output, [item["path"] for item in manifest] + [
        "index.html", "host.js", "raylib.mjs", "haskell.wasm", "raylib.wasm",
        "assets-manifest.json", "build-info.json",
    ])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Native assets directory")
    parser.add_argument("output", type=Path, help="Browser output directory")
    parser.add_argument("--fonttools-wheel", type=Path, help="Pinned pure-Python fontTools wheel (build.sh verifies its SHA256)")
    args = parser.parse_args()
    if args.fonttools_wheel:
        sys.path.insert(0, str(args.fonttools_wheel.resolve()))
    prepare(args.source.resolve(), args.output.resolve())
