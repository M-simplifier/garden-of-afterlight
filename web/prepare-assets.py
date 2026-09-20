"""Prepare only Afterlight's runtime assets; keep the native originals intact."""
import argparse
import json
from pathlib import Path
import re
import shutil


def prepare(source: Path, output: Path) -> None:
    files = ["shaders/voxel.vs", "shaders/voxel.fs", "shaders/sky.fs", "shaders/post.fs",
             "fonts/glyphs.txt", "fonts/NotoSansCJKjp-Regular.otf", "fonts/LICENSE-NotoSansCJK.txt"]
    sounds = ["day", "night", "Mine", "Build", "Jewel", "Offering", "Wound",
              "Jump", "Strike", "Dusk", "Wings", "Return", "Dash"]
    files += [f"garden-audio/{name}.wav" for name in sounds]
    missing = [name for name in files if not (source / name).is_file()]
    if missing:
        raise SystemExit("Missing runtime assets: " + ", ".join(missing))
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
        else:
            shutil.copyfile(source / name, target)
        manifest.append({"path": "assets/" + name, "bytes": target.stat().st_size})
    screen_vertex = output / "assets/shaders/screen.vs"
    shutil.copyfile(Path(__file__).with_name("screen.vs"), screen_vertex)
    manifest.append({"path": "assets/shaders/screen.vs", "bytes": screen_vertex.stat().st_size})
    (output / "assets-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Prepared {len(manifest)} assets, {sum(item['bytes'] for item in manifest):,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Native assets directory")
    parser.add_argument("output", type=Path, help="Browser output directory")
    args = parser.parse_args()
    prepare(args.source.resolve(), args.output.resolve())
